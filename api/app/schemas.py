from datetime import datetime

from pydantic import BaseModel

from app.models import StatusMesa


class LoginRequest(BaseModel):
    username: str
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MesaOut(BaseModel):
    id: int
    numero: int
    status: StatusMesa
    aberta_em: datetime | None

    class Config:
        from_attributes = True
