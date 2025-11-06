from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)


class SettingsResponse(BaseModel):
    lunch_price: float
    updated_at: datetime


class SettingsUpdate(BaseModel):
    lunch_price: float = Field(gt=0)


class EmployeeBase(BaseModel):
    full_name: str
    status: bool = True
    date: date
    note: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    status: Optional[bool] = None
    date: Optional[date] = None
    note: Optional[str] = None


class Employee(EmployeeBase):
    id: int

    class Config:
        orm_mode = True


class EmployeeListResponse(BaseModel):
    employees: List[Employee]
    lunch_price: float
    total_participants: int
    total_cost: float


class ExportRequest(BaseModel):
    start_date: date
    end_date: date
    include_price: bool = True


class WebhookPayload(BaseModel):
    secret: str
    action: str
    employee: Optional[EmployeeCreate] = None
    employee_id: Optional[int] = None
    update: Optional[EmployeeUpdate] = None


class LogEntry(BaseModel):
    timestamp: datetime
    level: str
    message: str


class LogResponse(BaseModel):
    entries: List[LogEntry]
