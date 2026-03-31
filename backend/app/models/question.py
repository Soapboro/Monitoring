import enum
from datetime import datetime
from sqlalchemy import Integer, String, Text, Boolean, Numeric, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class QuestionType(str, enum.Enum):
    single_choice = "single_choice"
    multiple_choice = "multiple_choice"
    text_input = "text_input"
    matching = "matching"
    ordering = "ordering"


class Difficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_id: Mapped[int] = mapped_column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType, name="question_type_t"), nullable=False, default=QuestionType.single_choice)
    difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, name="difficulty_t"), nullable=False, default=Difficulty.medium)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    score_max: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=1)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    topic: Mapped["Topic"] = relationship("Topic", back_populates="questions")
    author: Mapped["Teacher"] = relationship("Teacher", back_populates="questions")
    test_questions: Mapped[list["TestQuestion"]] = relationship("TestQuestion", back_populates="question")
    answers: Mapped[list["QuestionAnswer"]] = relationship("QuestionAnswer", back_populates="question")
