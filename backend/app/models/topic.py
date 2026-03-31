from sqlalchemy import Integer, String, SmallInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    order_num: Mapped[int] = mapped_column(SmallInteger, default=1)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="topics")
    parent: Mapped["Topic | None"] = relationship("Topic", remote_side="Topic.id", backref="children")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="topic")
    adaptive_recommendations: Mapped[list["AdaptiveRecommendation"]] = relationship("AdaptiveRecommendation", back_populates="topic")
