from fastapi import APIRouter,Depends ,HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.schemas.task import TaskRead
from app.schemas.task import TaskCreate
from app.models.user import User


router = APIRouter()

@router.get("/tasks",response_model= list[TaskRead])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

@router.get("/tasks/{task_id}",response_model= TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    return task

@router.post("/tasks",response_model= TaskRead,status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    new_task = Task(title= task.title, description=task.description, due_date=task.due_date, user_id=1)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task
