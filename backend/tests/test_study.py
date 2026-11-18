from datetime import date, datetime, timedelta, timezone



def _future(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _post(client, user, path, body, status=201):
    r = client.post(path, json=body, headers=user["headers"])
    assert r.status_code == status, r.text
    return r.json()


def _task(client, user, **fields):
    return _post(client, user, "/tasks", {"title": "Task", "due_date": _future(), **fields})


def _today():
    return datetime.now(timezone.utc).date()


# ---------- Courses ----------
def test_course_crud_and_defaults(client, member):
    first = _post(client, member, "/courses", {"name": " Linear Algebra "})
    assert first["name"] == "Linear Algebra"
    assert first["glyph"] == "L"
    assert first["colour"] == "#5F8A8B"
    second = _post(client, member, "/courses", {"name": "Psychology", "glyph": "Ψ"})
    assert second["glyph"] == "Ψ"
    assert second["colour"] == "#B98A2F"

    _post(client, member, "/courses", {"name": "linear algebra"}, status=409)
    r = client.patch(f"/courses/{second['id']}", json={"colour": "#123456"}, headers=member["headers"])
    assert r.json()["colour"] == "#123456"
    assert client.patch(f"/courses/{second['id']}", json={"colour": "red"}, headers=member["headers"]).status_code == 422

    names = [c["name"] for c in client.get("/courses", headers=member["headers"]).json()]
    assert names == ["Linear Algebra", "Psychology"]
    assert client.delete(f"/courses/{first['id']}", headers=member["headers"]).status_code == 204


def test_courses_are_private(client, member, other_member):
    course = _post(client, member, "/courses", {"name": "Maths"})
    assert client.get("/courses", headers=other_member["headers"]).json() == []
    assert client.patch(f"/courses/{course['id']}", json={"name": "x"}, headers=other_member["headers"]).status_code == 404
    _task(client, other_member)  # sanity: they can still make tasks
    r = client.post("/tasks", json={"title": "x", "due_date": _future(), "course_id": course["id"]}, headers=other_member["headers"])
    assert r.status_code == 404


def test_task_course_by_name_or_id(client, member):
    by_name = _task(client, member, course="Biology")
    assert by_name["course"] == "Biology"
    again = _task(client, member, course="biology")
    assert again["course_id"] == by_name["course_id"]
    assert len(client.get("/courses", headers=member["headers"]).json()) == 1

    course = _post(client, member, "/courses", {"name": "Chemistry"})
    moved = client.patch(f"/tasks/{by_name['id']}", json={"course_id": course["id"]}, headers=member["headers"]).json()
    assert moved["course"] == "Chemistry"
    cleared = client.patch(f"/tasks/{by_name['id']}", json={"course_id": None}, headers=member["headers"]).json()
    assert cleared["course"] is None

    both = {"title": "x", "due_date": _future(), "course": "A", "course_id": course["id"]}
    assert client.post("/tasks", json=both, headers=member["headers"]).status_code == 422


def test_deleting_a_course_keeps_its_tasks(client, member):
    task = _task(client, member, course="History")
    client.delete(f"/courses/{task['course_id']}", headers=member["headers"])
    kept = client.get(f"/tasks/{task['id']}", headers=member["headers"]).json()
    assert kept["course_id"] is None


# ---------- Classes ----------
def test_classes_and_today(client, member):
    course = _post(client, member, "/courses", {"name": "Chemistry"})
    weekday = _today().weekday()
    lab = _post(client, member, "/classes", {"course_id": course["id"], "weekday": weekday, "starts_at": "15:30", "ends_at": "17:00", "place": "Lab 3"})
    _post(client, member, "/classes", {"course_id": course["id"], "weekday": weekday, "starts_at": "09:00", "ends_at": "10:30"})
    _post(client, member, "/classes", {"course_id": course["id"], "weekday": (weekday + 1) % 7, "starts_at": "11:00", "ends_at": "12:00"})
    assert lab["starts_at"] == "15:30"

    today = client.get("/planner/today", headers=member["headers"]).json()
    assert [(c["starts_at"], c["course"], c["place"]) for c in today["classes"]] == [
        ("09:00", "Chemistry", None),
        ("15:30", "Chemistry", "Lab 3"),
    ]
    week = client.get("/planner/week", headers=member["headers"]).json()
    assert [len(d["classes"]) for d in week["days"][:2]] == [2, 1]
    listed = client.get("/courses", headers=member["headers"]).json()[0]
    assert sorted((c["weekday"], c["starts_at"]) for c in listed["classes"]) == [
        (c["weekday"], c["starts_at"]) for c in listed["classes"]
    ]
    assert len(listed["classes"]) == 3


def test_class_validation(client, member, other_member):
    course = _post(client, member, "/courses", {"name": "Chemistry"})
    bad = {"course_id": course["id"], "weekday": 1, "starts_at": "10:00", "ends_at": "09:00"}
    assert client.post("/classes", json=bad, headers=member["headers"]).status_code == 422
    assert client.post("/classes", json={**bad, "weekday": 7, "ends_at": "11:00"}, headers=member["headers"]).status_code == 422
    theirs = {"course_id": course["id"], "weekday": 1, "starts_at": "10:00", "ends_at": "11:00"}
    assert client.post("/classes", json=theirs, headers=other_member["headers"]).status_code == 404
    session = _post(client, member, "/classes", theirs)
    assert client.patch(f"/classes/{session['id']}", json={"ends_at": "09:30"}, headers=member["headers"]).status_code == 422
    assert client.delete(f"/classes/{session['id']}", headers=other_member["headers"]).status_code == 404
    assert client.delete(f"/classes/{session['id']}", headers=member["headers"]).status_code == 204


def test_classes_only_during_term(client, member):
    course = _post(client, member, "/courses", {"name": "Chemistry"})
    _post(client, member, "/classes", {"course_id": course["id"], "weekday": _today().weekday(), "starts_at": "09:00", "ends_at": "10:00"})
    past_term = {"name": "Spring", "start_date": (_today() - timedelta(weeks=20)).isoformat(), "weeks": 10}
    client.put("/term", json=past_term, headers=member["headers"])
    assert client.get("/planner/today", headers=member["headers"]).json()["classes"] == []


# ---------- Bosses ----------
def test_guardian_only_on_exams(client, member):
    r = client.post("/tasks", json={"title": "x", "due_date": _future(), "guardian": "kraken"}, headers=member["headers"])
    assert r.status_code == 422
    exam = _task(client, member, kind="exam", guardian="kraken")
    assert exam["guardian"] == "kraken"
    changed = client.patch(f"/tasks/{exam['id']}", json={"kind": "assignment"}, headers=member["headers"]).json()
    assert changed["guardian"] is None
    assert client.post("/tasks", json={"title": "x", "due_date": _future(), "kind": "exam", "guardian": "hydra"}, headers=member["headers"]).status_code == 422


def test_boss_link_must_be_an_exam(client, member, other_member):
    essay = _task(client, member)
    r = client.post("/tasks", json={"title": "x", "due_date": _future(), "kind": "revision", "boss_task_id": essay["id"]}, headers=member["headers"])
    assert r.status_code == 422
    their_exam = _task(client, other_member, kind="exam")
    r = client.post("/tasks", json={"title": "x", "due_date": _future(), "kind": "revision", "boss_task_id": their_exam["id"]}, headers=member["headers"])
    assert r.status_code == 404


def test_boss_health_counts_completed_revision(client, member):
    exam = _task(client, member, title="LA midterm", kind="exam", guardian="kraken", due_date=_future(100))
    revision = [_task(client, member, title=f"Revise {i}", kind="revision", boss_task_id=exam["id"]) for i in range(7)]

    [boss] = client.get("/bosses", headers=member["headers"]).json()
    assert (boss["health"], boss["max_health"], boss["defeated"]) == (5, 5, False)
    assert len(boss["revision"]) == 7

    for task in revision[:2]:
        client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=member["headers"])
    assert client.get("/bosses", headers=member["headers"]).json()[0]["health"] == 3

    for task in revision[2:]:
        client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=member["headers"])
    [boss] = client.get("/bosses", headers=member["headers"]).json()
    assert (boss["health"], boss["defeated"]) == (0, True)


