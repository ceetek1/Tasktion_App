"""Tasktion planner for Claude Desktop: a local MCP server over stdio.

It talks to your Tasktion API with a personal access token. Set:
  TASKTION_URL    the Tasktion address, e.g. https://your-app.up.railway.app
  TASKTION_TOKEN  a token from the dashboard's "Connect Claude Desktop" button (tsk_…)

Run: python tasktion_mcp/server.py   (Claude Desktop starts it for you)
"""

import logging
import os
import sys
from datetime import date, datetime, time
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from pydantic import BaseModel, Field
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

TIMEOUT = httpx.Timeout(20.0, connect=10.0)
Kind = Literal["task", "assignment", "exam", "reading", "revision", "study"]

INSTRUCTIONS = """\
Tasktion is the user's personal academic planner. Its tasks are assignments, exams, readings,
revision and study sessions, each with a due time, optional course, kind, estimate and planned day.
All dates and times are in the user's own timezone (see get_settings).

Rules:
- Adding, completing, updating or moving a single task: just do it, then say what changed.
- plan_week only proposes. Show the user the proposed moves (day, task, reason, over-capacity
  warnings) and ask. Call apply_plan only after the user clearly says yes, with exactly the moves they
  approved.
- delete_task: confirm the exact task (title and due time) and get an explicit yes first. Prefer
  complete_task when the work is done.
- Exams are events, not study blocks; suggest revision sessions for them instead.
"""


mcp = MCPServer("Tasktion", instructions=INSTRUCTIONS)

READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=False)
WRITES = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)
IDEMPOTENT_WRITE = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False
)
DESTRUCTIVE = ToolAnnotations(read_only_hint=False, destructive_hint=True, open_world_hint=False)


# ---------- Talking to Tasktion ----------
def _config() -> tuple[str, str]:
    url = os.environ.get("TASKTION_URL", "").strip().rstrip("/")
    token = os.environ.get("TASKTION_TOKEN", "").strip()
    if not url:
        raise ToolError(
            "TASKTION_URL is not set. Add it to the tasktion server's \"env\" in claude_desktop_config.json "
            "(your Tasktion address, e.g. https://your-app.up.railway.app) and restart Claude Desktop."
        )
    if not token.startswith("tsk_"):
        raise ToolError(
            "TASKTION_TOKEN is missing or isn't a Tasktion token (they start with tsk_). Make one with the "
            "dashboard's \"Connect Claude Desktop\" button, put it in claude_desktop_config.json, and restart "
            "Claude Desktop."
        )
    return url, token


def _detail(response: httpx.Response) -> str:
    try:
        detail = response.json().get("detail")
    except ValueError:
        return response.text[:300] or response.reason_phrase
    if isinstance(detail, list):
        # FastAPI validation errors
        return "; ".join(
            f"{'.'.join(str(p) for p in d.get('loc', [])[1:])}: {str(d.get('msg', '')).removeprefix('Value error, ')}"
            for d in detail
        )
    return str(detail)


async def api(method: str, path: str, *, json: Any = None, params: dict | None = None) -> Any:
    url, token = _config()
    try:
        async with httpx.AsyncClient(base_url=url, timeout=TIMEOUT) as client:
            response = await client.request(
                method, path, json=json, params=params, headers={"Authorization": f"Bearer {token}"}
            )
    except httpx.TimeoutException:
        raise ToolError(f"Tasktion at {url} didn't answer in time. It may be waking up; try again in a moment.")
    except httpx.HTTPError as exc:
        raise ToolError(
            f"Can't reach Tasktion at {url} ({exc.__class__.__name__}). Check TASKTION_URL and your connection."
        )

    if response.status_code == 401:
        raise ToolError(
            "Tasktion rejected the token: it is wrong or was revoked. Make a new one with the dashboard's "
            "\"Connect Claude Desktop\" button, update TASKTION_TOKEN in claude_desktop_config.json, and restart "
            "Claude Desktop."
        )
    if response.status_code == 403 and _detail(response) == "invite_required":
        raise ToolError("This Tasktion account isn't in the group any more.")
    if response.status_code >= 400:
        raise ToolError(f"Tasktion said no ({response.status_code}): {_detail(response)}")
    if response.status_code == 204:
        return None
    return response.json()


