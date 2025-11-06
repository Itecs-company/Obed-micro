import os
from datetime import date
from typing import Optional

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from . import auth, crud, exporter, models, schemas
from .database import Base, SessionLocal, engine, get_db
from .logs import log_manager

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "obed-webhook-secret")

app = FastAPI(title="Обеды сотрудников", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        crud.ensure_default_user(db)
        crud.ensure_settings(db)
    finally:
        db.close()
    log_manager.add("INFO", "Сервис запущен")


@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    # Ensure default credentials exist even if database initialization raced backend startup
    crud.ensure_default_user(db)
    user = auth.authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Неверные учетные данные")
    access_token = auth.create_access_token({"sub": user.username})
    log_manager.add("INFO", f"Пользователь {user.username} вошел в систему")
    return schemas.Token(access_token=access_token)


@app.put("/auth/credentials")
def update_credentials(
    payload: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.username and not payload.password:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    crud.update_credentials(db, current_user, payload)
    return {"status": "ok"}


@app.get("/settings", response_model=schemas.SettingsResponse)
def get_settings(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    settings = crud.ensure_settings(db)
    return schemas.SettingsResponse(lunch_price=settings.lunch_price, updated_at=settings.updated_at)


@app.put("/settings", response_model=schemas.SettingsResponse)
def update_settings(
    payload: schemas.SettingsUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    settings = crud.update_lunch_price(db, payload.lunch_price)
    return schemas.SettingsResponse(lunch_price=settings.lunch_price, updated_at=settings.updated_at)


@app.get("/employees", response_model=schemas.EmployeeListResponse)
def list_employees(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    employees, lunch_price = crud.list_employees(db, start_date, end_date)
    participants = len([emp for emp in employees if emp.status])
    total_cost = participants * lunch_price
    return schemas.EmployeeListResponse(
        employees=employees,
        lunch_price=lunch_price,
        total_participants=participants,
        total_cost=total_cost,
    )


@app.post("/employees", response_model=schemas.Employee)
def add_employee(
    payload: schemas.EmployeeCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return crud.create_employee(db, payload)


@app.put("/employees/{employee_id}", response_model=schemas.Employee)
def edit_employee(
    employee_id: int,
    payload: schemas.EmployeeUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return crud.update_employee(db, employee_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/employees/{employee_id}")
def remove_employee(
    employee_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        crud.delete_employee(db, employee_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@app.post("/employees/import")
def import_employees(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        df = pd.read_excel(file.file)
    except Exception as exc:  # pragma: no cover - error handling
        raise HTTPException(status_code=400, detail=f"Не удалось прочитать файл: {exc}") from exc
    required_columns = {"Ф.И.О", "Статус", "Дата"}
    if not required_columns.issubset(set(df.columns)):
        raise HTTPException(status_code=400, detail="Отсутствуют необходимые столбцы: Ф.И.О, Статус, Дата")
    created = 0
    for _, row in df.iterrows():
        try:
            employee = schemas.EmployeeCreate(
                full_name=str(row["Ф.И.О"]).strip(),
                status=str(row["Статус"]).strip().lower() in {"true", "1", "участвует", "yes", "да"},
                date=pd.to_datetime(row["Дата"]).date(),
                note=row.get("Примечание") if "Примечание" in df.columns else None,
            )
            crud.create_employee(db, employee)
            created += 1
        except Exception as exc:  # pragma: no cover - skip invalid rows
            log_manager.add("WARN", f"Строка пропущена: {exc}")
    return {"imported": created}


def _build_attachment_response(content: bytes, filename: str, media_type: str) -> Response:
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return Response(content=content, media_type=media_type, headers=headers)


@app.get("/employees/export/excel")
def download_excel(
    start_date: date,
    end_date: date,
    include_price: bool = True,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    employees, price = crud.list_employees(db, start_date, end_date)
    participants = len([emp for emp in employees if emp.status])
    total_cost = participants * price
    content = exporter.export_excel(employees, include_price, price, total_cost)
    filename = f"employees_{start_date}_{end_date}.xlsx"
    return _build_attachment_response(
        content,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/employees/export/pdf")
def download_pdf(
    start_date: date,
    end_date: date,
    include_price: bool = True,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    employees, price = crud.list_employees(db, start_date, end_date)
    participants = len([emp for emp in employees if emp.status])
    total_cost = participants * price
    content = exporter.export_pdf(employees, include_price, price, total_cost)
    filename = f"employees_{start_date}_{end_date}.pdf"
    return _build_attachment_response(content, filename, "application/pdf")


@app.post("/webhook/employee")
def webhook_employee(payload: schemas.WebhookPayload, db: Session = Depends(get_db)):
    if payload.secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Неверный секретный ключ")
    action = payload.action.lower()
    if action == "add":
        if not payload.employee:
            raise HTTPException(status_code=400, detail="Нет данных сотрудника для добавления")
        employee = crud.create_employee(db, payload.employee)
        return {"status": "added", "id": employee.id}
    if action == "update":
        if not payload.employee_id or not payload.update:
            raise HTTPException(status_code=400, detail="Необходимо указать employee_id и update")
        try:
            employee = crud.update_employee(db, payload.employee_id, payload.update)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"status": "updated", "id": employee.id}
    if action == "delete":
        if not payload.employee_id:
            raise HTTPException(status_code=400, detail="Необходимо указать employee_id")
        try:
            crud.delete_employee(db, payload.employee_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"status": "deleted", "id": payload.employee_id}
    raise HTTPException(status_code=400, detail="Неизвестное действие")


@app.get("/logs", response_model=schemas.LogResponse)
def get_logs(current_user: models.User = Depends(auth.get_current_user)):
    return schemas.LogResponse(entries=log_manager.list())
