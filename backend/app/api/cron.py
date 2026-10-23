import secrets

from fastapi import APIRouter, Header, HTTPException
from app.core.config import settings
from app.services.scheduler import send_reminders

router = APIRouter()


@router.post("/cron/reminders", include_in_schema=False)
def run_reminders(authorization: str = Header("")):
    """Hourly reminder check, called by the GitHub Actions schedule with CRON_SECRET."""
    expected = f"Bearer {settings.CRON_SECRET}"
    if not settings.CRON_SECRET or not secrets.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return send_reminders()
