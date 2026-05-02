from datetime import datetime, date
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserTeacherProfileCreate(BaseModel):
    last_name: str
    first_name: str
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None
    department_id: int | None = None


class UserStudentProfileCreate(BaseModel):
    last_name: str
    first_name: str
    middle_name: str | None = None
    birth_date: date | None = None
    group_id: int
    student_num: str | None = None
    phone: str | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    teacher_profile: UserTeacherProfileCreate | None = None
    student_profile: UserStudentProfileCreate | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class UserOut(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}
