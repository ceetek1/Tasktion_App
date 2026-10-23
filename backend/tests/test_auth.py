from datetime import timedelta

from app.core.config import settings
from conftest import auth_headers, make_token


def test_me_returns_profile(client, member):
    r = client.get("/auth/me", headers=member["headers"])
    assert r.status_code == 200
    assert r.json() == {"id": member["id"], "email": "member@example.com", "display_name": "Member", "avatar_url": None}


def test_missing_bad_or_expired_token_is_401(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_headers("not-a-jwt")).status_code == 401
    forged = make_token("a@example.com", secret="some-other-secret-that-is-long-enough")
    assert client.get("/auth/me", headers=auth_headers(forged)).status_code == 401
    expired = make_token("a@example.com", expires_in=timedelta(minutes=-5))
    assert client.get("/auth/me", headers=auth_headers(expired)).status_code == 401


def test_signed_in_without_invite_is_403(client):
    r = client.get("/auth/me", headers=auth_headers(make_token("stranger@example.com")))
    assert r.status_code == 403
    assert r.json()["detail"] == "invite_required"


def test_first_member_joins_without_invite(client, monkeypatch):
    monkeypatch.setattr(settings, "FIRST_MEMBER_EMAIL", "Me@Example.com")
    headers = auth_headers(make_token("me@example.com", name="Me Myself"))
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Me Myself"
    # Second request finds the same member instead of creating another
    assert client.get("/auth/me", headers=headers).json()["id"] == r.json()["id"]


def test_first_member_email_cannot_be_claimed_twice(client, monkeypatch):
    monkeypatch.setattr(settings, "FIRST_MEMBER_EMAIL", "me@example.com")
    assert client.get("/auth/me", headers=auth_headers(make_token("me@example.com"))).status_code == 200
    # A different sign-in with the same email doesn't get a second account
    assert client.get("/auth/me", headers=auth_headers(make_token("me@example.com"))).status_code == 409


def test_members_can_list_group(client, member, other_member):
    r = client.get("/users", headers=member["headers"])
    assert r.status_code == 200
    assert [u["email"] for u in r.json()] == ["member@example.com", "other@example.com"]


def test_non_members_cannot_list_group(client, member):
    assert client.get("/users", headers=auth_headers(make_token("stranger@example.com"))).status_code == 403


def test_asymmetric_token_verified_with_jwks(client, member, monkeypatch):
    import httpx
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from jose import jwk, jwt
    from app.core import security

    private_key = ec.generate_private_key(ec.SECP256R1())
    pem = private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public = jwk.construct(private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ), "ES256").to_dict()
    public.update({"kid": "key-1", "alg": "ES256"})

    calls = []

    def fake_get(url, timeout):
        calls.append(url)
        return httpx.Response(200, json={"keys": [public]}, request=httpx.Request("GET", url))

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(security.httpx, "get", fake_get)
    monkeypatch.setattr(security, "_jwks", {})

    token = jwt.decode(member["headers"]["Authorization"].split()[1], settings.SUPABASE_JWT_SECRET,
                       algorithms=["HS256"], audience="authenticated")
    es_token = jwt.encode(token, pem.decode(), algorithm="ES256", headers={"kid": "key-1"})
    assert client.get("/auth/me", headers=auth_headers(es_token)).status_code == 200
    assert client.get("/auth/me", headers=auth_headers(es_token)).status_code == 200
    assert calls == ["https://proj.supabase.co/auth/v1/.well-known/jwks.json"]  # keys cached

    other_key = ec.generate_private_key(ec.SECP256R1()).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    forged = jwt.encode(token, other_key.decode(), algorithm="ES256", headers={"kid": "key-1"})
    assert client.get("/auth/me", headers=auth_headers(forged)).status_code == 401
