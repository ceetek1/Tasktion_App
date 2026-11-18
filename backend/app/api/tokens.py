import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.auth import PERSONAL_TOKEN_PREFIX, get_signed_in_user, hash_token
from app.core.database import get_db
from app.models.access_token import AccessToken
from app.models.user import User
from app.schemas.access_token import AccessTokenCreate, AccessTokenCreated, AccessTokenRead

router = APIRouter(tags=["tokens"])

MAX_ACTIVE_TOKENS = 10
# "tsk_" plus the first 6 characters of the secret part
PREFIX_LENGTH = len(PERSONAL_TOKEN_PREFIX) + 6


def _active_tokens(db: Session, user: User):
    return (
        db.query(AccessToken)
        .filter(AccessToken.user_id == user.id, AccessToken.revoked_at.is_(None))
        .order_by(AccessToken.created_at.desc(), AccessToken.id.desc())
    )


@router.post("/tokens", response_model=AccessTokenCreated, status_code=201)
def create_token(
    body: AccessTokenCreate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_signed_in_user),
):
    """Make a personal access token. The token is in this response only; Tasktion keeps just its hash."""
    if _active_tokens(db, current_user).count() >= MAX_ACTIVE_TOKENS:
        raise HTTPException(
            status_code=409, detail=f"You already have {MAX_ACTIVE_TOKENS} tokens. Revoke one you no longer use."
        )
    raw = PERSONAL_TOKEN_PREFIX + secrets.token_urlsafe(32)
    token = AccessToken(
        user_id=current_user.id,
        name=(body or AccessTokenCreate()).name.strip() or "Claude Desktop",
        token_hash=hash_token(raw),
        prefix=raw[:PREFIX_LENGTH],
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return AccessTokenCreated(token=raw, **AccessTokenRead.model_validate(token).model_dump())


@router.get("/tokens", response_model=list[AccessTokenRead])
def list_tokens(db: Session = Depends(get_db), current_user: User = Depends(get_signed_in_user)):
    return _active_tokens(db, current_user).all()


@router.delete("/tokens/{token_id}", status_code=204)
def revoke_token(token_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_signed_in_user)):
    token = (
        db.query(AccessToken)
        .filter(AccessToken.id == token_id, AccessToken.user_id == current_user.id, AccessToken.revoked_at.is_(None))
        .first()
    )
    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")
    token.revoked_at = datetime.now(timezone.utc)
    db.commit()
