from app.core.database import Base
from sqlalchemy import CheckConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'member')", name="ck_user_role"),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    hashed_password: Mapped[str] = mapped_column()
    role: Mapped[str] = mapped_column(default="member", server_default="member")

    created_tasks = relationship("Task", foreign_keys="Task.user_id", back_populates="owner")
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_to", back_populates="assignee")
