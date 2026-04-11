from datetime import datetime
from pydantic import BaseModel, model_validator
from app.models.lesson import LessonType


class LessonCreate(BaseModel):
    assignment_id: int
    starts_at: datetime
    ends_at: datetime
    topic: str | None = None
    lesson_type: LessonType = LessonType.lecture
    room: str | None = None

    @model_validator(mode="after")
    def check_times(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at должно быть позже starts_at")
        return self


class LessonUpdate(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    topic: str | None = None
    lesson_type: LessonType | None = None
    room: str | None = None


class LessonOut(BaseModel):
    id: int
    assignment_id: int
    starts_at: datetime
    ends_at: datetime
    topic: str | None
    lesson_type: LessonType
    room: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
