import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from jose import JWTError
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_supabase_token
from app.models.user import User
from app.schemas.user import UserRead

bearer_scheme = HTTPBearer(auto_error=False, description="Supabase Auth access token")
router = APIRouter()

INVITE_REQUIRED = "invite_required"


def get_auth_claims(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    """Claims of a valid Supabase sign-in token. The caller may not be a group member yet."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        claims = verify_supabase_token(credentials.credentials)
        uuid.UUID(claims["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    return claims


def claims_email(claims: dict) -> str:
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=403, detail="Your account has no email address")
    return email


def create_member(db: Session, claims: dict) -> User:
    """Add the signed-in person to the group, using the profile from Google/Microsoft when there is one."""
    metadata = claims.get("user_metadata") or {}
    user = User(
        auth_id=uuid.UUID(claims["sub"]),
        email=claims_email(claims),
        display_name=metadata.get("full_name") or metadata.get("name"),
        avatar_url=metadata.get("avatar_url") or metadata.get("picture"),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Same email already belongs to another sign-in, or a concurrent join won
        db.rollback()
        raise HTTPException(status_code=409, detail="This email is already in the group under another sign-in")
    return user


def find_member(db: Session, claims: dict) -> User | None:
    return db.query(User).filter(User.auth_id == uuid.UUID(claims["sub"])).first()


def get_current_user(claims: dict = Depends(get_auth_claims), db: Session = Depends(get_db)) -> User:
    user = find_member(db, claims)
    if user is not None:
        return user

    first_member = settings.FIRST_MEMBER_EMAIL.strip().lower()
    if first_member and claims_email(claims) == first_member:
        user = create_member(db, claims)
        db.commit()
        db.refresh(user)
        return user

    raise HTTPException(status_code=403, detail=INVITE_REQUIRED)


@router.get("/auth/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
