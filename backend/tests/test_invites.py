from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from app.core.database import SessionLocal
from app.models.invite import Invite
from conftest import auth_headers, make_token


def _invite_token(client, user):
    r = client.post("/invites", headers=user["headers"])
    assert r.status_code == 201, r.text
    return parse_qs(urlparse(r.json()["url"]).query)["invite"][0]


def test_invite_link_lets_a_friend_join(client, member):
    token = _invite_token(client, member)
    assert client.get(f"/invites/{token}").json() == {"valid": True, "invited_by": "Member"}

    friend = auth_headers(make_token("friend@example.com", name="Friend"))
    r = client.post(f"/invites/{token}/accept", headers=friend)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Friend"
    assert client.get("/auth/me", headers=friend).status_code == 200


def test_invite_works_once(client, member):
    token = _invite_token(client, member)
    assert client.post(f"/invites/{token}/accept", headers=auth_headers(make_token("a@example.com"))).status_code == 200
    assert client.get(f"/invites/{token}").json()["valid"] is False
    r = client.post(f"/invites/{token}/accept", headers=auth_headers(make_token("b@example.com")))
    assert r.status_code == 410


def test_expired_invite_rejected(client, member):
    token = _invite_token(client, member)
    db = SessionLocal()
    db.query(Invite).update({Invite.expires_at: datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()
    db.close()
    assert client.get(f"/invites/{token}").json()["valid"] is False
    assert client.post(f"/invites/{token}/accept", headers=auth_headers(make_token("a@example.com"))).status_code == 410


def test_unknown_invite(client):
    assert client.get("/invites/nope").json() == {"valid": False, "invited_by": None}
    assert client.post("/invites/nope/accept", headers=auth_headers(make_token("a@example.com"))).status_code == 410


def test_existing_member_cannot_use_invite(client, member, other_member):
    token = _invite_token(client, member)
    assert client.post(f"/invites/{token}/accept", headers=other_member["headers"]).status_code == 409
    # The link is still usable by someone new
    assert client.get(f"/invites/{token}").json()["valid"] is True


def test_accept_needs_sign_in_and_create_needs_membership(client, member):
    token = _invite_token(client, member)
    assert client.post(f"/invites/{token}/accept").status_code == 401
    assert client.post("/invites", headers=auth_headers(make_token("stranger@example.com"))).status_code == 403
