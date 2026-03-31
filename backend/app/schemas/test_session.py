from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.models.test_session import SessionStatus


class AnswerSubmit(BaseModel):
    question_id: int
    answer_data: dict[str, Any]
    time_spent_sec: int | None = None


class SessionStartOut(BaseModel):
    session_id: int
    test_id: int
    attempt_number: int
    started_at: datetime
    time_limit_minutes: int | None
    questions: list[dict[str, Any]]

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    test_id: int
    student_id: int
    attempt_number: int
    status: SessionStatus
    started_at: datetime
    finished_at: datetime | None
    score_total: float | None
    score_max: float | None
    passed: bool | None

    model_config = {"from_attributes": True}


class SessionResultOut(SessionOut):
    answers: list["AnswerOut"]

    model_config = {"from_attributes": True}


class AnswerOut(BaseModel):
    id: int
    question_id: int
    answer_data: dict[str, Any] | None
    score_earned: float | None
    is_correct: bool | None
    answered_at: datetime

    model_config = {"from_attributes": True}


SessionResultOut.model_rebuild()