def test_deleting_an_exam_unlinks_its_revision(client, member):
    exam = _task(client, member, kind="exam")
    revision = _task(client, member, kind="revision", boss_task_id=exam["id"])
    client.delete(f"/tasks/{exam['id']}", headers=member["headers"])
    assert client.get(f"/tasks/{revision['id']}", headers=member["headers"]).json()["boss_task_id"] is None


# ---------- Goals ----------
def test_goals(client, member, other_member):
    course = _post(client, member, "/courses", {"name": "Psychology"})
    goal = _post(client, member, "/goals", {"type": "grade", "text": "A in Psychology", "course_id": course["id"], "target": "A"})
    assert goal["sealed_at"] is None
    sealed = client.patch(f"/goals/{goal['id']}", json={"sealed": True}, headers=member["headers"]).json()
    assert sealed["sealed_at"] is not None
    habit = _post(client, member, "/goals", {"type": "habit", "text": "Focus 8 h a week", "sealed": True})
    assert habit["sealed_at"] is not None
    assert len(client.get("/goals", headers=member["headers"]).json()) == 2

    unsealed = client.patch(f"/goals/{goal['id']}", json={"sealed": False}, headers=member["headers"]).json()
    assert unsealed["sealed_at"] is None
    assert client.post("/goals", json={"type": "wish", "text": "x"}, headers=member["headers"]).status_code == 422
    assert client.get("/goals", headers=other_member["headers"]).json() == []
    assert client.delete(f"/goals/{goal['id']}", headers=other_member["headers"]).status_code == 404
    assert client.delete(f"/goals/{goal['id']}", headers=member["headers"]).status_code == 204


