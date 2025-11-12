from datetime import date, datetime
from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    status = Column(Boolean, default=True)
    date = Column(Date, default=date.today)
    note = Column(String(255), nullable=True)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    lunch_price = Column(Float, default=150.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
