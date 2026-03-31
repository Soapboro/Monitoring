from datetime import datetime
from pydantic import BaseModel


class DepartmentCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
