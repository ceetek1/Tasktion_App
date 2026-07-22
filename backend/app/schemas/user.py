from pydantic import BaseModel, ConfigDict, EmailStr

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password:str

class UserRead(UserBase):
    id: int
    role: str
    model_config = ConfigDict(from_attributes=True)