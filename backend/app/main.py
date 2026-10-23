import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import engine
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.services.scheduler import configure_scheduler, scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: start scheduler on startup, stop on shutdown."""
    if configure_scheduler() and not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")
    logger.info("Application started")
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
    logger.info("Application shutdown")


app = FastAPI(title="Tasktion API", lifespan=lifespan)


def parse_allowed_origins(raw_origins: str) -> list[str]:
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


origins = parse_allowed_origins(settings.ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


@app.get("/health/db", tags=["health"])
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.warning("Database health check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/pages/login.html")


frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
