from datetime import datetime
from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    code: str | None = None
    hours_total: int | None = None
    department_id: int | None = None


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    hours_total: int | None = None
    department_id: int | None = None


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str | None
    hours_total: int | None
    department_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
