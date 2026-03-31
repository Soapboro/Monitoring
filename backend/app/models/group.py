from datetime import datetime
from sqlalchemy import Integer, String, SmallInteger, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    year_start: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    department: Mapped["Department"] = relationship("Department", back_populates="groups")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="group")
    teaching_assignments: Mapped[list["TeachingAssignment"]] = relationship("TeachingAssignment", back_populates="group")
    test_assignments: Mapped[list["TestAssignment"]] = relationship("TestAssignment", back_populates="group")
