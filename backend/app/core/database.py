from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _database_url() -> str:
    if settings.DATABASE_URL:
        database_url = settings.DATABASE_URL
        if database_url.startswith("postgres://"):
            return database_url.replace("postgres://", "postgresql+psycopg2://", 1)
        if database_url.startswith("postgresql://"):
            return database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return database_url

    return str(
        URL.create(
            "postgresql+psycopg2",
            username=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            database=settings.POSTGRES_DB,
        )
    )


DATABASE_URL = _database_url()


def _connect_args(database_url: str) -> dict:
    # Supabase only accepts SSL connections
    url = make_url(database_url)
    host = url.host or ""
    if host.endswith((".supabase.co", ".supabase.com")) and "sslmode" not in url.query:
        return {"sslmode": "require"}
    return {}


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args=_connect_args(DATABASE_URL),
)


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
