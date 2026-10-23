import uuid

from app.core.database import Base
from sqlalchemy import Index, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Supabase Auth user id (the token's `sub`)
    auth_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    email: Mapped[str] = mapped_column(unique=True)
    display_name: Mapped[str | None] = mapped_column(nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(nullable=True)

    created_tasks = relationship("Task", foreign_keys="Task.user_id", back_populates="owner")
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_to", back_populates="assignee")
