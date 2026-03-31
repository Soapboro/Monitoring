from datetime import datetime
from pydantic import BaseModel
from app.models.test import TestStatus


class TestQuestionAdd(BaseModel):
    question_id: int
    order_num: int = 1
    score_max: float | None = None


class TestCreate(BaseModel):
    subject_id: int
    title: str
    description: str | None = None
    time_limit_minutes: int | None = None
    attempts_allowed: int = 1
    passing_score_pct: float = 60.0
    questions_count: int | None = None
    shuffle_questions: bool = True
    shuffle_options: bool = True
    show_results: bool = True
    available_from: datetime | None = None
    available_to: datetime | None = None


class TestUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TestStatus | None = None
    time_limit_minutes: int | None = None
    attempts_allowed: int | None = None
    passing_score_pct: float | None = None
    questions_count: int | None = None
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None
    show_results: bool | None = None
    available_from: datetime | None = None
    available_to: datetime | None = None


class TestOut(BaseModel):
    id: int
    subject_id: int
    author_id: int | None
    title: str
    description: str | None
    status: TestStatus
    time_limit_minutes: int | None
    attempts_allowed: int
    passing_score_pct: float
    questions_count: int | None
    shuffle_questions: bool
    shuffle_options: bool
    show_results: bool
    available_from: datetime | None
    available_to: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestAssignmentCreate(BaseModel):
    test_id: int
    group_id: int
    available_from: datetime | None = None
    available_to: datetime | None = None


class TestAssignmentOut(BaseModel):
    id: int
    test_id: int
    group_id: int
    assigned_by: int | None
    available_from: datetime | None
    available_to: datetime | None

    model_config = {"from_attributes": True}
