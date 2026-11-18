from app.core.database import Base
from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from datetime import date, datetime, timezone

TASK_KINDS = ("task", "assignment", "exam", "reading", "revision", "study")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="ck_task_status"),
        CheckConstraint(f"kind IN {TASK_KINDS!r}", name="ck_task_kind"),
        CheckConstraint("estimate_minutes > 0", name="ck_task_estimate_positive"),
        Index("ix_tasks_user_id_planned_for", "user_id", "planned_for"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column()
    description: Mapped[str | None] = mapped_column(nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(default="pending", server_default="pending")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    course: Mapped[str | None] = mapped_column(String(80), nullable=True)
    kind: Mapped[str] = mapped_column(default="task", server_default="task")
    # The day the member means to work on it, in their own timezone
    planned_for: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimate_minutes: Mapped[int | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", foreign_keys=[user_id], back_populates="created_tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tasks")

    @validates("status")
    def _track_completion(self, _key, status):
        """Stamp completed_at when a task becomes completed; clear it when it is reopened."""
        if status == "completed":
            if self.status != "completed" or self.completed_at is None:
                self.completed_at = datetime.now(timezone.utc)
        else:
            self.completed_at = None
        return status
