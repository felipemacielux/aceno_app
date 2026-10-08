from datetime import UTC, datetime, timedelta

import jwt
from passlib.hash import bcrypt

from app.config import settings

ALGORITHM = "HS256"


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return bcrypt.verify(senha, senha_hash)


def criar_token(dados: dict) -> str:
    expira = datetime.now(UTC) + timedelta(hours=settings.jwt_expire_horas)
    payload = {**dados, "exp": expira}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
