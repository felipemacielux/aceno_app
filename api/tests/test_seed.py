import pytest
from sqlalchemy import select

from app.db import async_session
from app.models import Estabelecimento, Mesa, UsuarioOperacao
from scripts.seed import seed


@pytest.mark.asyncio
async def test_seed_is_idempotent():
    await seed()
    await seed()

    async with async_session() as session:
        estabelecimentos = (await session.execute(select(Estabelecimento))).scalars().all()
        mesas = (await session.execute(select(Mesa))).scalars().all()
        usuarios = (await session.execute(select(UsuarioOperacao))).scalars().all()

    assert len(estabelecimentos) == 1
    assert len(mesas) == 10
    assert len(usuarios) == 1
    assert all(mesa.status.value == "fechada" for mesa in mesas)
