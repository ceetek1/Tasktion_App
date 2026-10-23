"""Test setup.

Tests run against a separate Postgres database. Set TEST_DATABASE_URL, or
create `tasktion_test` on the server described by the POSTGRES_* settings.
"""
import os

os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ADMIN_SECRET"] = "test-admin-secret"

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
settings.ADMIN_SECRET = "test-admin-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.models import task as _task_model, user as _user_model  # noqa: E402,F401
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
        conn.execute(text("TRUNCATE tasks, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _register(client, email, password="password123", admin=False):
    if admin:
        r = client.post(
            "/auth/register-admin",
            json={"email": email, "password": password},
            headers={"x-admin-secret": "test-admin-secret"},
        )
    else:
        r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    token = client.post("/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"id": r.json()["id"], "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def member(client):
    return _register(client, "member@example.com")


@pytest.fixture
def other_member(client):
    return _register(client, "other@example.com")


@pytest.fixture
def admin(client):
    return _register(client, "admin@example.com", admin=True)
