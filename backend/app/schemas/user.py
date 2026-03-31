from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole


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
