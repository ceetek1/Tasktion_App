from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


def configure_scheduler():
    """Register scheduled jobs. Called during FastAPI startup."""
    # Example: scheduler.add_job(send_reminders, 'cron', hour=8)
    pass
