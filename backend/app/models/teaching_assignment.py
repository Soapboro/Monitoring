from sqlalchemy import Integer, SmallInteger, String, ForeignKey, UniqueConstraint, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeachingAssignment(Base):
    __tablename__ = "teaching_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_id", "subject_id", "group_id", "semester", "acad_year"),
        CheckConstraint("semester BETWEEN 1 AND 20", name="chk_semester"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    semester: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    acad_year: Mapped[str] = mapped_column(String(9), nullable=False)
    control_form: Mapped[str | None] = mapped_column(String(100), nullable=True)

    teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="teaching_assignments")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="teaching_assignments")
    group: Mapped["Group"] = relationship("Group", back_populates="teaching_assignments")
    grades: Mapped[list["Grade"]] = relationship("Grade", back_populates="assignment")
    attendance: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="assignment")
    lessons: Mapped[list["Lesson"]] = relationship("Lesson", back_populates="assignment")
