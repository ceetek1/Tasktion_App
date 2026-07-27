from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead
from app.models.user import User
from app.api.auth import require_admin

router = APIRouter()

@router.get("/admin/tasks",response_model= list[TaskRead])
def get_all_tasks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(Task).all()