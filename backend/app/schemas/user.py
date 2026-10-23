from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    id: int
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    model_config = ConfigDict(from_attributes=True)
