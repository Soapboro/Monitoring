from datetime import datetime, date
from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    student_id: int
    assignment_id: int
    lesson_date: date
    is_present: bool = True
    comment: str | None = None


class AttendanceBulkCreate(BaseModel):
    assignment_id: int
    lesson_date: date
    records: list["AttendanceRecord"]


class AttendanceRecord(BaseModel):
    student_id: int
    is_present: bool
    comment: str | None = None


class AttendanceUpdate(BaseModel):
    is_present: bool | None = None
    comment: str | None = None


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    lesson_date: date
    is_present: bool
    comment: str | None
    recorded_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentAttendanceOut(AttendanceOut):
    subject_id: int
    subject_name: str


AttendanceBulkCreate.model_rebuild()
