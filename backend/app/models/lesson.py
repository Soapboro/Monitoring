import enum
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LessonType(str, enum.Enum):
    lecture = "lecture"
    practice = "practice"
    lab = "lab"
    seminar = "seminar"
    other = "other"


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teaching_assignments.id", ondelete="CASCADE"), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lesson_type: Mapped[LessonType] = mapped_column(
        Enum(LessonType, name="lesson_type_t"), nullable=False, default=LessonType.lecture
    )
    room: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    assignment: Mapped["TeachingAssignment"] = relationship("TeachingAssignment", back_populates="lessons")
