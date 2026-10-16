import asyncio

from app.db import async_session
from app.services import solicitacao_service

INTERVALO_SEG = 5


async def loop_urgencia() -> None:
    while True:
        await asyncio.sleep(INTERVALO_SEG)
        async with async_session() as session:
            await solicitacao_service.marcar_urgentes(session)
