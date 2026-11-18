import uuid
from datetime import date, time

from app.core.database import Base
from sqlalchemy import CheckConstraint, Index, Time, Uuid, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
        CheckConstraint("daily_capacity_minutes > 0", name="ck_user_capacity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Supabase Auth user id (the token's `sub`)
    auth_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    email: Mapped[str] = mapped_column(unique=True)
    display_name: Mapped[str | None] = mapped_column(nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(nullable=True)

    # Planner settings. Briefings are opt-in, so other members get no new emails.
    timezone: Mapped[str] = mapped_column(default="UTC", server_default="UTC")
    daily_capacity_minutes: Mapped[int] = mapped_column(default=180, server_default="180")
    briefings_enabled: Mapped[bool] = mapped_column(default=False, server_default=false())
    morning_at: Mapped[time] = mapped_column(Time, default=time(7, 30), server_default="07:30")
    evening_at: Mapped[time] = mapped_column(Time, default=time(21, 0), server_default="21:00")
    last_morning_briefing_on: Mapped[date | None] = mapped_column(nullable=True)
    last_evening_briefing_on: Mapped[date | None] = mapped_column(nullable=True)

    created_tasks = relationship("Task", foreign_keys="Task.user_id", back_populates="owner")
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_to", back_populates="assignee")
