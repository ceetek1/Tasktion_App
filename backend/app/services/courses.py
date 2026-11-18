"""Finding and creating a member's courses."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.course import COURSE_COLOURS, Course


class CourseError(ValueError):
    """A course request the member can fix; the message is for them."""


def default_glyph(name: str) -> str:
    return name.strip()[:1].upper() or "?"


def next_colour(db: Session, user_id: int) -> str:
    count = db.query(func.count(Course.id)).filter(Course.user_id == user_id).scalar() or 0
    return COURSE_COLOURS[count % len(COURSE_COLOURS)]


def find_by_name(db: Session, user_id: int, name: str) -> Course | None:
    return (
        db.query(Course)
        .filter(Course.user_id == user_id, func.lower(Course.name) == name.strip().lower())
        .first()
    )


def find_or_create(db: Session, user_id: int, name: str) -> Course:
    name = name.strip()
    course = find_by_name(db, user_id, name)
    if course is None:
        course = Course(user_id=user_id, name=name, glyph=default_glyph(name), colour=next_colour(db, user_id))
        db.add(course)
        db.flush()
    return course


def owned(db: Session, user_id: int, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None or course.user_id != user_id:
        raise CourseError("Course not found")
    return course


def resolve(db: Session, user_id: int, *, course_id: int | None, name: str | None) -> Course | None:
    """The course for a task, from its id or (for plain-text callers) its name."""
    if course_id is not None and name is not None:
        raise CourseError("Give course_id or course, not both")
    if course_id is not None:
        return owned(db, user_id, course_id)
    if name:
        return find_or_create(db, user_id, name)
    return None
