from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
