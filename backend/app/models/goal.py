from datetime import datetime

from app.core.database import Base
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

GOAL_TYPES = ("grade", "exam", "habit", "balance")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (CheckConstraint(f"type IN {GOAL_TYPES!r}", name="ck_goal_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column()
    text: Mapped[str] = mapped_column(String(200))
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    # e.g. a grade ("A") or an amount ("8 h")
    target: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Set when the member commits to the goal
    sealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course")
