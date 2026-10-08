from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.db import async_session
from app.exceptions import MesaNaoEncontrada
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
from app.services import mesa_service


async def test_abrir_mesa_fechada_muda_status_e_marca_sessao(mesa):
    async with async_session() as session:
        aberta = await mesa_service.abrir_mesa(session, mesa.id)
        assert aberta.status == StatusMesa.aberta
        assert aberta.aberta_em is not None


async def test_abrir_mesa_ja_aberta_e_idempotente(mesa):
    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime(2026, 1, 1, tzinfo=UTC)
        await session.commit()

    async with async_session() as session:
        resultado = await mesa_service.abrir_mesa(session, mesa.id)
        assert resultado.aberta_em == datetime(2026, 1, 1, tzinfo=UTC)


async def test_fechar_mesa_cancela_pendentes_e_conclui_em_atendimento(mesa):
    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime.now(UTC)
        session.add(
            Solicitacao(mesa_id=mesa.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        )
        session.add(
            Solicitacao(mesa_id=mesa.id, tipo=TipoSolicitacao.fechar_conta, status=StatusSolicitacao.em_atendimento)
        )
        await session.commit()

    async with async_session() as session:
        await mesa_service.fechar_mesa(session, mesa.id)

    async with async_session() as session:
        solicitacoes = (
            await session.execute(select(Solicitacao).where(Solicitacao.mesa_id == mesa.id))
        ).scalars().all()
        status_por_tipo = {s.tipo: s.status for s in solicitacoes}
        assert status_por_tipo[TipoSolicitacao.chamar_garcom] == StatusSolicitacao.cancelado
        assert status_por_tipo[TipoSolicitacao.fechar_conta] == StatusSolicitacao.concluido


async def test_fechar_mesa_ja_fechada_e_idempotente(mesa):
    async with async_session() as session:
        resultado = await mesa_service.fechar_mesa(session, mesa.id)
        assert resultado.status == StatusMesa.fechada


async def test_buscar_mesa_inexistente_levanta_erro():
    async with async_session() as session:
        with pytest.raises(MesaNaoEncontrada):
            await mesa_service.buscar_mesa_por_id(session, 999999)
