"""The personal planner: what to do today, this week and next.

Every date here is a day in the member's own timezone. Functions take `now`
(UTC) so tests and the briefing job can pin the clock.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.user import User
from app.schemas.planner import (
    DayLoad,
    DayPlan,
    Load,
    PlanProposal,
    ProposedMove,
    Suggestion,
    TodayPlan,
    WeekPlan,
)
from app.schemas.task import TaskRead

DEFAULT_ESTIMATE_MINUTES = 45
DUE_SOON = timedelta(hours=48)
EXAM_LOOKAHEAD_DAYS = 7
PLAN_DAYS = 7
PLAN_HORIZON = timedelta(days=14)

# Ranking weights for "what now?"; higher comes first
SCORE_OVERDUE = 100
SCORE_DUE_24H = 60
SCORE_DUE_72H = 40
SCORE_DUE_7D = 20
SCORE_PLANNED_TODAY = 30
SCORE_SLIPPED = 25
SCORE_IN_PROGRESS = 15
SCORE_REVISION_FOR_EXAM = 35


class PlannerError(ValueError):
    """A request the planner can't carry out; the message is for the member."""


@dataclass(frozen=True)
class Clock:
    now: datetime
    tz: ZoneInfo

    @property
    def today(self) -> date:
        return self.now.astimezone(self.tz).date()

    def day_of(self, moment: datetime) -> date:
        return moment.astimezone(self.tz).date()

    def start_of(self, day: date) -> datetime:
        return datetime.combine(day, time.min, tzinfo=self.tz)


