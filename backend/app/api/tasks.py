from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead, TaskCreate, TaskUpdate
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter()


def _is_admin(user: User) -> bool:
    return user.role == "admin"


def _get_visible_task(db: Session, task_id: int, user: User) -> Task:
    """Admins see every task; members see tasks they created or were assigned."""
    query = db.query(Task).filter(Task.id == task_id)
    if not _is_admin(user):
        query = query.filter(or_(Task.user_id == user.id, Task.assigned_to == user.id))
    task = query.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


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
    new_task = Task(
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        user_id=current_user.id,
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

    task_data = task_update.model_dump(exclude_unset=True)
    can_edit_all = _is_admin(current_user) or existing_task.user_id == current_user.id
    if not can_edit_all and set(task_data) - {"status"}:
        raise HTTPException(status_code=403, detail="Assignees can only update task status")

    for key, value in task_data.items():
        setattr(existing_task, key, value)
    if "due_date" in task_data:
        existing_task.reminder_sent_at = None
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
    if not _is_admin(current_user) and existing_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the task creator or an admin can delete it")
    db.delete(existing_task)
    db.commit()