# ---------- Focus ----------
def test_focus_session_can_complete_its_task(client, member):
    task = _task(client, member, title="Revise eigenvalues")
    session = _post(client, member, "/focus-sessions", {"task_id": task["id"], "minutes": 25})
    assert session["completed_at"] is None

    result = _post(client, member, f"/focus-sessions/{session['id']}/finish", {"minutes": 23, "complete_task": True}, status=200)
    assert result["session"]["minutes"] == 23
    assert result["session"]["completed_at"] is not None
    assert result["task"]["status"] == "completed"
    assert result["task"]["completed_at"] is not None

    again = client.post(f"/focus-sessions/{session['id']}/finish", json={"minutes": 5}, headers=member["headers"])
    assert again.status_code == 409


def test_focus_log_and_totals(client, member, other_member):
    _post(client, member, "/focus-sessions/log", {"minutes": 50})
    running = _post(client, member, "/focus-sessions", {"minutes": 25})
    totals = client.get("/focus-sessions", headers=member["headers"]).json()
    assert totals["total_minutes"] == 50
    assert len(totals["sessions"]) == 2

    r = client.post(f"/focus-sessions/{running['id']}/finish", json={"minutes": 5, "complete_task": True}, headers=member["headers"])
    assert r.status_code == 422
    assert client.post(f"/focus-sessions/{running['id']}/finish", json={"minutes": 5}, headers=other_member["headers"]).status_code == 404
    their_task = _task(client, other_member)
    assert client.post("/focus-sessions", json={"task_id": their_task["id"], "minutes": 25}, headers=member["headers"]).status_code == 404
    assert client.post("/focus-sessions", json={"minutes": 0}, headers=member["headers"]).status_code == 422
    assert client.delete(f"/focus-sessions/{running['id']}", headers=member["headers"]).status_code == 204


# ---------- Term and history ----------
def test_term_and_onboarding(client, member):
    term = client.get("/term", headers=member["headers"]).json()
    assert term == {"name": None, "start_date": None, "weeks": None, "current_week": None, "onboarded": False}

    start = _today() - timedelta(days=15)
    r = client.put("/term", json={"name": "Autumn term", "start_date": start.isoformat(), "weeks": 14}, headers=member["headers"])
    assert r.status_code == 200
    assert r.json()["onboarded"] is True
    assert r.json()["current_week"] == 3
    assert client.put("/term", json={"name": "x", "start_date": start.isoformat(), "weeks": 60}, headers=member["headers"]).status_code == 422


def test_history(client, member):
    today = _today()
    planned = _task(client, member, planned_for=today.isoformat())
    _task(client, member, planned_for=today.isoformat())
    _task(client, member, kind="exam", planned_for=today.isoformat())
    client.patch(f"/tasks/{planned['id']}", json={"status": "completed"}, headers=member["headers"])
    _post(client, member, "/focus-sessions/log", {"minutes": 30})

    days = client.get(f"/planner/history?start={(today - timedelta(days=2)).isoformat()}", headers=member["headers"]).json()["days"]
    assert len(days) == 3
    last = days[-1]
    assert (last["planned"], last["done"], last["completed"]) == (2, 1, 1)
    assert last["focus_minutes"] == 30
    r = client.get(f"/planner/history?start={today.isoformat()}&end={(today - timedelta(days=1)).isoformat()}", headers=member["headers"])
    assert r.status_code == 422

