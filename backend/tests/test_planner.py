from datetime import date, datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.task import Task
from app.models.user import User
from app.services import planner

# Wednesday 18 November 2026, noon in London (UTC+0 in winter)
NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
TODAY = date(2026, 11, 18)


def _task(owner_id, title, due, **fields):
    db = SessionLocal()
    task = Task(title=title, due_date=due, user_id=owner_id, **fields)
    db.add(task)
    db.commit()
    task_id = task.id
    db.close()
    return task_id


def _set_user(user_id, **fields):
    db = SessionLocal()
    user = db.get(User, user_id)
    for key, value in fields.items():
        setattr(user, key, value)
    db.commit()
    db.close()


def _with_user(user_id, fn, *args, **kwargs):
    db = SessionLocal()
    try:
        return fn(db, db.get(User, user_id), *args, **kwargs)
    finally:
        db.close()


def _ids(tasks):
    return [t.id for t in tasks]


def _planned_for(task_id):
    db = SessionLocal()
    value = db.get(Task, task_id).planned_for
    db.close()
    return value


# ---------- completed_at and task fields ----------
def _future(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def test_completed_at_follows_status(client, member):
    task = client.post("/tasks", json={"title": "Essay", "due_date": _future()}, headers=member["headers"]).json()
    assert task["completed_at"] is None

    done = client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=member["headers"]).json()
    assert done["completed_at"] is not None

    again = client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=member["headers"]).json()
    assert again["completed_at"] == done["completed_at"]

    reopened = client.patch(f"/tasks/{task['id']}", json={"status": "in_progress"}, headers=member["headers"]).json()
    assert reopened["completed_at"] is None


def test_task_planning_fields_round_trip(client, member):
    body = {
        "title": "Read chapter 4",
        "due_date": _future(),
        "course": "  Biology ",
        "kind": "reading",
        "planned_for": "2026-11-20",
        "estimate_minutes": 30,
    }
    task = client.post("/tasks", json=body, headers=member["headers"]).json()
    assert task["course"] == "Biology"
    assert task["kind"] == "reading"
    assert task["planned_for"] == "2026-11-20"
    assert task["estimate_minutes"] == 30

    moved = client.patch(f"/tasks/{task['id']}", json={"planned_for": None}, headers=member["headers"]).json()
    assert moved["planned_for"] is None
    assert moved["kind"] == "reading"


def test_task_planning_fields_validated(client, member):
    for bad in ({"kind": "party"}, {"estimate_minutes": 0}, {"course": "x" * 81}):
        body = {"title": "x", "due_date": _future(), **bad}
        assert client.post("/tasks", json=body, headers=member["headers"]).status_code == 422
    task = client.post("/tasks", json={"title": "x", "due_date": _future()}, headers=member["headers"]).json()
    assert task["kind"] == "task"
    r = client.patch(f"/tasks/{task['id']}", json={"kind": None}, headers=member["headers"])
    assert r.status_code == 422


def test_assignee_may_plan_but_not_edit(client, member, other_member):
    body = {"title": "Group project", "due_date": _future(), "assigned_to": other_member["id"]}
    task = client.post("/tasks", json=body, headers=member["headers"]).json()
    r = client.patch(f"/tasks/{task['id']}", json={"planned_for": "2026-11-20"}, headers=other_member["headers"])
    assert r.status_code == 200
    r = client.patch(f"/tasks/{task['id']}", json={"course": "Maths"}, headers=other_member["headers"])
    assert r.status_code == 403


