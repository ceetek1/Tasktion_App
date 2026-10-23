from datetime import datetime

from pydantic import BaseModel


class InviteCreated(BaseModel):
    url: str
    expires_at: datetime


class InviteStatus(BaseModel):
    valid: bool
    invited_by: str | None = None