async def _zone() -> ZoneInfo:
    settings = await api("GET", "/planner/settings")
    try:
        return ZoneInfo(settings["timezone"])
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return ZoneInfo("UTC")


def to_utc_iso(value: str, zone: ZoneInfo) -> str:
    """ISO date or date-time to an aware ISO string. Naive times are in the user's timezone;
    a bare date means the end of that day (23:59)."""
    value = value.strip()
    try:
        if len(value) == 10:
            moment = datetime.combine(date.fromisoformat(value), time(23, 59))
        else:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ToolError(f"Couldn't read {value!r} as a date or time. Use ISO format like 2026-11-20T17:00 or 2026-11-20.")
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=zone)
    return moment.isoformat()


def check_date(value: str) -> str:
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError:
        raise ToolError(f"Couldn't read {value!r} as a day. Use YYYY-MM-DD, like 2026-11-20.")


def check_time(value: str) -> str:
    try:
        parsed = time.fromisoformat(value.strip())
    except ValueError:
        raise ToolError(f"Couldn't read {value!r} as a time. Use 24-hour HH:MM, like 07:30.")
    return parsed.strftime("%H:%M")


# ---------- Reading the plan ----------
@mcp.tool(annotations=READ_ONLY)
async def today() -> dict:
    """Today's plan in the user's timezone: tasks planned for today, slipped ones (planned for an
    earlier day and still open), overdue ones, deadlines in the next 48 hours, exams in the next 7 days,
    and today's load in minutes against the daily capacity (tasks without an estimate count 45 min)."""
    return await api("GET", "/planner/today")


@mcp.tool(annotations=READ_ONLY)
async def week(
    start: Annotated[str | None, Field(description="First day, YYYY-MM-DD. Defaults to today.")] = None,
) -> dict:
    """Seven days of the plan: each day's planned tasks, what falls due that day, and the day's load
    against capacity. Also the unplanned tasks: open tasks not planned for any day yet."""
    params = {"start": check_date(start)} if start else None
    return await api("GET", "/planner/week", params=params)


@mcp.tool(annotations=READ_ONLY)
async def what_now(
    limit: Annotated[int, Field(ge=1, le=10, description="How many suggestions.")] = 3,
) -> dict:
    """What to work on next, ranked, each with plain reasons (overdue, due soon, planned for today,
    slipped, in progress, revision for an exam this week). Exams themselves are never suggested. Use this
    for "what should I do now?" and explain the reasons to the user."""
    return await api("GET", "/planner/next", params={"limit": limit})


# ---------- Changing single tasks (no confirmation needed) ----------
@mcp.tool(annotations=WRITES)
async def add_task(
    title: Annotated[str, Field(min_length=1, max_length=200)],
    due: Annotated[
        str,
        Field(
            description="When it's due, ISO format in the user's local time: 2026-11-20T17:00, or 2026-11-20 "
            "for the end of that day. Must be in the future."
        ),
    ],
    course: Annotated[str | None, Field(max_length=80, description="Course or module, e.g. 'Biology 101'.")] = None,
    kind: Kind = "task",
    planned_for: Annotated[str | None, Field(description="Day to work on it, YYYY-MM-DD.")] = None,
    estimate_minutes: Annotated[int | None, Field(gt=0, le=1440, description="How long it should take.")] = None,
    description: str | None = None,
) -> dict:
    """Add a task to the planner. Use kind 'exam' for exams, 'revision' for revising for one
    (give it the same course so it gets prioritised before the exam), 'reading', 'assignment' or 'study'
    for the rest. Do it straight away; no confirmation needed."""
    zone = await _zone()
    body = {
        "title": title,
        "due_date": to_utc_iso(due, zone),
        "kind": kind,
        "course": course,
        "description": description,
        "estimate_minutes": estimate_minutes,
        "planned_for": check_date(planned_for) if planned_for else None,
    }
    return await api("POST", "/tasks", json=body)


