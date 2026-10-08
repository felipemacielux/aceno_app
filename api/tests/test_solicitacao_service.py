from datetime import UTC, datetime, timedelta

import pytest

from app.db import async_session
from app.exceptions import (
    AceiteConcorrente,
    CancelamentoInvalido,
    ConclusaoInvalida,
    EmCooldown,
    MesaFechada,
    SolicitacaoAtiva,
)
from app.models import FormaPagamento, Mesa, Solicitacao, StatusSolicitacao, TipoSolicitacao
from app.services import mesa_service, solicitacao_service


async def test_criar_solicitacao_em_mesa_fechada_levanta_mesa_fechada(mesa):
    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa.id)
        with pytest.raises(MesaFechada):
            await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)


async def test_criar_segunda_solicitacao_mesmo_tipo_levanta_solicitacao_ativa(mesa_aberta):
    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)
        with pytest.raises(SolicitacaoAtiva):
            await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)


async def test_tipos_diferentes_podem_ficar_ativos_juntos(mesa_aberta):
    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)
        resultado = await solicitacao_service.criar_solicitacao(
            session, mesa_atual, TipoSolicitacao.fechar_conta, FormaPagamento.pix
        )
        assert resultado.tipo == TipoSolicitacao.fechar_conta


async def test_cooldown_bloqueia_nova_solicitacao_mesmo_tipo(mesa_aberta):
    async with async_session() as session:
        session.add(
            Solicitacao(
                mesa_id=mesa_aberta.id,
                tipo=TipoSolicitacao.chamar_garcom,
                status=StatusSolicitacao.concluido,
                concluido_em=datetime.now(UTC),
            )
        )
        await session.commit()

    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        with pytest.raises(EmCooldown) as excinfo:
            await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)
        assert excinfo.value.extra["segundos_restantes"] > 0


async def test_cooldown_de_sessao_anterior_nao_conta_apos_reabertura(mesa_aberta):
    async with async_session() as session:
        session.add(
            Solicitacao(
                mesa_id=mesa_aberta.id,
                tipo=TipoSolicitacao.chamar_garcom,
                status=StatusSolicitacao.concluido,
                concluido_em=datetime.now(UTC),
            )
        )
        await session.commit()

    async with async_session() as session:
        m = await session.get(Mesa, mesa_aberta.id)
        m.aberta_em = datetime.now(UTC) + timedelta(seconds=1)
        await session.commit()

    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        resultado = await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)
        assert resultado.status == StatusSolicitacao.pendente


async def test_cancelar_solicitacao_pendente_funciona(mesa_aberta):
    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        criada = await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)

    async with async_session() as session:
        cancelada = await solicitacao_service.cancelar_solicitacao(session, criada.id, mesa_aberta.id)
        assert cancelada.status == StatusSolicitacao.cancelado


async def test_cancelar_solicitacao_em_atendimento_levanta_erro(mesa_aberta):
    async with async_session() as session:
        s = Solicitacao(
            mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.em_atendimento
        )
        session.add(s)
        await session.commit()
        await session.refresh(s)

    async with async_session() as session:
        with pytest.raises(CancelamentoInvalido):
            await solicitacao_service.cancelar_solicitacao(session, s.id, mesa_aberta.id)


async def test_aceite_concorrente_so_primeiro_vence(mesa_aberta):
    async with async_session() as session:
        s = Solicitacao(mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        session.add(s)
        await session.commit()
        await session.refresh(s)

    async with async_session() as session:
        aceita = await solicitacao_service.aceitar_solicitacao(session, s.id)
        assert aceita.status == StatusSolicitacao.em_atendimento

    async with async_session() as session:
        with pytest.raises(AceiteConcorrente):
            await solicitacao_service.aceitar_solicitacao(session, s.id)


async def test_concluir_apenas_a_partir_de_em_atendimento(mesa_aberta):
    async with async_session() as session:
        s = Solicitacao(mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        session.add(s)
        await session.commit()
        await session.refresh(s)

    async with async_session() as session:
        with pytest.raises(ConclusaoInvalida):
            await solicitacao_service.concluir_solicitacao(session, s.id)

    async with async_session() as session:
        await solicitacao_service.aceitar_solicitacao(session, s.id)

    async with async_session() as session:
        concluida = await solicitacao_service.concluir_solicitacao(session, s.id)
        assert concluida.status == StatusSolicitacao.concluido
        assert concluida.concluido_em is not None
