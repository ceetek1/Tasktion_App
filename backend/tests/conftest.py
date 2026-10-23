"""Test setup.

Tests run against a separate Postgres database. Set TEST_DATABASE_URL, or
create `tasktion_test` on the server described by the POSTGRES_* settings.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

TEST_JWT_SECRET = "test-supabase-jwt-secret-with-enough-length"

os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

from jose import jwt  # noqa: E402
from sqlalchemy.engine import URL  # noqa: E402

from app.core.config import settings  # noqa: E402

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or URL.create(
    "postgresql+psycopg2",
    username=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    host=settings.POSTGRES_HOST,
    port=settings.POSTGRES_PORT,
    database="tasktion_test",
).render_as_string(hide_password=False)

# Must be set before app.core.database builds its engine
settings.DATABASE_URL = TEST_DATABASE_URL
settings.SCHEDULER_ENABLED = False
settings.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
settings.FIRST_MEMBER_EMAIL = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.models import invite as _invite_model, task as _task_model  # noqa: E402,F401
from app.models.user import User  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE invites, tasks, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def make_token(email, auth_id=None, name=None, expires_in=timedelta(hours=1), secret=TEST_JWT_SECRET):
    """A token shaped like the ones Supabase Auth issues."""
    claims = {
        "sub": str(auth_id or uuid.uuid4()),
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": datetime.now(timezone.utc) + expires_in,
        "user_metadata": {"full_name": name} if name else {},
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _member(email, name=None):
    auth_id = uuid.uuid4()
    db = SessionLocal()
    user = User(auth_id=auth_id, email=email, display_name=name)
    db.add(user)
    db.commit()
    user_id = user.id
    db.close()
    return {"id": user_id, "headers": auth_headers(make_token(email, auth_id))}


@pytest.fixture
def member():
    return _member("member@example.com", "Member")


@pytest.fixture
def other_member():
    return _member("other@example.com")


@pytest.fixture
def outsider():
    return _member("outsider@example.com")
