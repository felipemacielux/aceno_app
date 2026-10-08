from collections.abc import AsyncGenerator

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session
from app.exceptions import CredenciaisInvalidas
from app.security import decode_token


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_usuario_atual(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise CredenciaisInvalidas()
    payload = decode_token(authorization.removeprefix("Bearer "))
    if payload is None:
        raise CredenciaisInvalidas()
    return payload
