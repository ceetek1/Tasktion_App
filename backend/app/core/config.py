from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_SECRET_KEY = "change-me-development-secret-key-32-characters-minimum"


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str | None = None
    POSTGRES_DB: str = "taskflow_db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    MAILTRAP_HOST: str = ""
    MAILTRAP_PORT: int = 2525
    MAILTRAP_USER: str = ""
    MAILTRAP_PASSWORD: str = ""
    ADMIN_SECRET: str = ""
    ALLOWED_ORIGINS: str = (
        "http://127.0.0.1:3000,http://localhost:3000,"
        "http://127.0.0.1:8000,http://localhost:8000"
    )
    SCHEDULER_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_secret_key(self):
        is_production = self.ENVIRONMENT.lower() in {"prod", "production"}
        uses_default_secret = self.SECRET_KEY == DEFAULT_SECRET_KEY
        if len(self.SECRET_KEY) < 32 or (is_production and uses_default_secret):
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long and must be "
                "set explicitly when ENVIRONMENT=production."
            )
        return self

    @property
    def email_enabled(self) -> bool:
        return all(
            [
                self.MAILTRAP_HOST,
                self.MAILTRAP_PORT,
                self.MAILTRAP_USER,
                self.MAILTRAP_PASSWORD,
            ]
        )


settings = Settings()
