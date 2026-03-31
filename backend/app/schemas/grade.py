from datetime import datetime, date
from pydantic import BaseModel
from app.models.grade import GradeType


class GradeCreate(BaseModel):
    student_id: int
    assignment_id: int
    grade_type: GradeType
    value: float | None = None
    passed: bool | None = None
    comment: str | None = None
    date_recorded: date | None = None
    session_id: int | None = None


class GradeUpdate(BaseModel):
    value: float | None = None
    passed: bool | None = None
    comment: str | None = None
    date_recorded: date | None = None


class GradeOut(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    grade_type: GradeType
    value: float | None
    passed: bool | None
    comment: str | None
    date_recorded: date
    recorded_by: int
    session_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
