from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.task import Task
from app.services import scheduler as scheduler_module


def _add_task(owner_id, hours, assigned_to=None, status="pending"):
    db = SessionLocal()
    task = Task(
        title="Due soon",
        due_date=datetime.now(timezone.utc) + timedelta(hours=hours),
        user_id=owner_id,
        assigned_to=assigned_to,
        status=status,
    )
    db.add(task)
    db.commit()
    task_id = task.id
    db.close()
    return task_id


def _enable_email(monkeypatch):
    for key, value in {
        "SMTP_HOST": "smtp.test",
        "SMTP_USER": "user",
        "SMTP_PASSWORD": "pass",
    }.items():
        monkeypatch.setattr(settings, key, value)
    sent = []
    monkeypatch.setattr(scheduler_module, "send_email", lambda to, subject, body: sent.append(to) or True)
    return sent


def test_reminder_sent_once_to_assignee(monkeypatch, member, other_member):
    sent = _enable_email(monkeypatch)
    _add_task(member["id"], hours=5, assigned_to=other_member["id"])

    scheduler_module.send_reminders()
    scheduler_module.send_reminders()

    assert sent == ["other@example.com"]


def test_reminder_goes_to_owner_when_unassigned(monkeypatch, member):
    sent = _enable_email(monkeypatch)
    _add_task(member["id"], hours=5)
    scheduler_module.send_reminders()
    assert sent == ["member@example.com"]


def test_no_reminder_for_far_or_completed_tasks(monkeypatch, member):
    sent = _enable_email(monkeypatch)
    _add_task(member["id"], hours=72)
    _add_task(member["id"], hours=5, status="completed")
    scheduler_module.send_reminders()
    assert sent == []


def test_failed_send_is_retried(monkeypatch, member):
    _enable_email(monkeypatch)
    monkeypatch.setattr(scheduler_module, "send_email", lambda *a: False)
    task_id = _add_task(member["id"], hours=5)
    scheduler_module.send_reminders()
    db = SessionLocal()
    assert db.get(Task, task_id).reminder_sent_at is None
    db.close()


def test_job_is_scheduled_not_paused(monkeypatch):
    monkeypatch.setattr(settings, "SCHEDULER_ENABLED", True)
    assert scheduler_module.configure_scheduler()
    job = scheduler_module.scheduler.get_job("send_reminders")
    assert job is not None
    assert job.next_run_time is not None
    scheduler_module.scheduler.remove_job("send_reminders")


def test_cron_endpoint_needs_secret(client, monkeypatch, member):
    sent = _enable_email(monkeypatch)
    _add_task(member["id"], hours=5)
    monkeypatch.setattr(settings, "CRON_SECRET", "")
    assert client.post("/cron/reminders", headers={"Authorization": "Bearer "}).status_code == 401

    monkeypatch.setattr(settings, "CRON_SECRET", "s3cret")
    assert client.post("/cron/reminders").status_code == 401
    assert client.post("/cron/reminders", headers={"Authorization": "Bearer wrong"}).status_code == 401

    r = client.post("/cron/reminders", headers={"Authorization": "Bearer s3cret"})
    assert r.status_code == 200
    assert r.json() == {"email_enabled": True, "due_soon": 1, "sent": 1}
    assert sent == ["member@example.com"]


def test_scheduler_off_on_vercel(monkeypatch):
    from app.core.config import Settings
    monkeypatch.setenv("VERCEL", "1")
    assert Settings(SCHEDULER_ENABLED=True).SCHEDULER_ENABLED is False