# ---------- today ----------
def test_today_buckets_and_load(member, other_member):
    uid = member["id"]
    planned = _task(uid, "Planned", NOW + timedelta(days=5), planned_for=TODAY, estimate_minutes=60)
    planned_default = _task(uid, "Planned, no estimate", NOW + timedelta(days=6), planned_for=TODAY)
    slipped = _task(uid, "Slipped", NOW + timedelta(days=4), planned_for=TODAY - timedelta(days=2))
    overdue = _task(uid, "Overdue", NOW - timedelta(hours=3))
    soon = _task(uid, "Due tomorrow", NOW + timedelta(hours=30))
    exam = _task(uid, "Chem exam", NOW + timedelta(days=6), kind="exam", course="Chemistry")
    _task(uid, "Far exam", NOW + timedelta(days=10), kind="exam")
    _task(uid, "Done today", NOW + timedelta(days=1), planned_for=TODAY, status="completed")
    _task(other_member["id"], "Not mine", NOW + timedelta(hours=5), planned_for=TODAY)

    plan = _with_user(uid, planner.today_plan, now=NOW)

    assert plan.date == TODAY
    assert _ids(plan.planned) == [planned, planned_default]
    assert _ids(plan.slipped) == [slipped]
    assert _ids(plan.overdue) == [overdue]
    assert _ids(plan.due_soon) == [soon]
    assert _ids(plan.exams) == [exam]
    assert plan.load.load_minutes == 60 + planner.DEFAULT_ESTIMATE_MINUTES
    assert plan.load.capacity_minutes == 180
    assert plan.load.over_capacity is False


def test_today_uses_member_timezone(member):
    # Noon UTC on the 18th is already 01:00 on the 19th in Auckland
    _set_user(member["id"], timezone="Pacific/Auckland")
    tomorrow_utc = _task(member["id"], "Planned for the 19th", NOW + timedelta(days=3), planned_for=TODAY + timedelta(days=1))
    plan = _with_user(member["id"], planner.today_plan, now=NOW)
    assert plan.date == TODAY + timedelta(days=1)
    assert plan.timezone == "Pacific/Auckland"
    assert _ids(plan.planned) == [tomorrow_utc]


def test_today_endpoint(client, member):
    r = client.get("/planner/today", headers=member["headers"])
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"planned", "slipped", "overdue", "due_soon", "exams", "load"}
    assert client.get("/planner/today").status_code == 401


# ---------- week ----------
def test_week_days_and_unplanned(member):
    uid = member["id"]
    thursday = TODAY + timedelta(days=1)
    on_thursday = _task(uid, "Thursday work", NOW + timedelta(days=4), planned_for=thursday, estimate_minutes=90)
    done_thursday = _task(uid, "Done Thursday", NOW + timedelta(days=4), planned_for=thursday, status="completed")
    unplanned = _task(uid, "Unplanned", NOW + timedelta(days=2))
    _task(uid, "Next week", NOW + timedelta(days=12), planned_for=TODAY + timedelta(days=9))

    week = _with_user(uid, planner.week_plan, now=NOW)

    assert week.start == TODAY
    assert [d.date for d in week.days] == [TODAY + timedelta(days=i) for i in range(7)]
    day = week.days[1]
    assert _ids(day.tasks) == [on_thursday, done_thursday]
    assert day.load_minutes == 90
    assert sum(len(d.tasks) for d in week.days) == 2
    assert _ids(week.unplanned) == [unplanned]
    assert unplanned in _ids(week.days[2].due)


def test_week_endpoint_accepts_start(client, member):
    r = client.get("/planner/week?start=2026-12-01", headers=member["headers"])
    assert r.status_code == 200
    assert r.json()["days"][0]["date"] == "2026-12-01"
    assert len(r.json()["days"]) == 7


# ---------- next ----------
def test_next_ranks_with_reasons(member):
    uid = member["id"]
    far = _task(uid, "Far away", NOW + timedelta(days=20))
    overdue = _task(uid, "Overdue", NOW - timedelta(days=2))
    due_today = _task(uid, "Due tonight", NOW + timedelta(hours=8))
    planned = _task(uid, "Planned today", NOW + timedelta(days=10), planned_for=TODAY)
    _task(uid, "Exam itself", NOW + timedelta(hours=2), kind="exam", course="History")
    revision = _task(uid, "Revise history", NOW + timedelta(days=9), kind="revision", course="history")

    suggestions = _with_user(uid, planner.next_up, limit=10, now=NOW)

    assert [s.task.id for s in suggestions] == [overdue, due_today, revision, planned, far]
    reasons = {s.task.id: s.reasons for s in suggestions}
    assert reasons[overdue] == ["overdue by 2 days"]
    assert reasons[due_today][0].startswith("due within 24 h")
    assert reasons[revision] == ["revision for the History exam today 14:00"]
    assert reasons[planned] == ["planned for today"]
    assert reasons[far][0].startswith("next deadline")


