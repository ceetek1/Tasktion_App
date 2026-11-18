from app import main


def test_spa_serves_index_for_app_routes(client, tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<div id=root></div>")
    (tmp_path / "assets" / "app-123.js").write_text("console.log(1)")
    monkeypatch.setattr(main, "spa_dir", tmp_path)

    assert client.get("/app", follow_redirects=False).headers["location"] == "/app/"
    for path in ("/app/", "/app/day/2026-11-20", "/app/bosses"):
        r = client.get(path)
        assert r.status_code == 200
        assert "id=root" in r.text
        assert r.headers["cache-control"] == "no-cache"
    asset = client.get("/app/assets/app-123.js")
    assert asset.text == "console.log(1)"
    assert "immutable" in asset.headers["cache-control"]
    assert client.get("/app/assets/missing.js").status_code == 404
    # Paths outside the build never serve files
    for sneaky in ("/app/../backend/app/main.py", "/app/%2e%2e/%2e%2e/backend/app/main.py"):
        assert "FastAPI" not in client.get(sneaky).text


def test_spa_explains_when_not_built(client, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "spa_dir", tmp_path / "nothing")
    r = client.get("/app/")
    assert r.status_code == 404
    assert "npm run build" in r.json()["detail"]
