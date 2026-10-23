from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.task import Task


def _future(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _create(client, user, title="Task"):
    r = client.post("/tasks", json={"title": title, "due_date": _future()}, headers=user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def _make_overdue(task_id):
    db = SessionLocal()
    db.get(Task, task_id).due_date = datetime.now(timezone.utc) - timedelta(days=2)
    db.commit()
    db.close()


def test_create_and_list(client, member):
    task = _create(client, member)
    assert task["due_date"].endswith("Z")
    tasks = client.get("/tasks", headers=member["headers"]).json()
    assert [t["id"] for t in tasks] == [task["id"]]


def test_past_due_date_rejected_on_create(client, member):
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = client.post("/tasks", json={"title": "x", "due_date": past}, headers=member["headers"])
    assert r.status_code == 422


def test_overdue_tasks_still_list(client, member, admin):
    task = _create(client, member)
    _make_overdue(task["id"])
    assert client.get("/tasks", headers=member["headers"]).status_code == 200
    assert client.get(f"/tasks/{task['id']}", headers=member["headers"]).status_code == 200
    assert client.get("/admin/tasks", headers=admin["headers"]).status_code == 200


def test_patch_rejects_null_required_fields(client, member):
    task = _create(client, member)
    for field in ("title", "due_date", "status"):
        r = client.patch(f"/tasks/{task['id']}", json={field: None}, headers=member["headers"])
        assert r.status_code == 422, field
    r = client.patch(f"/tasks/{task['id']}", json={"description": None}, headers=member["headers"])
    assert r.status_code == 200


def test_patch_rejects_past_due_date(client, member):
    task = _create(client, member)
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = client.patch(f"/tasks/{task['id']}", json={"due_date": past}, headers=member["headers"])
    assert r.status_code == 422


def test_other_members_cannot_see_task(client, member, other_member):
    task = _create(client, member)
    assert client.get(f"/tasks/{task['id']}", headers=other_member["headers"]).status_code == 404
    assert client.delete(f"/tasks/{task['id']}", headers=other_member["headers"]).status_code == 404


def test_assignee_sees_and_updates_status_only(client, member, other_member, admin):
    task = _create(client, member)
    r = client.patch(
        f"/admin/tasks/{task['id']}/assign",
        json={"assigned_to": other_member["id"]},
        headers=admin["headers"],
    )
    assert r.status_code == 200

    tasks = client.get("/tasks", headers=other_member["headers"]).json()
    assert [t["id"] for t in tasks] == [task["id"]]

    r = client.patch(f"/tasks/{task['id']}", json={"status": "in_progress"}, headers=other_member["headers"])
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    r = client.patch(f"/tasks/{task['id']}", json={"title": "hijack"}, headers=other_member["headers"])
    assert r.status_code == 403
    assert client.delete(f"/tasks/{task['id']}", headers=other_member["headers"]).status_code == 403


def test_admin_can_update_and_delete_any_task(client, member, admin):
    task = _create(client, member)
    r = client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=admin["headers"])
    assert r.status_code == 200
    assert client.delete(f"/tasks/{task['id']}", headers=admin["headers"]).status_code == 204


def test_admin_can_unassign(client, member, other_member, admin):
    task = _create(client, member)
    url = f"/admin/tasks/{task['id']}/assign"
    client.patch(url, json={"assigned_to": other_member["id"]}, headers=admin["headers"])
    r = client.patch(url, json={"assigned_to": None}, headers=admin["headers"])
    assert r.status_code == 200
    assert r.json()["assigned_to"] is None
    assert client.get("/tasks", headers=other_member["headers"]).json() == []


def test_assign_to_unknown_user_is_404(client, member, admin):
    task = _create(client, member)
    r = client.patch(f"/admin/tasks/{task['id']}/assign", json={"assigned_to": 9999}, headers=admin["headers"])
    assert r.status_code == 404
