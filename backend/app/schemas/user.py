from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class UserBase(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v):
        return _normalize_email(v) if isinstance(v, str) else v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, v):
        # bcrypt only uses the first 72 bytes of a password
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 bytes")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v):
        return _normalize_email(v) if isinstance(v, str) else v


class UserRead(UserBase):
    id: int
    role: str
    model_config = ConfigDict(from_attributes=True)
