from datetime import datetime, date
from sqlalchemy import Integer, String, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False)
    student_num: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="student")
    group: Mapped["Group"] = relationship("Group", back_populates="students")
    grades: Mapped[list["Grade"]] = relationship("Grade", back_populates="student")
    attendance: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="student")
    test_sessions: Mapped[list["TestSession"]] = relationship("TestSession", back_populates="student")
    adaptive_recommendations: Mapped[list["AdaptiveRecommendation"]] = relationship("AdaptiveRecommendation", back_populates="student")
