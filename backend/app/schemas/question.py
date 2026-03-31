from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.models.question import QuestionType, Difficulty


class QuestionCreate(BaseModel):
    topic_id: int
    question_type: QuestionType = QuestionType.single_choice
    difficulty: Difficulty = Difficulty.medium
    body: str
    explanation: str | None = None
    score_max: float = 1.0
    options: dict[str, Any] | None = None
    is_active: bool = True


class QuestionUpdate(BaseModel):
    question_type: QuestionType | None = None
    difficulty: Difficulty | None = None
    body: str | None = None
    explanation: str | None = None
    score_max: float | None = None
    options: dict[str, Any] | None = None
    is_active: bool | None = None


class QuestionOut(BaseModel):
    id: int
    topic_id: int
    author_id: int | None
    question_type: QuestionType
    difficulty: Difficulty
    body: str
    explanation: str | None
    score_max: float
    options: dict[str, Any] | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
