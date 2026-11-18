import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from jose import JWTError
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_supabase_token
from app.models.access_token import AccessToken
from app.models.user import User
from app.schemas.user import UserRead

bearer_scheme = HTTPBearer(
    auto_error=False, description="Supabase Auth access token, or a personal access token (tsk_…)"
)
router = APIRouter()

INVITE_REQUIRED = "invite_required"
PERSONAL_TOKEN_PREFIX = "tsk_"
# Recording every request would mean a write per API call; once a minute is plenty
LAST_USED_RESOLUTION = timedelta(minutes=1)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def is_personal_token(credentials: HTTPAuthorizationCredentials | None) -> bool:
    return credentials is not None and credentials.credentials.startswith(PERSONAL_TOKEN_PREFIX)


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


def _member_from_sign_in(db: Session, credentials: HTTPAuthorizationCredentials | None) -> User:
    claims = get_auth_claims(credentials)
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


def _member_from_personal_token(db: Session, raw_token: str) -> User:
    token = db.query(AccessToken).filter(AccessToken.token_hash == hash_token(raw_token)).first()
    if token is None or token.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Invalid or revoked access token")
    now = datetime.now(timezone.utc)
    if token.last_used_at is None or now - token.last_used_at >= LAST_USED_RESOLUTION:
        token.last_used_at = now
        db.commit()
    return token.user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """The member making the request, from a Supabase sign-in or a personal access token."""
    if is_personal_token(credentials):
        return _member_from_personal_token(db, credentials.credentials)
    return _member_from_sign_in(db, credentials)


def get_signed_in_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Like get_current_user, but only a real sign-in counts: a personal token can't mint or revoke tokens."""
    if is_personal_token(credentials):
        raise HTTPException(
            status_code=403, detail="Personal access tokens can't manage tokens. Sign in to Tasktion instead."
        )
    return _member_from_sign_in(db, credentials)


@router.get("/auth/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