def test_next_combines_reasons(member):
    uid = member["id"]
    task = _task(
        uid, "Lab report", NOW + timedelta(hours=60), planned_for=TODAY - timedelta(days=1), status="in_progress"
    )
    [suggestion] = _with_user(uid, planner.next_up, limit=3, now=NOW)
    assert suggestion.task.id == task
    assert suggestion.score == planner.SCORE_DUE_72H + planner.SCORE_SLIPPED + planner.SCORE_IN_PROGRESS
    assert suggestion.reasons[1:] == ["slipped from yesterday", "already in progress"]


def test_next_endpoint_limit(client, member):
    for i in range(5):
        client.post("/tasks", json={"title": f"t{i}", "due_date": _future(10 + i)}, headers=member["headers"])
    r = client.get("/planner/next?limit=3", headers=member["headers"])
    assert r.status_code == 200
    assert len(r.json()["suggestions"]) == 3
    assert client.get("/planner/next?limit=0", headers=member["headers"]).status_code == 422


# ---------- plan-week / apply-plan ----------
def test_plan_week_fills_earliest_day_with_room(member):
    uid = member["id"]
    _task(uid, "Already today", NOW + timedelta(days=3), planned_for=TODAY, estimate_minutes=150)
    first = _task(uid, "Due Friday", NOW + timedelta(days=2), estimate_minutes=60)
    second = _task(uid, "Due Saturday", NOW + timedelta(days=3), estimate_minutes=60)
    slipped = _task(uid, "Slipped", NOW + timedelta(days=5), planned_for=TODAY - timedelta(days=1), estimate_minutes=120)
    exam = _task(uid, "An exam", NOW + timedelta(days=2), kind="exam")
    too_far = _task(uid, "Due in three weeks", NOW + timedelta(days=21))
    future_planned = _task(uid, "Planned Sunday", NOW + timedelta(days=6), planned_for=TODAY + timedelta(days=4))

    proposal = _with_user(uid, planner.propose_week, now=NOW)

    moves = {m.task_id: m for m in proposal.moves}
    assert set(moves) == {first, second, slipped}
    # Today has 150 of 180 minutes taken, so the 60-minute tasks go to Thursday
    assert moves[first].planned_for == TODAY + timedelta(days=1)
    assert moves[second].planned_for == TODAY + timedelta(days=1)
    assert moves[slipped].planned_for == TODAY + timedelta(days=2)
    assert moves[slipped].previously_planned_for == TODAY - timedelta(days=1)
    assert moves[slipped].reason.startswith("Slipped from yesterday")
    assert not any(m.over_capacity for m in proposal.moves)
    loads = {d.date: d.load_minutes for d in proposal.days}
    assert loads[TODAY] == 150
    assert loads[TODAY + timedelta(days=1)] == 120
    for untouched in (exam, too_far, future_planned):
        assert untouched not in moves
    # A proposal writes nothing
    assert _planned_for(first) is None
    assert _planned_for(slipped) == TODAY - timedelta(days=1)


def test_plan_week_flags_over_capacity_on_lightest_day(member):
    uid = member["id"]
    _set_user(uid, daily_capacity_minutes=60)
    _task(uid, "Busy today", NOW + timedelta(days=1), planned_for=TODAY, estimate_minutes=50)
    _task(uid, "Busy tomorrow", NOW + timedelta(days=2), planned_for=TODAY + timedelta(days=1), estimate_minutes=30)
    big = _task(uid, "Big essay", NOW + timedelta(days=1, hours=6), estimate_minutes=120)

    proposal = _with_user(uid, planner.propose_week, now=NOW)

    [move] = proposal.moves
    assert move.task_id == big
    assert move.over_capacity is True
    assert move.planned_for == TODAY + timedelta(days=1)
    assert "over capacity" in move.reason
    assert next(d for d in proposal.days if d.date == move.planned_for).over_capacity is True


