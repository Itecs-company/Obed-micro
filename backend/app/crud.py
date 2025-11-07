from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import get_password_hash, verify_password


DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"
from .logs import log_manager


def ensure_default_user(db: Session) -> None:
    user = db.query(models.User).filter(models.User.username == DEFAULT_USERNAME).first()
    if not user:
        user = models.User(
            username=DEFAULT_USERNAME,
            password_hash=get_password_hash(DEFAULT_PASSWORD),
        )
        db.add(user)
        db.commit()
        log_manager.add("INFO", "Created default admin credentials")
        return

    if not verify_password(DEFAULT_PASSWORD, user.password_hash):
        user.password_hash = get_password_hash(DEFAULT_PASSWORD)
        db.commit()
        log_manager.add("INFO", "Reset default admin credentials")


def ensure_settings(db: Session) -> models.Settings:
    settings = db.query(models.Settings).first()
    if not settings:
        settings = models.Settings(lunch_price=150.0)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        log_manager.add("INFO", "Initialized lunch price settings")
    return settings


def list_employees(db: Session, start: Optional[date] = None, end: Optional[date] = None) -> Tuple[List[models.Employee], float]:
    query = db.query(models.Employee)
    if start:
        query = query.filter(models.Employee.date >= start)
    if end:
        query = query.filter(models.Employee.date <= end)
    employees = query.order_by(models.Employee.date.desc(), models.Employee.full_name.asc()).all()
    lunch_price = ensure_settings(db).lunch_price
    return employees, lunch_price


def create_employee(db: Session, employee: schemas.EmployeeCreate) -> models.Employee:
    db_employee = models.Employee(**employee.dict())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    log_manager.add("INFO", f"Added employee {db_employee.full_name} for {db_employee.date}")
    return db_employee


def update_employee(db: Session, employee_id: int, payload: schemas.EmployeeUpdate) -> models.Employee:
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise ValueError("Employee not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(db_employee, field, value)
    db.commit()
    db.refresh(db_employee)
    log_manager.add("INFO", f"Updated employee {db_employee.full_name} (#{db_employee.id})")
    return db_employee


def delete_employee(db: Session, employee_id: int) -> None:
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise ValueError("Employee not found")
    db.delete(db_employee)
    db.commit()
    log_manager.add("INFO", f"Removed employee {db_employee.full_name} (#{db_employee.id})")


def update_credentials(db: Session, user: models.User, payload: schemas.UserUpdate) -> models.User:
    if payload.username:
        user.username = payload.username
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    log_manager.add("INFO", f"Credentials updated for user {user.username}")
    return user


def update_lunch_price(db: Session, price: float) -> models.Settings:
    settings = ensure_settings(db)
    settings.lunch_price = price
    db.commit()
    db.refresh(settings)
    log_manager.add("INFO", f"Lunch price updated to {price}")
    return settings


def aggregate_cost(db: Session, start: Optional[date] = None, end: Optional[date] = None) -> Tuple[int, float]:
    settings = ensure_settings(db)
    query = db.query(func.count()).select_from(models.Employee).filter(models.Employee.status.is_(True))
    if start:
        query = query.filter(models.Employee.date >= start)
    if end:
        query = query.filter(models.Employee.date <= end)
    count = query.scalar() or 0
    total = count * settings.lunch_price
    return count, total
