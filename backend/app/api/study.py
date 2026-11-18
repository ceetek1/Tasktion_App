"""Courses and weekly classes, goals, focus sessions, the term and exam bosses."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.api.tasks import _get_visible_task
from app.core.database import get_db
from app.models.course import ClassSession, Course
from app.models.focus_session import FocusSession
from app.models.goal import Goal
from app.models.user import User
from app.schemas.study import (
    BossRead,
    ClassCreate,
    ClassRead,
    ClassUpdate,
    CourseCreate,
    CourseRead,
    CourseUpdate,
    FocusFinish,
    FocusLog,
    FocusRead,
    FocusResult,
    FocusStart,
    FocusTotals,
    GoalCreate,
    GoalRead,
    GoalUpdate,
    TermRead,
    TermUpdate,
)
from app.schemas.task import TaskRead
from app.services import bosses as boss_service
from app.services import courses as course_service
from app.services.planner import clock_for

router = APIRouter()


def _course(db: Session, user: User, course_id: int) -> Course:
    try:
        return course_service.owned(db, user.id, course_id)
    except course_service.CourseError:
        raise HTTPException(status_code=404, detail="Course not found")


def _commit_unique_name(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already have a course with that name")


# ---------- Courses ----------
@router.get("/courses", response_model=list[CourseRead], tags=["courses"])
def list_courses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The member's courses with their weekly classes."""
    return db.query(Course).filter(Course.user_id == current_user.id).order_by(Course.created_at, Course.id).all()


