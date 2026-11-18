from datetime import datetime, time

from app.core.database import Base
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, SmallInteger, String, Time, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

# New courses take the next colour in this order
COURSE_COLOURS = ("#5F8A8B", "#B98A2F", "#4F6B4A", "#8A4B2E", "#46706F")


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("colour ~ '^#[0-9A-Fa-f]{6}$'", name="ck_course_colour"),
        Index("uq_courses_user_name", "user_id", text("lower(name)"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    glyph: Mapped[str] = mapped_column(String(4))
    colour: Mapped[str] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classes = relationship(
        "ClassSession", back_populates="course", cascade="all, delete-orphan", passive_deletes=True,
        order_by="(ClassSession.weekday, ClassSession.starts_at)",
    )


class ClassSession(Base):
    """A weekly class: the same weekday and times every week of the term."""

    __tablename__ = "class_sessions"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_class_weekday"),
        CheckConstraint("ends_at > starts_at", name="ck_class_times"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    # 0 = Monday … 6 = Sunday
    weekday: Mapped[int] = mapped_column(SmallInteger)
    starts_at: Mapped[time] = mapped_column(Time)
    ends_at: Mapped[time] = mapped_column(Time)
    place: Mapped[str | None] = mapped_column(String(80), nullable=True)

    course = relationship("Course", back_populates="classes")
