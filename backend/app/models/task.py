from app.core.database import Base
from sqlalchemy import ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="ck_task_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column()
    description: Mapped[str | None] = mapped_column(nullable=True)
    due_date: Mapped[datetime] = mapped_column()
    status: Mapped[str] = mapped_column(default="pending", server_default="pending")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    owner = relationship("User", foreign_keys=[user_id], backref="created_tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], backref="assigned_tasks")
