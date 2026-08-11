import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import SessionLocal
from app.models.task import Task
from app.models.user import User
from app.services.email_service import send_email

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def send_reminders():
    """Query tasks due within 24 hours and send email reminders to owners."""
    now = datetime.now(timezone.utc)
    reminder_window = now + timedelta(hours=24)

    db = SessionLocal()
    try:
        due_soon_tasks = (
            db.query(Task)
            .filter(
                Task.due_date <= reminder_window,
                Task.due_date >= now,
                Task.status != "completed",
            )
            .all()
        )

        for task in due_soon_tasks:
            user = db.query(User).filter(User.id == task.user_id).first()
            if user:
                subject = f"Task reminder: {task.title} is due soon"
                body = (
                    f"Hi,\n\n"
                    f"This is a reminder that your task '{task.title}' "
                    f"is due on {task.due_date.strftime('%Y-%m-%d at %H:%M')}.\n\n"
                    f"Description: {task.description or 'No description'}\n\n"
                    f"Log in to Tasktion to manage your tasks."
                )
                success = send_email(user.email, subject, body)
                if success:
                    logger.info("Reminder sent to %s for task '%s'", user.email, task.title)
                else:
                    logger.warning("Failed to send reminder to %s for task '%s'", user.email, task.title)

        logger.info("Reminder check complete. %d task(s) due soon.", len(due_soon_tasks))
    except Exception:
        logger.exception("Error during scheduled reminder check")
    finally:
        db.close()


def configure_scheduler():
    """Register scheduled jobs. Called during FastAPI startup."""
    scheduler.add_job(send_reminders, "interval", hours=6, next_run_time=None)
    logger.info("Scheduler configured: send_reminders runs every 6 hours")
