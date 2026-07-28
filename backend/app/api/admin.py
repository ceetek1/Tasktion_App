from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead
from app.models.user import User
from app.api.auth import require_admin
from app.schemas.task import TaskAssign
router = APIRouter()

@router.get("/admin/tasks",response_model= list[TaskRead])
def get_all_tasks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(Task).all()

@router.patch("/admin/tasks/{task_id}/assign", response_model= TaskRead)
def assign_task(task_id: int, assignment: TaskAssign, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    
    user = db.query(User).filter(User.id == assignment.assigned_to).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    task.assigned_to = assignment.assigned_to
    db.commit()
    db.refresh(task)
    return task