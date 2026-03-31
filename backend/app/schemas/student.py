from datetime import datetime, date
from pydantic import BaseModel, EmailStr


class StudentCreate(BaseModel):
    last_name: str
    first_name: str
    middle_name: str | None = None
    birth_date: date | None = None
    group_id: int
    student_num: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    password: str | None = None


class StudentUpdate(BaseModel):
    last_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    birth_date: date | None = None
    group_id: int | None = None
    student_num: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class StudentOut(BaseModel):
    id: int
    user_id: int | None
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date | None
    group_id: int
    student_num: str | None
    phone: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
