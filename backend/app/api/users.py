from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserRead
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/users", response_model=list[UserRead])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everyone in the group. Only invited friends have accounts, so any member may see the list."""
    return db.query(User).order_by(User.id.asc()).offset(skip).limit(limit).all()
