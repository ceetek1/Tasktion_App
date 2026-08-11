from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime



class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime



class TaskCreate(TaskBase):
    pass

class TaskRead(TaskBase):
    id : int
    status: str
    user_id: int
    assigned_to: int | None = None
    model_config = ConfigDict(from_attributes= True)



class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime | None = None
    status: str | None = None

class TaskAssign(BaseModel):
    assigned_to: int