@mcp.tool(annotations=IDEMPOTENT_WRITE)
async def complete_task(task_id: int) -> dict:
    """Mark a task as done. Do it straight away when the user says they finished something."""
    return await api("PATCH", f"/tasks/{task_id}", json={"status": "completed"})


@mcp.tool(annotations=IDEMPOTENT_WRITE)
async def update_task(
    task_id: int,
    title: Annotated[str | None, Field(min_length=1, max_length=200)] = None,
    due: Annotated[str | None, Field(description="New due time, ISO, user's local time (see add_task).")] = None,
    planned_for: Annotated[
        str | None, Field(description="Reschedule: the day to work on it, YYYY-MM-DD.")
    ] = None,
    unplan: Annotated[bool, Field(description="True to take it off the plan (no planned day).")] = False,
    status: Literal["pending", "in_progress", "completed"] | None = None,
    course: Annotated[str | None, Field(max_length=80)] = None,
    kind: Kind | None = None,
    estimate_minutes: Annotated[int | None, Field(gt=0, le=1440)] = None,
    description: str | None = None,
) -> dict:
    """Change one task: rename it, move its deadline, reschedule it to another day (planned_for), take it
    off the plan (unplan), start it (status in_progress), or change course, kind, estimate or notes. Only
    the fields given change. A single move like this needs no confirmation; to move many tasks at once,
    use plan_week and apply_plan."""
    body: dict[str, Any] = {}
    if due is not None:
        body["due_date"] = to_utc_iso(due, await _zone())
    if planned_for is not None and unplan:
        raise ToolError("Give either planned_for or unplan, not both.")
    if planned_for is not None:
        body["planned_for"] = check_date(planned_for)
    if unplan:
        body["planned_for"] = None
    for key, value in {
        "title": title,
        "status": status,
        "course": course,
        "kind": kind,
        "estimate_minutes": estimate_minutes,
        "description": description,
    }.items():
        if value is not None:
            body[key] = value
    if not body:
        raise ToolError("Nothing to change: give at least one field.")
    return await api("PATCH", f"/tasks/{task_id}", json=body)


@mcp.tool(annotations=DESTRUCTIVE)
async def delete_task(task_id: int) -> str:
    """Delete a task for good; this can't be undone. BEFORE calling this, tell the user exactly which
    task (title and due time) will be deleted and get their explicit yes in this conversation. If the
    work was simply finished, use complete_task instead."""
    task = await api("GET", f"/tasks/{task_id}")
    await api("DELETE", f"/tasks/{task_id}")
    return f"Deleted task {task_id}: {task['title']}"


# ---------- Planning the week ----------
@mcp.tool(annotations=READ_ONLY)
async def plan_week(
    start: Annotated[str | None, Field(description="First day of the plan, YYYY-MM-DD. Defaults to today.")] = None,
) -> dict:
    """Propose a plan for the next 7 days. Changes nothing. Unplanned and slipped open tasks due within
    14 days go on the earliest day before their deadline that fits under the daily capacity, otherwise on
    the lightest day flagged over_capacity. Show the user every proposed move (task, day, reason) and
    the day loads, mention over-capacity days, and ask whether to apply it. Only call apply_plan after
    an explicit yes. In the evening, consider starting from tomorrow."""
    return await api("POST", "/planner/plan-week", json={"start": check_date(start)} if start else {})


class PlanMove(BaseModel):
    task_id: int
    planned_for: Annotated[str, Field(description="YYYY-MM-DD")]