def test_plan_week_rejects_past_start(client, member):
    r = client.post("/planner/plan-week", json={"start": "2020-01-01"}, headers=member["headers"])
    assert r.status_code == 422


def test_plan_week_then_apply(client, member):
    t = client.post(
        "/tasks", json={"title": "Problem set", "due_date": _future(30), "estimate_minutes": 40}, headers=member["headers"]
    ).json()
    proposal = client.post("/planner/plan-week", headers=member["headers"]).json()
    [move] = proposal["moves"]
    assert move["task_id"] == t["id"]

    r = client.post(
        "/planner/apply-plan",
        json={"moves": [{"task_id": move["task_id"], "planned_for": move["planned_for"]}]},
        headers=member["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["updated"][0]["planned_for"] == move["planned_for"]
    assert client.get(f"/tasks/{t['id']}", headers=member["headers"]).json()["planned_for"] == move["planned_for"]


def test_apply_plan_is_all_or_nothing(client, member, other_member):
    mine = client.post("/tasks", json={"title": "Mine", "due_date": _future()}, headers=member["headers"]).json()
    theirs = client.post("/tasks", json={"title": "Theirs", "due_date": _future()}, headers=other_member["headers"]).json()
    day = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()

    r = client.post(
        "/planner/apply-plan",
        json={"moves": [{"task_id": mine["id"], "planned_for": day}, {"task_id": theirs["id"], "planned_for": day}]},
        headers=member["headers"],
    )
    assert r.status_code == 404
    assert client.get(f"/tasks/{mine['id']}", headers=member["headers"]).json()["planned_for"] is None


def test_apply_plan_validation(client, member):
    t = client.post("/tasks", json={"title": "x", "due_date": _future()}, headers=member["headers"]).json()
    day = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    past = client.post(
        "/planner/apply-plan", json={"moves": [{"task_id": t["id"], "planned_for": "2020-01-01"}]}, headers=member["headers"]
    )
    assert past.status_code == 422
    duplicate = client.post(
        "/planner/apply-plan",
        json={"moves": [{"task_id": t["id"], "planned_for": day}, {"task_id": t["id"], "planned_for": day}]},
        headers=member["headers"],
    )
    assert duplicate.status_code == 422
    assert client.post("/planner/apply-plan", json={"moves": []}, headers=member["headers"]).status_code == 422


# ---------- settings ----------
def test_settings_defaults(client, member):
    r = client.get("/planner/settings", headers=member["headers"])
    assert r.json() == {
        "timezone": "UTC",
        "daily_capacity_minutes": 180,
        "briefings_enabled": False,
        "morning_at": "07:30",
        "evening_at": "21:00",
    }


def test_settings_update(client, member):
    r = client.patch(
        "/planner/settings",
        json={"timezone": "Europe/Berlin", "daily_capacity_minutes": 120, "briefings_enabled": True, "morning_at": "06:45"},
        headers=member["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json() == {
        "timezone": "Europe/Berlin",
        "daily_capacity_minutes": 120,
        "briefings_enabled": True,
        "morning_at": "06:45",
        "evening_at": "21:00",
    }


def test_settings_validation(client, member):
    for bad in (
        {"timezone": "Mars/Olympus_Mons"},
        {"timezone": "../etc/passwd"},
        {"timezone": None},
        {"daily_capacity_minutes": 5},
        {"daily_capacity_minutes": 2000},
        {"morning_at": "25:00"},
        {"briefings_enabled": None},
    ):
        r = client.patch("/planner/settings", json=bad, headers=member["headers"])
        assert r.status_code == 422, bad
    assert client.get("/planner/settings", headers=member["headers"]).json()["timezone"] == "UTC"
