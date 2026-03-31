import enum
from datetime import datetime
from sqlalchemy import Integer, SmallInteger, Boolean, Numeric, DateTime, Enum, ForeignKey, UniqueConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, INET

from app.database import Base


class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    timed_out = "timed_out"
    abandoned = "abandoned"


class TestSession(Base):
    __tablename__ = "test_sessions"
    __table_args__ = (UniqueConstraint("test_id", "student_id", "attempt_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_id: Mapped[int] = mapped_column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    attempt_number: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus, name="session_status_t"), nullable=False, default=SessionStatus.in_progress)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    question_order: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    score_total: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    score_max: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)

    test: Mapped["Test"] = relationship("Test", back_populates="sessions")
    student: Mapped["Student"] = relationship("Student", back_populates="test_sessions")
    answers: Mapped[list["QuestionAnswer"]] = relationship("QuestionAnswer", back_populates="session", cascade="all, delete-orphan")
    grades: Mapped[list["Grade"]] = relationship("Grade", back_populates="session")


class QuestionAnswer(Base):
    __tablename__ = "question_answers"
    __table_args__ = (UniqueConstraint("session_id", "question_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score_earned: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    time_spent_sec: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    session: Mapped["TestSession"] = relationship("TestSession", back_populates="answers")
    question: Mapped["Question"] = relationship("Question", back_populates="answers")
