from app.core.database import Base
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column()
    description: Mapped[str | None] = mapped_column(nullable=True)
    due_date: Mapped[datetime] = mapped_column()
    status: Mapped[str] = mapped_column(default="pending")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
