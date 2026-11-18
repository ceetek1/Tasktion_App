import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import joinedload
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.task import Task
from app.models.user import User
from app.services.briefings import due_slot, evening_briefing, morning_briefing
from app.services.email_service import send_email
from app.services.planner import clock_for

logger = logging.getLogger(__name__)

# Runs jobs in a worker thread so blocking DB/SMTP calls never stall the event loop
scheduler = BackgroundScheduler(timezone=timezone.utc)

REMINDER_WINDOW = timedelta(hours=24)
REMINDER_INTERVAL_MINUTES = 60
BRIEFING_INTERVAL_MINUTES = 15


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


def send_briefings(now: datetime | None = None) -> dict:
    """Email each member who turned briefings on their morning and evening briefing, once per local day."""
    if not settings.email_enabled:
        logger.info("Briefings skipped because SMTP is not configured")
        return {"email_enabled": False, "sent": 0}

    db = SessionLocal()
    sent = 0
    try:
        users = db.query(User).filter(User.briefings_enabled.is_(True)).order_by(User.id).all()
        for user in users:
            user_id = user.id
            try:
                clock = clock_for(user, now)
                day = due_slot(user.morning_at, user.last_morning_briefing_on, clock)
                if day is not None:
                    subject, body = morning_briefing(db, user, clock)
                    if send_email(user.email, subject, body):
                        user.last_morning_briefing_on = day
                        db.commit()
                        sent += 1
                day = due_slot(user.evening_at, user.last_evening_briefing_on, clock)
                if day is not None:
                    subject, body = evening_briefing(db, user, clock, day)
                    if send_email(user.email, subject, body):
                        user.last_evening_briefing_on = day
                        db.commit()
                        sent += 1
            except Exception:
                # One member's bad data mustn't stop everyone else's briefing
                db.rollback()
                logger.exception("Briefing failed for user %s", user_id)
        logger.info("Briefing check complete. %d briefing(s) sent.", sent)
        return {"email_enabled": True, "sent": sent}
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
    scheduler.add_job(
        send_briefings,
        "interval",
        minutes=BRIEFING_INTERVAL_MINUTES,
        id="send_briefings",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=45),
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Scheduler configured: send_reminders every %d minutes, send_briefings every %d minutes",
        REMINDER_INTERVAL_MINUTES,
        BRIEFING_INTERVAL_MINUTES,
    )
    return True