@router.post("/courses", response_model=CourseRead, status_code=201, tags=["courses"])
def create_course(body: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    course = Course(
        user_id=current_user.id,
        name=body.name,
        glyph=body.glyph or course_service.default_glyph(body.name),
        colour=body.colour or course_service.next_colour(db, current_user.id),
    )
    db.add(course)
    _commit_unique_name(db)
    db.refresh(course)
    return course


@router.patch("/courses/{course_id}", response_model=CourseRead, tags=["courses"])
def update_course(
    course_id: int, body: CourseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    course = _course(db, current_user, course_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    _commit_unique_name(db)
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=204, tags=["courses"])
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Deletes the course and its classes; its tasks and goals stay, without a course."""
    db.delete(_course(db, current_user, course_id))
    db.commit()


# ---------- Weekly classes ----------
@router.post("/classes", response_model=ClassRead, status_code=201, tags=["courses"])
def create_class(body: ClassCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _course(db, current_user, body.course_id)
    session = ClassSession(**body.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _class(db: Session, user: User, class_id: int) -> ClassSession:
    session = db.get(ClassSession, class_id)
    if session is None or session.course.user_id != user.id:
        raise HTTPException(status_code=404, detail="Class not found")
    return session


@router.patch("/classes/{class_id}", response_model=ClassRead, tags=["courses"])
def update_class(
    class_id: int, body: ClassUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    session = _class(db, current_user, class_id)
    changes = body.model_dump(exclude_unset=True)
    if "course_id" in changes:
        _course(db, current_user, changes["course_id"])
    starts, ends = changes.get("starts_at", session.starts_at), changes.get("ends_at", session.ends_at)
    if ends <= starts:
        raise HTTPException(status_code=422, detail="ends_at must be after starts_at")
    for key, value in changes.items():
        setattr(session, key, value)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/classes/{class_id}", status_code=204, tags=["courses"])
def delete_class(class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(_class(db, current_user, class_id))
    db.commit()


# ---------- Goals ----------
def _goal(db: Session, user: User, goal_id: int) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("/goals", response_model=list[GoalRead], tags=["goals"])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.created_at, Goal.id).all()


@router.post("/goals", response_model=GoalRead, status_code=201, tags=["goals"])
def create_goal(body: GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if body.course_id is not None:
        _course(db, current_user, body.course_id)
    goal = Goal(
        user_id=current_user.id,
        type=body.type.value,
        text=body.text.strip(),
        course_id=body.course_id,
        target=body.target,
        sealed_at=datetime.now(timezone.utc) if body.sealed else None,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/goals/{goal_id}", response_model=GoalRead, tags=["goals"])
def update_goal(
    goal_id: int, body: GoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """`sealed: true` commits to the goal; `false` unseals it."""
    goal = _goal(db, current_user, goal_id)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("course_id") is not None:
        _course(db, current_user, changes["course_id"])
    if "sealed" in changes:
        sealed = changes.pop("sealed")
        if sealed and goal.sealed_at is None:
            goal.sealed_at = datetime.now(timezone.utc)
        elif not sealed:
            goal.sealed_at = None
    for key, value in changes.items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}", status_code=204, tags=["goals"])
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(_goal(db, current_user, goal_id))
    db.commit()


# ---------- Focus sessions ----------
def _focus(db: Session, user: User, session_id: int) -> FocusSession:
    session = db.get(FocusSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Focus session not found")
    return session


def _complete_linked(db: Session, user: User, session: FocusSession) -> TaskRead | None:
    if session.task_id is None:
        raise HTTPException(status_code=422, detail="This session has no task to complete")
    task = _get_visible_task(db, session.task_id, user)
    task.status = "completed"
    return task


@router.get("/focus-sessions", response_model=FocusTotals, tags=["focus"])
def list_focus(
    start: date | None = Query(None, description="First day, in your timezone. Defaults to 7 days ago."),
    end: date | None = Query(None, description="Last day. Defaults to today."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clock = clock_for(current_user)
    end = end or clock.today
    start = start or end - timedelta(days=6)
    if start > end:
        raise HTTPException(status_code=422, detail="start must be on or before end")
    sessions = (
        db.query(FocusSession)
        .filter(
            FocusSession.user_id == current_user.id,
            FocusSession.started_at >= clock.start_of(start),
            FocusSession.started_at < clock.start_of(end + timedelta(days=1)),
        )
        .order_by(FocusSession.started_at)
        .all()
    )
    return FocusTotals(
        sessions=[FocusRead.model_validate(s) for s in sessions],
        total_minutes=sum(s.minutes for s in sessions if s.completed_at is not None),
    )


@router.post("/focus-sessions", response_model=FocusRead, status_code=201, tags=["focus"])
def start_focus(body: FocusStart, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Start a session now. Finish it with POST /focus-sessions/{id}/finish."""
    if body.task_id is not None:
        _get_visible_task(db, body.task_id, current_user)
    session = FocusSession(
        user_id=current_user.id, task_id=body.task_id, minutes=body.minutes, started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/focus-sessions/{session_id}/finish", response_model=FocusResult, tags=["focus"])
def finish_focus(
    session_id: int, body: FocusFinish, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Record the minutes actually focused; optionally complete the linked task too."""
    session = _focus(db, current_user, session_id)
    if session.completed_at is not None:
        raise HTTPException(status_code=409, detail="This session is already finished")
    session.minutes = body.minutes
    session.completed_at = datetime.now(timezone.utc)
    task = _complete_linked(db, current_user, session) if body.complete_task else None
    db.commit()
    db.refresh(session)
    if task is not None:
        db.refresh(task)
    return FocusResult(session=session, task=task)


@router.post("/focus-sessions/log", response_model=FocusResult, status_code=201, tags=["focus"])
def log_focus(body: FocusLog, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Record a session that just ended (it started `minutes` ago)."""
    if body.task_id is not None:
        _get_visible_task(db, body.task_id, current_user)
    now = datetime.now(timezone.utc)
    session = FocusSession(
        user_id=current_user.id,
        task_id=body.task_id,
        minutes=body.minutes,
        started_at=now - timedelta(minutes=body.minutes),
        completed_at=now,
    )
    db.add(session)
    db.flush()
    task = _complete_linked(db, current_user, session) if body.complete_task else None
    db.commit()
    db.refresh(session)
    if task is not None:
        db.refresh(task)
    return FocusResult(session=session, task=task)


@router.delete("/focus-sessions/{session_id}", status_code=204, tags=["focus"])
def delete_focus(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Drop a session, e.g. one abandoned straight away."""
    db.delete(_focus(db, current_user, session_id))
    db.commit()


# ---------- Term ----------
def _term(user: User) -> TermRead:
    current = None
    if user.term_start is not None and user.term_weeks is not None:
        days = (clock_for(user).today - user.term_start).days
        week = days // 7 + 1
        current = week if days >= 0 and week <= user.term_weeks else None
    return TermRead(
        name=user.term_name,
        start_date=user.term_start,
        weeks=user.term_weeks,
        current_week=current,
        onboarded=user.onboarded_at is not None,
    )


@router.get("/term", response_model=TermRead, tags=["term"])
def get_term(current_user: User = Depends(get_current_user)):
    """The member's term. `onboarded` is false until a term has been set."""
    return _term(current_user)


@router.put("/term", response_model=TermRead, tags=["term"])
def set_term(body: TermUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Set the term; the first time also marks onboarding as done."""
    current_user.term_name = body.name.strip()
    current_user.term_start = body.start_date
    current_user.term_weeks = body.weeks
    if current_user.onboarded_at is None:
        current_user.onboarded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return _term(current_user)


# ---------- Bosses ----------
@router.get("/bosses", response_model=list[BossRead], tags=["bosses"])
def list_bosses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every exam with its guardian, the revision tasks aimed at it, and its health:
    5 minus the completed revision tasks, never below 0."""
    return boss_service.bosses(db, current_user)
