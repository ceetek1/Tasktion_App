import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.auth import create_member, find_member, get_auth_claims, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.invite import Invite
from app.models.user import User
from app.schemas.invite import InviteCreated, InviteStatus
from app.schemas.user import UserRead

router = APIRouter()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _usable_invite(db: Session, token: str, *, lock: bool = False) -> Invite | None:
    query = db.query(Invite).filter(Invite.token_hash == _hash(token))
    if lock:
        query = query.with_for_update()
    invite = query.first()
    if invite is None or invite.used_at is not None or invite.expires_at <= datetime.now(timezone.utc):
        return None
    return invite


def _name(user: User) -> str:
    return user.display_name or user.email.split("@")[0]


@router.post("/invites", response_model=InviteCreated, status_code=201)
def create_invite(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = secrets.token_urlsafe(32)
    invite = Invite(
        token_hash=_hash(token),
        created_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.INVITE_EXPIRE_DAYS),
    )
    db.add(invite)
    db.commit()
    return {"url": f"{settings.app_url}/pages/login.html?invite={token}", "expires_at": invite.expires_at}


@router.get("/invites/{token}", response_model=InviteStatus)
def check_invite(token: str, db: Session = Depends(get_db)):
    invite = _usable_invite(db, token)
    if invite is None:
        return {"valid": False}
    return {"valid": True, "invited_by": _name(invite.inviter)}


@router.post("/invites/{token}/accept", response_model=UserRead)
def accept_invite(token: str, claims: dict = Depends(get_auth_claims), db: Session = Depends(get_db)):
    if find_member(db, claims) is not None:
        raise HTTPException(status_code=409, detail="You're already in the group")
    invite = _usable_invite(db, token, lock=True)
    if invite is None:
        raise HTTPException(status_code=410, detail="This invite link has expired or was already used")

    user = create_member(db, claims)
    invite.used_by = user.id
    invite.used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user
