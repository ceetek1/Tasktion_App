from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from pathlib import Path

class Settings(BaseSettings):
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    MAILTRAP_HOST: str
    MAILTRAP_PORT: int
    MAILTRAP_USER: str
    MAILTRAP_PASSWORD: str
    ADMIN_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env"
    )

    @model_validator(mode="after")
    def validate_secret_key(self):
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long. "
                "Do not use the placeholder value in production."
            )
        return self

settings = Settings()
