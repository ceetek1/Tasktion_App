from pydantic import BaseModel, ConfigDict
from datetime import datetime



class TaskBase(BaseModel):
    title: str
    description: str | None = None
    due_date: datetime



class TaskCreate(TaskBase):
    pass

class TaskRead(TaskBase):
    id : int
    status: str
    user_id: int


    model_config = ConfigDict(from_attributes= True)



class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    status: str | None = None