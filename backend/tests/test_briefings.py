from datetime import date, datetime, time, timedelta, timezone

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.task import Task
from app.models.user import User
from app.services import scheduler as scheduler_module
from app.services.briefings import due_slot
from app.services.planner import Clock
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
# Wednesday 18 November 2026; London is on UTC+0
DAY = date(2026, 11, 18)


def _at(hour, minute=0, day=DAY):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc)


def _enable_email(monkeypatch):
    for key, value in {"SMTP_HOST": "smtp.test", "SMTP_USER": "user", "SMTP_PASSWORD": "pass"}.items():
        monkeypatch.setattr(settings, key, value)
    sent = []
    monkeypatch.setattr(
        scheduler_module, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True
    )
    return sent


def _set_user(user_id, **fields):
    db = SessionLocal()
    user = db.get(User, user_id)
    for key, value in fields.items():
        setattr(user, key, value)
    db.commit()
    db.close()


def _get_user(user_id):
    db = SessionLocal()
    user = db.get(User, user_id)
    db.expunge(user)
    db.close()
    return user


def _task(owner_id, title, due, **fields):
    db = SessionLocal()
    db.add(Task(title=title, due_date=due, user_id=owner_id, **fields))
    db.commit()
    db.close()


# ---------- timing ----------
def test_due_slot_window():
    at = time(7, 30)
    clock = lambda h, m=0: Clock(now=_at(h, m), tz=LONDON)  # noqa: E731
    assert due_slot(at, None, clock(7, 29)) is None
    assert due_slot(at, None, clock(7, 30)) == DAY
    assert due_slot(at, None, clock(10, 29)) == DAY
    assert due_slot(at, None, clock(10, 30)) is None
    assert due_slot(at, DAY, clock(8, 0)) is None
    assert due_slot(at, DAY - timedelta(days=1), clock(8, 0)) == DAY


def test_due_slot_window_crossing_midnight():
    at = time(23, 0)
    after_midnight = Clock(now=_at(0, 30, DAY + timedelta(days=1)), tz=LONDON)
    assert due_slot(at, None, after_midnight) == DAY
    assert due_slot(at, DAY, after_midnight) is None


def test_due_slot_uses_local_time():
    # 07:30 in New York is 12:30 UTC
    clock = Clock(now=_at(12, 45), tz=ZoneInfo("America/New_York"))
    assert due_slot(time(7, 30), None, clock) == DAY
    assert due_slot(time(7, 30), None, Clock(now=_at(8, 0), tz=ZoneInfo("America/New_York"))) is None


# ---------- sending ----------
def test_briefings_off_by_default(monkeypatch, member):
    sent = _enable_email(monkeypatch)
    scheduler_module.send_briefings(now=_at(8, 0))
    assert sent == []


def test_morning_briefing_sent_once_per_day(monkeypatch, member):
    sent = _enable_email(monkeypatch)
    _set_user(member["id"], briefings_enabled=True, timezone="Europe/London")
    _task(member["id"], "Lab report", _at(17, 0), planned_for=DAY, estimate_minutes=90, course="Chemistry")
    _task(member["id"], "Old reading", _at(12, 0) + timedelta(days=3), planned_for=DAY - timedelta(days=2))
    _task(member["id"], "Physics exam", _at(9, 0) + timedelta(days=2), kind="exam", course="Physics")

    scheduler_module.send_briefings(now=_at(7, 15))
    assert sent == []

    scheduler_module.send_briefings(now=_at(7, 45))
    scheduler_module.send_briefings(now=_at(8, 0))
    scheduler_module.send_briefings(now=_at(9, 30))

    assert len(sent) == 1
    to, subject, body = sent[0]
    assert to == "member@example.com"
    assert subject == "Today: 1 task planned (1 h 30 min)"
    assert "TODAY'S PLAN\n  - Lab report [Chemistry] · ~1 h 30 min · due today 17:00" in body
    assert "SLIPPED FROM EARLIER DAYS\n  - Old reading" in body
    assert "DEADLINES (OVERDUE OR WITHIN 48 HOURS)\n  - Lab report" in body
    assert "WHAT TO DO FIRST\n  1. Lab report: due within 24 h (today 17:00); planned for today" in body
    assert "EXAMS THIS WEEK\n  - Physics exam [Physics]: Fri 20 Nov 09:00" in body
    assert _get_user(member["id"]).last_morning_briefing_on == DAY

    # Next morning it goes out again
    scheduler_module.send_briefings(now=_at(7, 45, DAY + timedelta(days=1)))
    assert len(sent) == 2


def test_evening_briefing(monkeypatch, member):
    sent = _enable_email(monkeypatch)
    _set_user(member["id"], briefings_enabled=True, timezone="Europe/London", last_morning_briefing_on=DAY)
    _task(member["id"], "Done thing", _at(20, 0), planned_for=DAY, status="completed")
    _task(member["id"], "Still open", _at(12, 0) + timedelta(days=4), planned_for=DAY)
    _task(member["id"], "Tomorrow's essay", _at(12, 0) + timedelta(days=2), planned_for=DAY + timedelta(days=1))

    scheduler_module.send_briefings(now=_at(20, 59))
    assert sent == []
    scheduler_module.send_briefings(now=_at(21, 5))
    scheduler_module.send_briefings(now=_at(22, 0))

    assert len(sent) == 1
    _, subject, body = sent[0]
    assert subject == "Evening review: 1 done, 1 rolling over"
    assert "DONE TODAY\n  - Done thing" in body
    assert "ROLLING OVER (planned today, still open)\n  - Still open" in body
    assert "FIRST THING TOMORROW\n  - Tomorrow's essay: due within 3 days" in body
    assert "replan my week" in body
    assert _get_user(member["id"]).last_evening_briefing_on == DAY


def test_failed_send_is_retried_next_run(monkeypatch, member):
    _enable_email(monkeypatch)
    _set_user(member["id"], briefings_enabled=True)
    attempts = []
    monkeypatch.setattr(scheduler_module, "send_email", lambda *a: attempts.append(a) and False)

    scheduler_module.send_briefings(now=_at(7, 45))
    assert _get_user(member["id"]).last_morning_briefing_on is None
    scheduler_module.send_briefings(now=_at(8, 0))
    assert len(attempts) == 2


def test_only_opted_in_members_get_briefings(monkeypatch, member, other_member):
    sent = _enable_email(monkeypatch)
    _set_user(member["id"], briefings_enabled=True)
    scheduler_module.send_briefings(now=_at(7, 45))
    assert [to for to, _, _ in sent] == ["member@example.com"]


def test_briefings_skipped_without_smtp(monkeypatch, member):
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    _set_user(member["id"], briefings_enabled=True)
    assert scheduler_module.send_briefings(now=_at(7, 45)) == {"email_enabled": False, "sent": 0}
