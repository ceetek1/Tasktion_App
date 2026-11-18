"""Plain-text morning and evening briefing emails, built from the planner."""
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.task import TaskRead
from app.services import planner
from app.services.planner import Clock

# A briefing goes out once per local day, any time in the 3 hours after its set time
BRIEFING_WINDOW = timedelta(hours=3)


def due_slot(at: time, last_sent: date | None, clock: Clock) -> date | None:
    """The local day whose briefing is due now, or None. Handles windows that cross midnight."""
    local_now = clock.now.astimezone(clock.tz)
    for day in (local_now.date(), local_now.date() - timedelta(days=1)):
        start = datetime.combine(day, at, tzinfo=clock.tz)
        if start <= local_now < start + BRIEFING_WINDOW and last_sent != day:
            return day
    return None


def _name(user: User) -> str:
    return user.display_name or user.email.split("@")[0]


def _minutes(total: int) -> str:
    hours, minutes = divmod(total, 60)
    if hours and minutes:
        return f"{hours} h {minutes} min"
    return f"{hours} h" if hours else f"{minutes} min"


def _line(task: TaskRead, clock: Clock, *, show_due: bool = True) -> str:
    parts = [task.title]
    if task.course:
        parts[0] += f" [{task.course}]"
    if task.kind.value not in ("task", "exam"):
        parts.append(task.kind.value)
    if task.estimate_minutes:
        parts.append(f"~{_minutes(task.estimate_minutes)}")
    if show_due:
        parts.append(f"due {planner.when_label(task.due_date, clock)}")
    return "  - " + " · ".join(parts)


def _section(title: str, lines: list[str]) -> list[str]:
    return [title, *lines, ""] if lines else []


def _footer() -> list[str]:
    return [f"Open Tasktion: {settings.app_url}/pages/dashboard.html"]


def morning_briefing(db: Session, user: User, clock: Clock) -> tuple[str, str]:
    today = planner.today_plan(db, user, now=clock.now)
    suggestions = planner.next_up(db, user, limit=3, now=clock.now)
    load = today.load
    day = f"{today.date:%A} {today.date.day} {today.date:%B}"

    lines = [f"Good morning {_name(user)},", ""]
    lines.append(
        f"{day}: {_minutes(load.load_minutes)} planned of your {_minutes(load.capacity_minutes)}."
        + (" That's more than your daily capacity, so think about moving something." if load.over_capacity else "")
    )
    lines.append("")
    lines += ["TODAY'S PLAN"] + (
        [_line(t, clock) for t in today.planned]
        or ["  Nothing planned yet. Ask Claude to plan your day, or pick from the list below."]
    ) + [""]
    lines += _section("SLIPPED FROM EARLIER DAYS", [_line(t, clock) for t in today.slipped])
    deadlines = today.overdue + [t for t in today.due_soon if t.id not in {o.id for o in today.overdue}]
    lines += _section("DEADLINES (OVERDUE OR WITHIN 48 HOURS)", [_line(t, clock) for t in deadlines])
    lines += _section(
        "WHAT TO DO FIRST",
        [f"  {i}. {s.task.title}: {'; '.join(s.reasons)}" for i, s in enumerate(suggestions, 1)],
    )
    lines += _section(
        "EXAMS THIS WEEK",
        [f"  - {t.title}{f' [{t.course}]' if t.course else ''}: {planner.when_label(t.due_date, clock)}" for t in today.exams],
    )
    lines += _footer()

    count = len(today.planned)
    subject = f"Today: {count} {'task' if count == 1 else 'tasks'} planned ({_minutes(load.load_minutes)})"
    return subject, "\n".join(lines)


def evening_briefing(db: Session, user: User, clock: Clock, day: date) -> tuple[str, str]:
    done = [TaskRead.model_validate(t) for t in planner.done_on(db, user, day, clock)]
    open_tasks = planner.open_tasks(db, user)
    rolling = [TaskRead.model_validate(t) for t in open_tasks if t.planned_for == day]
    tomorrow = day + timedelta(days=1)
    planned_tomorrow = planner.rank([t for t in open_tasks if t.planned_for == tomorrow], clock)
    ranked = planned_tomorrow or planner.rank(open_tasks, clock)

    lines = [f"Good evening {_name(user)},", ""]
    lines += ["DONE TODAY"] + ([_line(t, clock, show_due=False) for t in done] or ["  Nothing ticked off today."]) + [""]
    lines += _section("ROLLING OVER (planned today, still open)", [_line(t, clock) for t in rolling])
    if ranked:
        first, _, reasons = ranked[0]
        heading = "FIRST THING TOMORROW" if planned_tomorrow else "NOTHING PLANNED FOR TOMORROW YET. TOP SUGGESTION"
        lines += [heading, f"  - {first.title}: {'; '.join(reasons)}", ""]
    lines += [
        "Want to replan? Ask Claude in Claude Desktop to \"replan my week\". It shows the proposed moves",
        "and changes nothing until you say yes.",
        "",
    ]
    lines += _footer()

    subject = f"Evening review: {len(done)} done, {len(rolling)} rolling over"
    return subject, "\n".join(lines)
