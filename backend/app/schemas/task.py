from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from datetime import datetime, timezone
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


def _ensure_utc(v: datetime) -> datetime:
    # If datetime is naive, assume UTC
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


def _future_utc(v: datetime) -> datetime:
    v = _ensure_utc(v)
    if v <= datetime.now(timezone.utc):
        raise ValueError("due_date must be in the future")
    return v


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v):
        return _future_utc(v)


class TaskRead(BaseModel):
    id: int
    title: str
    description: str | None = None
    due_date: datetime
    status: TaskStatus = TaskStatus.PENDING
    user_id: int
    assigned_to: int | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("due_date")
    def serialize_due_date(self, v: datetime) -> str:
        return _ensure_utc(v).isoformat().replace("+00:00", "Z")


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime | None = None
    status: TaskStatus | None = None

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v):
        return None if v is None else _future_utc(v)

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("title", "due_date", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class TaskAssign(BaseModel):
    assigned_to: int | None
