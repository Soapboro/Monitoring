import enum
from datetime import datetime, date
from sqlalchemy import Integer, Text, Boolean, Numeric, DateTime, Date, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GradeType(str, enum.Enum):
    current = "current"
    thematic = "thematic"
    midterm = "midterm"
    final = "final"
    attendance = "attendance"


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("teaching_assignments.id", ondelete="CASCADE"), nullable=False)
    grade_type: Mapped[GradeType] = mapped_column(Enum(GradeType, name="grade_type_t"), nullable=False)
    value: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_recorded: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    recorded_by: Mapped[int] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship("Student", back_populates="grades")
    assignment: Mapped["TeachingAssignment"] = relationship("TeachingAssignment", back_populates="grades")
    recorded_by_teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="grades_recorded", foreign_keys=[recorded_by])
    session: Mapped["TestSession"] = relationship("TestSession", back_populates="grades")
