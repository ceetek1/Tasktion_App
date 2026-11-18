from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from datetime import date, datetime, timezone
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Guardian(str, Enum):
    KRAKEN = "kraken"
    DRAGON = "dragon"
    GOLEM = "golem"


class TaskKind(str, Enum):
    TASK = "task"
    ASSIGNMENT = "assignment"
    EXAM = "exam"
    READING = "reading"
    REVISION = "revision"
    STUDY = "study"


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


def _utc_iso(v: datetime | None) -> str | None:
    return None if v is None else _ensure_utc(v).isoformat().replace("+00:00", "Z")


def _clean_course(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime
    assigned_to: int | None = None
    course_id: int | None = None
    course: str | None = Field(None, max_length=80, description="A course name; found or created. Use course_id or this.")
    kind: TaskKind = TaskKind.TASK
    planned_for: date | None = None
    estimate_minutes: int | None = Field(None, gt=0, le=1440)
    guardian: Guardian | None = Field(None, description="Exams only")
    boss_task_id: int | None = Field(None, description="The exam task a revision task prepares for")

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v):
        return _future_utc(v)

    @field_validator("course")
    @classmethod
    def strip_course(cls, v):
        return _clean_course(v)


class TaskRead(BaseModel):
    id: int
    title: str
    description: str | None = None
    due_date: datetime
    status: TaskStatus = TaskStatus.PENDING
    user_id: int
    assigned_to: int | None = None
    course_id: int | None = None
    course: str | None = Field(None, description="The course's name, for convenience")
    kind: TaskKind = TaskKind.TASK
    planned_for: date | None = None
    estimate_minutes: int | None = None
    completed_at: datetime | None = None
    guardian: Guardian | None = None
    boss_task_id: int | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("due_date")
    def serialize_due_date(self, v: datetime) -> str:
        return _utc_iso(v)

    @field_serializer("completed_at")
    def serialize_completed_at(self, v: datetime | None) -> str | None:
        return _utc_iso(v)


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    due_date: datetime | None = None
    status: TaskStatus | None = None
    assigned_to: int | None = None
    course_id: int | None = None
    course: str | None = Field(None, max_length=80)
    kind: TaskKind | None = None
    # null takes the task off the plan
    planned_for: date | None = None
    estimate_minutes: int | None = Field(None, gt=0, le=1440)
    guardian: Guardian | None = None
    boss_task_id: int | None = None

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v):
        return None if v is None else _future_utc(v)

    @field_validator("course")
    @classmethod
    def strip_course(cls, v):
        return _clean_course(v)

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("title", "due_date", "status", "kind"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
