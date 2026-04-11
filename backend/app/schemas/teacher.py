from datetime import datetime
from pydantic import BaseModel, EmailStr


class TeacherCreate(BaseModel):
    email: EmailStr
    password: str
    last_name: str
    first_name: str
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None


class TeacherUpdate(BaseModel):
    last_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None
    department_id: int | None = None


class TeacherOut(BaseModel):
    id: int
    user_id: int
    last_name: str
    first_name: str
    middle_name: str | None
    position: str | None
    phone: str | None
    department_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherWithUserOut(TeacherOut):
    user: "UserOut"

    model_config = {"from_attributes": True}


from app.schemas.user import UserOut
TeacherWithUserOut.model_rebuild()
