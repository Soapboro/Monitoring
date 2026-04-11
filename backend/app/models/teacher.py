from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    position: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="teacher")
    department: Mapped["Department | None"] = relationship("Department", back_populates="teachers")
    teaching_assignments: Mapped[list["TeachingAssignment"]] = relationship("TeachingAssignment", back_populates="teacher")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="author")
    tests: Mapped[list["Test"]] = relationship("Test", back_populates="author")
    grades_recorded: Mapped[list["Grade"]] = relationship("Grade", back_populates="recorded_by_teacher", foreign_keys="Grade.recorded_by")
    attendance_recorded: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="recorded_by_teacher")
    test_assignments: Mapped[list["TestAssignment"]] = relationship("TestAssignment", back_populates="assigned_by_teacher")
