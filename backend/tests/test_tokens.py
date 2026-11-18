from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.access_token import AccessToken
from conftest import auth_headers


def _create(client, user, name="Claude Desktop"):
    r = client.post("/tokens", json={"name": name}, headers=user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def test_create_returns_token_once_and_stores_only_hash(client, member):
    created = _create(client, member)
    assert created["token"].startswith("tsk_")
    assert created["prefix"] == created["token"][:10]

    listed = client.get("/tokens", headers=member["headers"]).json()
    assert [t["id"] for t in listed] == [created["id"]]
    assert "token" not in listed[0]

    db = SessionLocal()
    stored = db.get(AccessToken, created["id"])
    assert stored.token_hash != created["token"]
    assert created["token"] not in stored.token_hash
    db.close()


def test_personal_token_works_for_the_api(client, member):
    token = _create(client, member)["token"]
    r = client.get("/auth/me", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["id"] == member["id"]
    r = client.post(
        "/tasks",
        json={"title": "From Claude", "due_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
        headers=auth_headers(token),
    )
    assert r.status_code == 201


def test_last_used_at_is_recorded(client, member):
    created = _create(client, member)
    assert created["last_used_at"] is None
    client.get("/auth/me", headers=auth_headers(created["token"]))
    listed = client.get("/tokens", headers=member["headers"]).json()
    assert listed[0]["last_used_at"] is not None


def test_unknown_token_rejected(client, member):
    r = client.get("/auth/me", headers=auth_headers("tsk_not-a-real-token"))
    assert r.status_code == 401


def test_revoked_token_rejected(client, member):
    created = _create(client, member)
    r = client.delete(f"/tokens/{created['id']}", headers=member["headers"])
    assert r.status_code == 204
    assert client.get("/auth/me", headers=auth_headers(created["token"])).status_code == 401
    assert client.get("/tokens", headers=member["headers"]).json() == []


def test_personal_token_cannot_manage_tokens(client, member):
    created = _create(client, member)
    headers = auth_headers(created["token"])
    assert client.post("/tokens", json={"name": "x"}, headers=headers).status_code == 403
    assert client.get("/tokens", headers=headers).status_code == 403
    assert client.delete(f"/tokens/{created['id']}", headers=headers).status_code == 403


def test_tokens_are_private(client, member, other_member):
    created = _create(client, member)
    assert client.get("/tokens", headers=other_member["headers"]).json() == []
    assert client.delete(f"/tokens/{created['id']}", headers=other_member["headers"]).status_code == 404


def test_tokens_need_sign_in(client):
    assert client.post("/tokens", json={"name": "x"}).status_code == 401
    assert client.get("/tokens").status_code == 401


def test_active_token_limit(client, member):
    for i in range(10):
        _create(client, member, name=f"t{i}")
    r = client.post("/tokens", json={"name": "one more"}, headers=member["headers"])
    assert r.status_code == 409
