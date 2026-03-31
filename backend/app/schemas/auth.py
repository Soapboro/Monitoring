from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str  # email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    old_password: str
    new_password: str
