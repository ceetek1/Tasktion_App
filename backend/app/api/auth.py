import secrets

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.core.security import hash_password, verify_password, create_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
router = APIRouter()


def _create_user(db: Session, user: UserCreate, role: str = "member") -> User:
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    new_user = User(email=user.email, hashed_password=hash_password(user.password), role=role)
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent registration for the same email
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    db.refresh(new_user)
    return new_user


def _authenticate(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/register", response_model=UserRead, status_code=201)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    return _create_user(db, user)


@router.post("/auth/register-admin", response_model=UserRead, status_code=201)
def register_admin(
    user: UserCreate,
    x_admin_secret: str = Header(...),
    db: Session = Depends(get_db),
):
    if not settings.ADMIN_SECRET or not secrets.compare_digest(
        x_admin_secret.encode(), settings.ADMIN_SECRET.encode()
    ):
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    return _create_user(db, user, role="admin")


@router.post("/auth/login")
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    return _authenticate(db, credentials.email, credentials.password)


@router.post("/auth/token", include_in_schema=False)
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Form-based login used by the Swagger UI "Authorize" button."""
    return _authenticate(db, form_data.username, form_data.password)


@router.post("/auth/logout")
def logout_user():
    """Instructs client to delete stored token. JWTs are stateless."""
    return {"message": "Successfully logged out. Delete your stored token."}


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id_int = int(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id_int).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/auth/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
    return current_user
