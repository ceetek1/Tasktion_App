from datetime import date, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.schemas.study import DayClass
from app.schemas.task import TaskRead


def valid_timezone(name: str) -> str:
    name = name.strip()
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f"unknown timezone {name!r}; use an IANA name like 'Europe/London'")
    return name


class PlannerSettings(BaseModel):
    timezone: str
    daily_capacity_minutes: int
    briefings_enabled: bool
    morning_at: time
    evening_at: time
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("morning_at", "evening_at")
    def serialize_time(self, v: time) -> str:
        return v.strftime("%H:%M")


class PlannerSettingsUpdate(BaseModel):
    timezone: str | None = Field(None, max_length=64)
    daily_capacity_minutes: int | None = Field(None, ge=15, le=1440)
    briefings_enabled: bool | None = None
    morning_at: time | None = None
    evening_at: time | None = None

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, v):
        return None if v is None else valid_timezone(v)

    @field_validator("morning_at", "evening_at")
    @classmethod
    def whole_minutes(cls, v):
        if v is None:
            return None
        if v.tzinfo is not None:
            raise ValueError("give a local time without a timezone, like 07:30")
        return v.replace(second=0, microsecond=0)

    @model_validator(mode="after")
    def reject_nulls(self):
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class Load(BaseModel):
    load_minutes: int = Field(description="Estimated minutes of open, non-exam tasks; 45 per task without an estimate")
    capacity_minutes: int
    over_capacity: bool


class TodayPlan(BaseModel):
    date: date
    timezone: str
    planned: list[TaskRead]
    slipped: list[TaskRead]
    overdue: list[TaskRead]
    due_soon: list[TaskRead]
    exams: list[TaskRead]
    classes: list[DayClass] = Field(description="Today's weekly classes")
    load: Load


class DayPlan(Load):
    date: date
    tasks: list[TaskRead]
    due: list[TaskRead]
    classes: list[DayClass]


class WeekPlan(BaseModel):
    start: date
    timezone: str
    days: list[DayPlan]
    unplanned: list[TaskRead] = Field(description="Open tasks with no planned day")


class Suggestion(BaseModel):
    task: TaskRead
    score: int = Field(description="Higher means sooner; only meaningful for ordering")
    reasons: list[str] = Field(description="Readable reasons, most important first")


class NextUp(BaseModel):
    suggestions: list[Suggestion]


class PlanWeekRequest(BaseModel):
    start: date | None = None


class Move(BaseModel):
    task_id: int
    planned_for: date


class ProposedMove(Move):
    title: str
    previously_planned_for: date | None
    due_date: str = Field(description="UTC, ISO 8601")
    estimate_minutes: int
    reason: str
    over_capacity: bool


class DayLoad(Load):
    date: date


class PlanProposal(BaseModel):
    start: date
    end: date
    timezone: str
    capacity_minutes: int
    moves: list[ProposedMove]
    days: list[DayLoad]


class ApplyPlanRequest(BaseModel):
    moves: list[Move] = Field(..., min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_tasks(self):
        ids = [m.task_id for m in self.moves]
        if len(ids) != len(set(ids)):
            raise ValueError("each task can appear only once")
        return self


class ApplyPlanResult(BaseModel):
    updated: list[TaskRead]
