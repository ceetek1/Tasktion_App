"""Courses, weekly classes, goals, focus sessions, the term and exam bosses."""
from datetime import date, datetime, time
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.schemas.task import Guardian, TaskRead, _utc_iso

HEX_COLOUR = r"^#[0-9A-Fa-f]{6}$"


def _hhmm(v: time) -> str:
    return v.strftime("%H:%M")


def _strip(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


def _reject_nulls(model: BaseModel, fields: tuple[str, ...]) -> None:
    for field in fields:
        if field in model.model_fields_set and getattr(model, field) is None:
            raise ValueError(f"{field} cannot be null")


# ---------- Courses ----------
class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    glyph: str | None = Field(None, min_length=1, max_length=4, description="Defaults to the first letter")
    colour: str | None = Field(None, pattern=HEX_COLOUR, description="Defaults to the next palette colour")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("name cannot be blank")
        return v


class CourseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    glyph: str | None = Field(None, min_length=1, max_length=4)
    colour: str | None = Field(None, pattern=HEX_COLOUR)

    @model_validator(mode="after")
    def no_nulls(self):
        _reject_nulls(self, ("name", "glyph", "colour"))
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("name cannot be blank")
        return self


class ClassBase(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0 = Monday … 6 = Sunday")
    starts_at: time
    ends_at: time
    place: str | None = Field(None, max_length=80)

    @field_validator("place")
    @classmethod
    def strip_place(cls, v):
        return _strip(v)

    @model_validator(mode="after")
    def ordered(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class ClassCreate(ClassBase):
    course_id: int


class ClassUpdate(BaseModel):
    course_id: int | None = None
    weekday: int | None = Field(None, ge=0, le=6)
    starts_at: time | None = None
    ends_at: time | None = None
    place: str | None = Field(None, max_length=80)

    @model_validator(mode="after")
    def no_nulls(self):
        _reject_nulls(self, ("course_id", "weekday", "starts_at", "ends_at"))
        return self


class ClassRead(BaseModel):
    id: int
    course_id: int
    weekday: int
    starts_at: time
    ends_at: time
    place: str | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("starts_at", "ends_at")
    def serialize_time(self, v: time) -> str:
        return _hhmm(v)


class CourseRead(BaseModel):
    id: int
    name: str
    glyph: str
    colour: str
    classes: list[ClassRead] = []
    model_config = ConfigDict(from_attributes=True)


class DayClass(ClassRead):
    """A class on a particular day of the plan, with its course for display."""

    course: str
    colour: str


# ---------- Goals ----------
class GoalType(str, Enum):
    GRADE = "grade"
    EXAM = "exam"
    HABIT = "habit"
    BALANCE = "balance"


class GoalCreate(BaseModel):
    type: GoalType
    text: str = Field(..., min_length=1, max_length=200)
    course_id: int | None = None
    target: str | None = Field(None, max_length=40)
    sealed: bool = False


class GoalUpdate(BaseModel):
    text: str | None = Field(None, min_length=1, max_length=200)
    course_id: int | None = None
    target: str | None = Field(None, max_length=40)
    sealed: bool | None = None

    @model_validator(mode="after")
    def no_nulls(self):
        _reject_nulls(self, ("text", "sealed"))
        return self


class GoalRead(BaseModel):
    id: int
    type: GoalType
    text: str
    course_id: int | None = None
    target: str | None = None
    sealed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("sealed_at")
    def serialize_sealed(self, v):
        return _utc_iso(v)


# ---------- Focus sessions ----------
class FocusStart(BaseModel):
    task_id: int | None = None
    minutes: int = Field(..., gt=0, le=600, description="Planned length")


class FocusFinish(BaseModel):
    minutes: int = Field(..., gt=0, le=600, description="Minutes actually focused")
    complete_task: bool = Field(False, description="Also mark the linked task completed")


class FocusLog(BaseModel):
    """A session that already happened, e.g. logged from Claude Desktop."""

    task_id: int | None = None
    minutes: int = Field(..., gt=0, le=600)
    complete_task: bool = False


class FocusRead(BaseModel):
    id: int
    task_id: int | None = None
    minutes: int
    started_at: datetime
    completed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("started_at", "completed_at")
    def serialize_times(self, v):
        return _utc_iso(v)


class FocusResult(BaseModel):
    session: FocusRead
    task: TaskRead | None = None


class FocusTotals(BaseModel):
    sessions: list[FocusRead]
    total_minutes: int = Field(description="Completed minutes in the period")


# ---------- Term ----------
class TermUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    start_date: date
    weeks: int = Field(..., ge=1, le=52)


class TermRead(BaseModel):
    name: str | None
    start_date: date | None
    weeks: int | None
    current_week: int | None = Field(description="1-based week of the term today, or null outside it")
    onboarded: bool


# ---------- Bosses ----------
class BossRead(BaseModel):
    exam: TaskRead
    guardian: Guardian | None
    health: int = Field(description="max(0, max_health - completed revision tasks)")
    max_health: int
    defeated: bool
    revision: list[TaskRead] = Field(description="Revision tasks aimed at this exam")


# ---------- History ----------
class DayRecord(BaseModel):
    date: date
    planned: int = Field(description="Tasks planned for the day (not exams)")
    done: int = Field(description="Of those, completed")
    completed: int = Field(description="Any tasks completed that day")
    focus_minutes: int


class History(BaseModel):
    start: date
    end: date
    timezone: str
    days: list[DayRecord]
