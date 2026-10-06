import asyncio
import uuid

from passlib.hash import bcrypt
from sqlalchemy import select

from app.db import async_session
from app.models import Estabelecimento, Mesa, UsuarioOperacao


async def seed() -> None:
    async with async_session() as session:
        estabelecimento = (
            await session.execute(select(Estabelecimento))
        ).scalars().first()

        if estabelecimento is None:
            estabelecimento = Estabelecimento(
                nome="Restaurante Sabor & Arte",
                wifi_ssid="Sabor_Arte_Wifi",
                wifi_senha="bemvindo123",
                cardapio_url="https://exemplo.com/cardapio-sabor-arte",
            )
            session.add(estabelecimento)
            await session.flush()

        mesas_existentes = (
            await session.execute(select(Mesa).where(Mesa.estabelecimento_id == estabelecimento.id))
        ).scalars().all()

        if not mesas_existentes:
            for numero in range(1, 11):
                session.add(
                    Mesa(
                        estabelecimento_id=estabelecimento.id,
                        numero=numero,
                        token=uuid.uuid4().hex,
                    )
                )

        usuario_existente = (
            await session.execute(
                select(UsuarioOperacao).where(UsuarioOperacao.username == "demo")
            )
        ).scalars().first()

        if usuario_existente is None:
            session.add(
                UsuarioOperacao(
                    estabelecimento_id=estabelecimento.id,
                    username="demo",
                    senha_hash=bcrypt.hash("demo123"),
                )
            )

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
