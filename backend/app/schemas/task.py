from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime, timezone
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v):
        # If datetime is naive, assume UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= datetime.now(timezone.utc):
            raise ValueError("due_date must be in the future")
        return v


class TaskCreate(TaskBase):
    pass


class TaskRead(TaskBase):
    id: int
    status: TaskStatus = TaskStatus.PENDING
    user_id: int
    assigned_to: int | None = None
    model_config = ConfigDict(from_attributes=True)


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime | None = None
    status: TaskStatus | None = None


class TaskAssign(BaseModel):
    assigned_to: int

