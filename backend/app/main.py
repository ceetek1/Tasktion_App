import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.tasks import router as tasks_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.users import router as users_router
from app.services.scheduler import configure_scheduler, scheduler
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: start scheduler on startup, stop on shutdown."""
    configure_scheduler()
    scheduler.start()
    logger.info("Application started")
    yield
    scheduler.shutdown(wait=True)
    logger.info("Application shutdown")


app = FastAPI(lifespan=lifespan)

# Parse allowed origins from env var (comma-separated), defaulting to localhost
allowed_origins = getattr(settings, "ALLOWED_ORIGINS", None)
if allowed_origins:
    origins = [o.strip() for o in allowed_origins.split(",")]
else:
    origins = ["http://127.0.0.1:3000", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)