@mcp.tool(annotations=DESTRUCTIVE)
async def apply_plan(moves: Annotated[list[PlanMove], Field(min_length=1, max_length=100)]) -> dict:
    """Write a week plan: set the planned day of each task, all or nothing. ONLY call this after showing
    the user the proposal from plan_week and getting their explicit yes in this conversation. Send exactly
    the moves they approved (drop or change any they asked to)."""
    body = {"moves": [{"task_id": m.task_id, "planned_for": check_date(m.planned_for)} for m in moves]}
    return await api("POST", "/planner/apply-plan", json=body)


# ---------- Settings ----------
@mcp.tool(annotations=READ_ONLY)
async def get_settings() -> dict:
    """The user's planner settings: timezone, daily study capacity in minutes, whether briefing emails
    are on, and the local times of the morning and evening briefings."""
    return await api("GET", "/planner/settings")


@mcp.tool(annotations=IDEMPOTENT_WRITE)
async def update_settings(
    timezone: Annotated[str | None, Field(description="IANA name, e.g. 'Europe/London'.")] = None,
    daily_capacity_minutes: Annotated[int | None, Field(ge=15, le=1440)] = None,
    briefings_enabled: Annotated[bool | None, Field(description="Turn the morning/evening emails on or off.")] = None,
    morning_at: Annotated[str | None, Field(description="Morning briefing, 24-hour HH:MM local time.")] = None,
    evening_at: Annotated[str | None, Field(description="Evening briefing, 24-hour HH:MM local time.")] = None,
) -> dict:
    """Change planner settings. Only the fields given change."""
    body: dict[str, Any] = {}
    if timezone is not None:
        body["timezone"] = timezone
    if daily_capacity_minutes is not None:
        body["daily_capacity_minutes"] = daily_capacity_minutes
    if briefings_enabled is not None:
        body["briefings_enabled"] = briefings_enabled
    if morning_at is not None:
        body["morning_at"] = check_time(morning_at)
    if evening_at is not None:
        body["evening_at"] = check_time(evening_at)
    if not body:
        raise ToolError("Nothing to change: give at least one setting.")
    return await api("PATCH", "/planner/settings", json=body)


# ---------- Prompts ----------
@mcp.prompt()
def morning_briefing() -> str:
    """Start the day: today's plan and what to do first."""
    return (
        "Give me my morning briefing from Tasktion. Call today and what_now, then tell me in a few short "
        "lines: what's planned today and whether it fits my capacity, anything slipped or overdue, deadlines "
        "in the next 48 hours, exams this week, and the first thing to start with and why. If today is over "
        "capacity or empty, suggest moves, but don't change anything until I say so."
    )


@mcp.prompt()
def evening_review() -> str:
    """End the day: what got done, what rolls over, and tomorrow's start."""
    return (
        "Let's do my evening review in Tasktion. Call today and week. Tell me what I finished today, what's "
        "still open from today's plan, and what I should start with tomorrow. Ask me which open tasks I "
        "actually finished and mark those complete. Then offer to replan from tomorrow with plan_week, show "
        "me the proposal, and apply it only if I say yes."
    )


@mcp.prompt()
def weekly_plan() -> str:
    """Plan the next seven days around deadlines and exams."""
    return (
        "Help me plan my week in Tasktion. Call week and get_settings first. Ask me about anything missing: "
        "new assignments, exams or readings (add them with add_task, with course, kind and an estimate), "
        "and whether my daily capacity is right. Then call plan_week, show me the proposed moves day by day "
        "with the reasons and any over-capacity days, and wait for my yes before calling apply_plan."
    )


def main() -> None:
    # httpx logs every request at INFO; keep Claude Desktop's log to what matters
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if not os.environ.get("TASKTION_URL") or not os.environ.get("TASKTION_TOKEN"):
        # stdout is the MCP channel; warnings go to stderr, which Claude Desktop keeps in its logs
        print(
            "tasktion_mcp: TASKTION_URL and TASKTION_TOKEN should both be set; tools will explain what's missing.",
            file=sys.stderr,
        )
    mcp.run()


if __name__ == "__main__":
    main()
