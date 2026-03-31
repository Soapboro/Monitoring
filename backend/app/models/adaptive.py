from datetime import datetime
from sqlalchemy import Integer, Numeric, DateTime, Enum, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.question import Difficulty


class AdaptiveRecommendation(Base):
    __tablename__ = "adaptive_recommendations"
    __table_args__ = (
        UniqueConstraint("student_id", "topic_id"),
        CheckConstraint("mastery_level BETWEEN 0 AND 1", name="chk_mastery"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    mastery_level: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0)
    recommended_difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, name="difficulty_t"), nullable=False, default=Difficulty.medium)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship("Student", back_populates="adaptive_recommendations")
    topic: Mapped["Topic"] = relationship("Topic", back_populates="adaptive_recommendations")
