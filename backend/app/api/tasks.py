from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead

router = APIRouter()

@router.get("/tasks",response_model= list[TaskRead])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()
