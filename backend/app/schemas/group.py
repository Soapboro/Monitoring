from datetime import datetime
from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    year_start: int
    department_id: int | None = None
    is_active: bool = True


class GroupUpdate(BaseModel):
    name: str | None = None
    year_start: int | None = None
    department_id: int | None = None
    is_active: bool | None = None


class GroupOut(BaseModel):
    id: int
    name: str
    year_start: int
    department_id: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