def user_zone(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def clock_for(user: User, now: datetime | None = None) -> Clock:
    return Clock(now=now or datetime.now(timezone.utc), tz=user_zone(user))


# ---------- Queries ----------
def _visible(db: Session, user: User):
    """Tasks the member made or was given, like the task list."""
    return db.query(Task).filter(or_(Task.user_id == user.id, Task.assigned_to == user.id))


def open_tasks(db: Session, user: User) -> list[Task]:
    return _visible(db, user).filter(Task.status != "completed").order_by(Task.due_date, Task.id).all()


def done_on(db: Session, user: User, day: date, clock: Clock) -> list[Task]:
    start = clock.start_of(day)
    return (
        _visible(db, user)
        .filter(
            Task.status == "completed",
            Task.completed_at >= start,
            Task.completed_at < clock.start_of(day + timedelta(days=1)),
        )
        .order_by(Task.completed_at, Task.id)
        .all()
    )


# ---------- Small helpers ----------
def estimate(task: Task) -> int:
    return task.estimate_minutes or DEFAULT_ESTIMATE_MINUTES


def is_exam(task: Task) -> bool:
    # Exams are events on the calendar, not work that fills a study day
    return task.kind == "exam"


def load_minutes(tasks: list[Task]) -> int:
    return sum(estimate(t) for t in tasks if t.status != "completed" and not is_exam(t))


def _load(minutes: int, capacity: int) -> dict:
    return {"load_minutes": minutes, "capacity_minutes": capacity, "over_capacity": minutes > capacity}


def _read(tasks: list[Task]) -> list[TaskRead]:
    return [TaskRead.model_validate(t) for t in tasks]


def day_label(day: date, clock: Clock) -> str:
    offset = (day - clock.today).days
    if offset == 0:
        return "today"
    if offset == 1:
        return "tomorrow"
    if offset == -1:
        return "yesterday"
    return f"{day:%a} {day.day} {day:%b}"


def when_label(moment: datetime, clock: Clock) -> str:
    local = moment.astimezone(clock.tz)
    return f"{day_label(local.date(), clock)} {local:%H:%M}"


def _span(delta: timedelta) -> str:
    hours = int(delta.total_seconds() // 3600)
    if hours < 1:
        return f"{max(int(delta.total_seconds() // 60), 1)} min"
    if hours < 48:
        return f"{hours} h"
    return f"{hours // 24} days"


# ---------- Today / week ----------
def today_plan(db: Session, user: User, now: datetime | None = None) -> TodayPlan:
    clock = clock_for(user, now)
    today = clock.today
    tasks = open_tasks(db, user)
    exam_end = clock.start_of(today + timedelta(days=EXAM_LOOKAHEAD_DAYS + 1))
    planned = [t for t in tasks if t.planned_for == today]
    return TodayPlan(
        date=today,
        timezone=clock.tz.key,
        planned=_read(planned),
        slipped=_read([t for t in tasks if t.planned_for is not None and t.planned_for < today]),
        overdue=_read([t for t in tasks if t.due_date < clock.now]),
        due_soon=_read([t for t in tasks if clock.now <= t.due_date <= clock.now + DUE_SOON]),
        exams=_read([t for t in tasks if is_exam(t) and clock.now <= t.due_date < exam_end]),
        load=Load(**_load(load_minutes(planned), user.daily_capacity_minutes)),
    )


def week_plan(db: Session, user: User, start: date | None = None, now: datetime | None = None) -> WeekPlan:
    clock = clock_for(user, now)
    start = start or clock.today
    days = [start + timedelta(days=i) for i in range(PLAN_DAYS)]
    end = days[-1]
    tasks = (
        _visible(db, user)
        .filter(or_(Task.status != "completed", Task.planned_for.between(start, end)))
        .order_by(Task.due_date, Task.id)
        .all()
    )
    open_ = [t for t in tasks if t.status != "completed"]
    day_plans = []
    for day in days:
        planned = [t for t in tasks if t.planned_for == day]
        day_plans.append(
            DayPlan(
                date=day,
                tasks=_read(planned),
                due=_read([t for t in open_ if clock.day_of(t.due_date) == day]),
                **_load(load_minutes(planned), user.daily_capacity_minutes),
            )
        )
    return WeekPlan(
        start=start,
        timezone=clock.tz.key,
        days=day_plans,
        harbour=_read([t for t in open_ if t.planned_for is None]),
    )


# ---------- What now? ----------
def _upcoming_exams_by_course(tasks: list[Task], clock: Clock) -> dict[str, Task]:
    horizon = clock.start_of(clock.today + timedelta(days=EXAM_LOOKAHEAD_DAYS + 1))
    exams: dict[str, Task] = {}
    for t in tasks:
        if is_exam(t) and t.course and clock.now <= t.due_date < horizon:
            exams.setdefault(t.course.casefold(), t)
    return exams


def _score(task: Task, clock: Clock, exams: dict[str, Task]) -> tuple[int, list[str]]:
    score, reasons = 0, []
    until_due = task.due_date - clock.now
    if until_due < timedelta(0):
        score += SCORE_OVERDUE
        reasons.append(f"overdue by {_span(-until_due)}")
    elif until_due <= timedelta(hours=24):
        score += SCORE_DUE_24H
        reasons.append(f"due within 24 h ({when_label(task.due_date, clock)})")
    elif until_due <= timedelta(hours=72):
        score += SCORE_DUE_72H
        reasons.append(f"due within 3 days ({when_label(task.due_date, clock)})")
    elif until_due <= timedelta(days=7):
        score += SCORE_DUE_7D
        reasons.append(f"due this week ({when_label(task.due_date, clock)})")

    if task.planned_for == clock.today:
        score += SCORE_PLANNED_TODAY
        reasons.append("planned for today")
    elif task.planned_for is not None and task.planned_for < clock.today:
        score += SCORE_SLIPPED
        reasons.append(f"slipped from {day_label(task.planned_for, clock)}")

    if task.status == "in_progress":
        score += SCORE_IN_PROGRESS
        reasons.append("already in progress")

    exam = exams.get(task.course.casefold()) if task.kind == "revision" and task.course else None
    if exam is not None:
        score += SCORE_REVISION_FOR_EXAM
        reasons.append(f"revision for the {exam.course} exam {when_label(exam.due_date, clock)}")

    if not reasons:
        reasons.append(f"next deadline: {when_label(task.due_date, clock)}")
    return score, reasons


def rank(tasks: list[Task], clock: Clock) -> list[tuple[Task, int, list[str]]]:
    exams = _upcoming_exams_by_course(tasks, clock)
    scored = [(t, *_score(t, clock, exams)) for t in tasks if t.status != "completed" and not is_exam(t)]
    scored.sort(key=lambda item: (-item[1], item[0].due_date, item[0].id))
    return scored


def next_up(db: Session, user: User, limit: int = 3, now: datetime | None = None) -> list[Suggestion]:
    clock = clock_for(user, now)
    return [
        Suggestion(task=TaskRead.model_validate(t), score=score, reasons=reasons)
        for t, score, reasons in rank(open_tasks(db, user), clock)[:limit]
    ]


# ---------- Planning the week ----------
def propose_week(db: Session, user: User, start: date | None = None, now: datetime | None = None) -> PlanProposal:
    """Spread unplanned and slipped work over the week. Proposes only; writes nothing."""
    clock = clock_for(user, now)
    today = clock.today
    start = start or today
    if start < today:
        raise PlannerError("The plan can't start in the past")
    days = [start + timedelta(days=i) for i in range(PLAN_DAYS)]
    end = days[-1]
    capacity = user.daily_capacity_minutes

    tasks = open_tasks(db, user)
    loads = {day: 0 for day in days}
    for t in tasks:
        if t.planned_for in loads and not is_exam(t):
            loads[t.planned_for] += estimate(t)

    candidates = [
        t
        for t in tasks
        if not is_exam(t)
        and (t.planned_for is None or t.planned_for < today)
        and t.due_date <= clock.now + PLAN_HORIZON
    ]
    moves = []
    for t in candidates:
        minutes = estimate(t)
        last_day = min(max(clock.day_of(t.due_date), start), end)
        window = [d for d in days if d <= last_day]
        chosen = next((d for d in window if loads[d] + minutes <= capacity), None)
        over = chosen is None
        if over:
            chosen = min(window, key=lambda d: (loads[d], d))
        loads[chosen] += minutes

        origin = f"Slipped from {day_label(t.planned_for, clock)}" if t.planned_for else "Not planned yet"
        where = f"{day_label(chosen, clock)} ({loads[chosen]}/{capacity} min)"
        if over:
            reason = f"{origin}; due {when_label(t.due_date, clock)}. No day before the deadline has room, so it goes on the lightest day, {where}, over capacity."
        else:
            reason = f"{origin}; due {when_label(t.due_date, clock)}. Earliest day with room: {where}."
        moves.append(
            ProposedMove(
                task_id=t.id,
                title=t.title,
                previously_planned_for=t.planned_for,
                planned_for=chosen,
                due_date=TaskRead.model_validate(t).model_dump(mode="json")["due_date"],
                estimate_minutes=minutes,
                reason=reason,
                over_capacity=over,
            )
        )

    return PlanProposal(
        start=start,
        end=end,
        timezone=clock.tz.key,
        capacity_minutes=capacity,
        moves=moves,
        days=[DayLoad(date=d, **_load(loads[d], capacity)) for d in days],
    )


def apply_moves(db: Session, user: User, moves: list[tuple[int, date]], now: datetime | None = None) -> list[Task]:
    """Set planned_for on each task, all or nothing."""
    clock = clock_for(user, now)
    if any(day < clock.today for _, day in moves):
        raise PlannerError("Tasks can't be planned for a day that has already passed")
    ids = [task_id for task_id, _ in moves]
    tasks = {t.id: t for t in _visible(db, user).filter(Task.id.in_(ids)).all()}
    missing = [task_id for task_id in ids if task_id not in tasks]
    if missing:
        raise LookupError(f"Task(s) not found: {', '.join(map(str, missing))}")
    for task_id, day in moves:
        tasks[task_id].planned_for = day
    db.commit()
    updated = [tasks[task_id] for task_id in ids]
    for t in updated:
        db.refresh(t)
    return updated
