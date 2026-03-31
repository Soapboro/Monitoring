from datetime import datetime, date
from sqlalchemy import Integer, Boolean, Text, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "assignment_id", "lesson_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("teaching_assignments.id", ondelete="CASCADE"), nullable=False)
    lesson_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[int] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship("Student", back_populates="attendance")
    assignment: Mapped["TeachingAssignment"] = relationship("TeachingAssignment", back_populates="attendance")
    recorded_by_teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="attendance_recorded")
