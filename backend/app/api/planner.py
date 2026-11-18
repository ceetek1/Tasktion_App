from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.planner import (
    ApplyPlanRequest,
    ApplyPlanResult,
    NextUp,
    PlannerSettings,
    PlannerSettingsUpdate,
    PlanProposal,
    PlanWeekRequest,
    TodayPlan,
    WeekPlan,
)
from app.schemas.task import TaskRead
from app.services import planner

router = APIRouter(prefix="/planner", tags=["planner"])


@router.get("/today", response_model=TodayPlan)
def today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return planner.today_plan(db, current_user)


@router.get("/week", response_model=WeekPlan)
def week(
    start: date | None = Query(None, description="First day, in your timezone. Defaults to today."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return planner.week_plan(db, current_user, start)


@router.get("/next", response_model=NextUp)
def next_up(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NextUp(suggestions=planner.next_up(db, current_user, limit))


@router.post("/plan-week", response_model=PlanProposal)
def plan_week(
    body: PlanWeekRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A proposal only: nothing changes until it is sent to /planner/apply-plan."""
    try:
        return planner.propose_week(db, current_user, body.start if body else None)
    except planner.PlannerError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/apply-plan", response_model=ApplyPlanResult)
def apply_plan(
    body: ApplyPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        updated = planner.apply_moves(db, current_user, [(m.task_id, m.planned_for) for m in body.moves])
    except planner.PlannerError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return ApplyPlanResult(updated=[TaskRead.model_validate(t) for t in updated])


@router.get("/settings", response_model=PlannerSettings)
def get_settings(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/settings", response_model=PlannerSettings)
def update_settings(
    body: PlannerSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user
