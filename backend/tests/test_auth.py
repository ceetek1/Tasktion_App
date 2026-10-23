def test_register_and_login(client):
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    assert r.status_code == 201
    assert r.json()["role"] == "member"

    r = client.post("/auth/login", json={"email": "a@example.com", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "a@example.com"


def test_email_is_case_insensitive(client):
    client.post("/auth/register", json={"email": "Mixed@Example.com", "password": "password123"})
    dup = client.post("/auth/register", json={"email": "mixed@example.com", "password": "password123"})
    assert dup.status_code == 409

    r = client.post("/auth/login", json={"email": "MIXED@example.COM", "password": "password123"})
    assert r.status_code == 200


def test_wrong_password_rejected(client, member):
    r = client.post("/auth/login", json={"email": "member@example.com", "password": "wrongpass1"})
    assert r.status_code == 401


def test_short_password_is_422(client):
    r = client.post("/auth/register", json={"email": "s@example.com", "password": "short"})
    assert r.status_code == 422


def test_admin_secret_required(client):
    body = {"email": "x@example.com", "password": "password123"}
    assert client.post("/auth/register-admin", json=body, headers={"x-admin-secret": "nope"}).status_code == 403
    r = client.post("/auth/register-admin", json=body, headers={"x-admin-secret": "test-admin-secret"})
    assert r.status_code == 201
    assert r.json()["role"] == "admin"


def test_swagger_token_endpoint(client, member):
    r = client.post("/auth/token", data={"username": "member@example.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_members_cannot_list_users(client, member):
    assert client.get("/users", headers=member["headers"]).status_code == 403
