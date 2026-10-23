import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import joinedload
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.task import Task
from app.services.email_service import send_email

logger = logging.getLogger(__name__)

# Runs jobs in a worker thread so blocking DB/SMTP calls never stall the event loop
scheduler = BackgroundScheduler(timezone=timezone.utc)

REMINDER_WINDOW = timedelta(hours=24)
REMINDER_INTERVAL_MINUTES = 60


def send_reminders() -> dict:
    """Email one reminder per task due within 24 hours: to the assignee, else the owner."""
    if not settings.email_enabled:
        logger.info("Email reminders skipped because SMTP is not configured")
        return {"email_enabled": False, "due_soon": 0, "sent": 0}

    now = datetime.now(timezone.utc)
    reminder_window = now + REMINDER_WINDOW

    db = SessionLocal()
    try:
        due_soon_tasks = (
            db.query(Task)
            .options(joinedload(Task.owner), joinedload(Task.assignee))
            .filter(
                Task.due_date <= reminder_window,
                Task.due_date >= now,
                Task.status != "completed",
                Task.reminder_sent_at.is_(None),
            )
            .all()
        )

        sent = 0
        for task in due_soon_tasks:
            recipient = task.assignee or task.owner
            if not recipient:
                continue
            subject = f"Task reminder: {task.title} is due soon"
            body = (
                f"Hi {recipient.display_name or 'there'},\n\n"
                f"This is a reminder that your task '{task.title}' "
                f"is due on {task.due_date.astimezone(timezone.utc).strftime('%Y-%m-%d at %H:%M UTC')}.\n\n"
                f"Description: {task.description or 'No description'}\n\n"
                f"Open Tasktion: {settings.app_url}/pages/dashboard.html"
            )
            if send_email(recipient.email, subject, body):
                task.reminder_sent_at = datetime.now(timezone.utc)
                db.commit()
                sent += 1
                logger.info("Reminder sent to %s for task '%s'", recipient.email, task.title)
            else:
                logger.warning("Failed to send reminder to %s for task '%s'", recipient.email, task.title)

        logger.info(
            "Reminder check complete. %d task(s) due soon, %d reminder(s) sent.",
            len(due_soon_tasks),
            sent,
        )
        return {"email_enabled": True, "due_soon": len(due_soon_tasks), "sent": sent}
    except Exception:
        db.rollback()
        logger.exception("Error during scheduled reminder check")
        raise
    finally:
        db.close()


def configure_scheduler():
    """Register scheduled jobs. Called during FastAPI startup."""
    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler disabled by configuration")
        return False

    scheduler.add_job(
        send_reminders,
        "interval",
        minutes=REMINDER_INTERVAL_MINUTES,
        id="send_reminders",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),
        coalesce=True,
        max_instances=1,
    )
    logger.info("Scheduler configured: send_reminders runs every %d minutes", REMINDER_INTERVAL_MINUTES)
    return True
