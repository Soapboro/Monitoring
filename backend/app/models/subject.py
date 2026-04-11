from datetime import datetime
from sqlalchemy import Integer, String, SmallInteger, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    hours_total: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    department: Mapped["Department"] = relationship("Department", back_populates="subjects")
    teaching_assignments: Mapped[list["TeachingAssignment"]] = relationship("TeachingAssignment", back_populates="subject")
    topics: Mapped[list["Topic"]] = relationship("Topic", back_populates="subject")
    tests: Mapped[list["Test"]] = relationship("Test", back_populates="subject")
