from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AccessTokenCreate(BaseModel):
    name: str = Field("Claude Desktop", min_length=1, max_length=80)


class AccessTokenRead(BaseModel):
    id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AccessTokenCreated(AccessTokenRead):
    # Shown once, at creation; only its hash is stored
    token: str
