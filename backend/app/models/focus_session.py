from datetime import datetime

from app.core.database import Base
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

MAX_FOCUS_MINUTES = 600


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    __table_args__ = (
        CheckConstraint(f"minutes > 0 AND minutes <= {MAX_FOCUS_MINUTES}", name="ck_focus_minutes"),
        Index("ix_focus_sessions_user_id_started_at", "user_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    # Planned length while running; minutes actually focused once completed
    minutes: Mapped[int] = mapped_column()
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
