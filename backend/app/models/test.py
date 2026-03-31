import enum
from datetime import datetime
from sqlalchemy import Integer, String, Text, Boolean, Numeric, SmallInteger, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TestStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TestStatus] = mapped_column(Enum(TestStatus, name="test_status_t"), nullable=False, default=TestStatus.draft)
    time_limit_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    attempts_allowed: Mapped[int] = mapped_column(SmallInteger, default=1)
    passing_score_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=60)
    questions_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=True)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=True)
    show_results: Mapped[bool] = mapped_column(Boolean, default=True)
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    available_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="tests")
    author: Mapped["Teacher"] = relationship("Teacher", back_populates="tests")
    test_questions: Mapped[list["TestQuestion"]] = relationship("TestQuestion", back_populates="test", cascade="all, delete-orphan")
    sessions: Mapped[list["TestSession"]] = relationship("TestSession", back_populates="test")
    assignments: Mapped[list["TestAssignment"]] = relationship("TestAssignment", back_populates="test", cascade="all, delete-orphan")


class TestQuestion(Base):
    __tablename__ = "test_questions"
    __table_args__ = (UniqueConstraint("test_id", "question_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_id: Mapped[int] = mapped_column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    order_num: Mapped[int] = mapped_column(SmallInteger, default=1)
    score_max: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    test: Mapped["Test"] = relationship("Test", back_populates="test_questions")
    question: Mapped["Question"] = relationship("Question", back_populates="test_questions")


class TestAssignment(Base):
    __tablename__ = "test_assignments"
    __table_args__ = (UniqueConstraint("test_id", "group_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_id: Mapped[int] = mapped_column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    assigned_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True)
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    available_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    test: Mapped["Test"] = relationship("Test", back_populates="assignments")
    group: Mapped["Group"] = relationship("Group", back_populates="test_assignments")
    assigned_by_teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="test_assignments")
