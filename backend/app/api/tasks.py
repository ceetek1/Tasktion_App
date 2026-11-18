from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead, TaskCreate, TaskUpdate
from app.models.user import User
from app.api.auth import get_current_user
from app.services import courses

router = APIRouter()

# An assignee decides when they do the work and whether it's done; the rest is the creator's
ASSIGNEE_FIELDS = {"status", "planned_for"}


def _get_visible_task(db: Session, task_id: int, user: User) -> Task:
    """Members see tasks they created or were assigned."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, or_(Task.user_id == user.id, Task.assigned_to == user.id))
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _check_assignee(db: Session, user_id: int | None) -> None:
    if user_id is not None and db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")


def _course_id(db: Session, owner_id: int, course_id: int | None, name: str | None) -> int | None:
    try:
        course = courses.resolve(db, owner_id, course_id=course_id, name=name)
    except courses.CourseError as exc:
        raise HTTPException(status_code=422 if "not both" in str(exc) else 404, detail=str(exc))
    return course.id if course else None


def _check_boss(db: Session, user: User, boss_task_id: int | None, task_id: int | None = None) -> None:
    """A revision task can be aimed at one of the member's exams."""
    if boss_task_id is None:
        return
    if boss_task_id == task_id:
        raise HTTPException(status_code=422, detail="A task can't be its own exam")
    exam = _get_visible_task(db, boss_task_id, user)
    if exam.kind != "exam":
        raise HTTPException(status_code=422, detail="boss_task_id must point at an exam task")


def _check_guardian(kind: str, guardian: str | None) -> None:
    if guardian is not None and kind != "exam":
        raise HTTPException(status_code=422, detail="Only exam tasks have a guardian")


def _plain(value):
    return value.value if isinstance(value, Enum) else value


@router.get("/tasks", response_model=list[TaskRead])
def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Task)
        .filter(or_(Task.user_id == current_user.id, Task.assigned_to == current_user.id))
        .order_by(Task.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_visible_task(db, task_id, current_user)


@router.post("/tasks", response_model=TaskRead, status_code=201)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_assignee(db, task.assigned_to)
    _check_guardian(task.kind.value, _plain(task.guardian))
    _check_boss(db, current_user, task.boss_task_id)
    new_task = Task(
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        user_id=current_user.id,
        assigned_to=task.assigned_to,
        course_id=_course_id(db, current_user.id, task.course_id, task.course),
        kind=task.kind.value,
        planned_for=task.planned_for,
        estimate_minutes=task.estimate_minutes,
        guardian=_plain(task.guardian),
        boss_task_id=task.boss_task_id,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_task = _get_visible_task(db, task_id, current_user)

    task_data = {k: _plain(v) for k, v in task_update.model_dump(exclude_unset=True, mode="python").items()}
    if existing_task.user_id != current_user.id and set(task_data) - ASSIGNEE_FIELDS:
        raise HTTPException(status_code=403, detail="Assignees can only update task status and planned day")

    if "assigned_to" in task_data:
        _check_assignee(db, task_data["assigned_to"])
        if task_data["assigned_to"] != existing_task.assigned_to:
            # New recipient should get their own reminder
            existing_task.reminder_sent_at = None
    if "due_date" in task_data:
        existing_task.reminder_sent_at = None
    if "course_id" in task_data or "course" in task_data:
        course_id = task_data.pop("course_id", None)
        name = task_data.pop("course", None)
        task_data["course_id"] = _course_id(db, existing_task.user_id, course_id, name)
    kind = task_data.get("kind", existing_task.kind)
    guardian = task_data.get("guardian", existing_task.guardian)
    if kind != "exam" and "kind" in task_data and "guardian" not in task_data:
        # Leaving the exam kind drops the guardian
        guardian = task_data["guardian"] = None
    _check_guardian(kind, guardian)
    if "boss_task_id" in task_data:
        _check_boss(db, current_user, task_data["boss_task_id"], existing_task.id)
    for key, value in task_data.items():
        setattr(existing_task, key, value)
    db.commit()
    db.refresh(existing_task)
    return existing_task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_task = _get_visible_task(db, task_id, current_user)
    if existing_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the task creator can delete it")
    db.delete(existing_task)
    db.commit()
