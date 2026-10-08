import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest
from passlib.hash import bcrypt
from sqlalchemy import text

from app.db import async_session, engine
from app.main import app
from app.models import Estabelecimento, UsuarioOperacao


@pytest.fixture(autouse=True)
async def limpar_banco():
    async with async_session() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE solicitacao, mesa, usuario_operacao, estabelecimento "
                "RESTART IDENTITY CASCADE"
            )
        )
        await session.commit()
    yield
    # pytest-asyncio abre um novo event loop por teste; conexões pooladas do
    # loop anterior quebram no próximo teste ("another operation is in
    # progress"). Descartar o pool força reconexão limpa a cada teste.
    await engine.dispose()


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def estabelecimento():
    async with async_session() as session:
        est = Estabelecimento(
            nome="Restaurante Teste",
            wifi_ssid="TesteWifi",
            wifi_senha="12345678",
            cardapio_url="https://exemplo.com/cardapio",
        )
        session.add(est)
        await session.commit()
        await session.refresh(est)
        return est


@pytest.fixture
async def usuario(estabelecimento):
    async with async_session() as session:
        u = UsuarioOperacao(
            estabelecimento_id=estabelecimento.id,
            username="garcom_teste",
            senha_hash=bcrypt.hash("senha123"),
        )
        session.add(u)
        await session.commit()
        await session.refresh(u)
        return u
