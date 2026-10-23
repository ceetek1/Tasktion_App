import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str | None = None
    POSTGRES_DB: str = "taskflow_db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    # Supabase Auth issues the sign-in tokens; the API only verifies them
    SUPABASE_URL: str = ""
    # Public "publishable"/anon key the browser uses to talk to Supabase Auth
    SUPABASE_PUBLISHABLE_KEY: str = ""
    # Legacy HS256 signing secret. Leave blank to verify with the project's JWKS.
    SUPABASE_JWT_SECRET: str = ""
    # Joins the group on first sign-in, so the first member needs no invite
    FIRST_MEMBER_EMAIL: str = ""
    APP_URL: str = "http://localhost:8000"
    INVITE_EXPIRE_DAYS: int = 7
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@tasktion.app"
    ALLOWED_ORIGINS: str = (
        "http://127.0.0.1:3000,http://localhost:3000,"
        "http://127.0.0.1:8000,http://localhost:8000"
    )
    SCHEDULER_ENABLED: bool = True
    # Bearer token the scheduled GitHub Actions workflow sends to /cron/reminders
    CRON_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        extra="ignore",
    )

    @model_validator(mode="after")
    def no_scheduler_on_vercel(self):
        # Vercel stops the process between requests, so the in-process timer would never fire;
        # reminders come from /cron/reminders instead
        if os.environ.get("VERCEL"):
            self.SCHEDULER_ENABLED = False
        return self

    @model_validator(mode="after")
    def validate_auth(self):
        if not self.SUPABASE_URL and not self.SUPABASE_JWT_SECRET:
            raise ValueError(
                "Set SUPABASE_URL (or SUPABASE_JWT_SECRET) so sign-in tokens can be verified."
            )
        return self

    @property
    def app_url(self) -> str:
        return self.APP_URL.rstrip("/")

    @property
    def email_enabled(self) -> bool:
        return all([self.SMTP_HOST, self.SMTP_PORT, self.SMTP_USER, self.SMTP_PASSWORD])


settings = Settings()
