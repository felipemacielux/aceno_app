from datetime import UTC, datetime, timedelta

from app.db import async_session
from app.models import Solicitacao, StatusSolicitacao, TipoSolicitacao
from app.services import solicitacao_service


async def test_marcar_urgentes_marca_pendente_antigo(mesa_aberta, monkeypatch):
    chamadas: list[tuple[str, dict]] = []

    async def fake_emitir_mesa(token: str, tipo: str, dados: dict) -> None:
        chamadas.append((tipo, dados))

    async def fake_emitir_operacao(tipo: str, dados: dict) -> None:
        chamadas.append((tipo, dados))

    monkeypatch.setattr(solicitacao_service.manager, "emitir_mesa", fake_emitir_mesa)
    monkeypatch.setattr(solicitacao_service.manager, "emitir_operacao", fake_emitir_operacao)

    async with async_session() as session:
        antigo = Solicitacao(
            mesa_id=mesa_aberta.id,
            tipo=TipoSolicitacao.chamar_garcom,
            status=StatusSolicitacao.pendente,
            criado_em=datetime.now(UTC) - timedelta(seconds=120),
        )
        session.add(antigo)
        await session.commit()

    async with async_session() as session:
        atualizados = await solicitacao_service.marcar_urgentes(session)

    assert len(atualizados) == 1
    assert atualizados[0].urgente is True
    assert ("solicitacao.atualizada", chamadas[0][1]) in chamadas


async def test_marcar_urgentes_ignora_pendente_recente(mesa_aberta):
    async with async_session() as session:
        session.add(
            Solicitacao(mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        )
        await session.commit()

    async with async_session() as session:
        atualizados = await solicitacao_service.marcar_urgentes(session)

    assert atualizados == []


async def test_marcar_urgentes_ignora_ja_urgente(mesa_aberta):
    async with async_session() as session:
        session.add(
            Solicitacao(
                mesa_id=mesa_aberta.id,
                tipo=TipoSolicitacao.chamar_garcom,
                status=StatusSolicitacao.pendente,
                urgente=True,
                criado_em=datetime.now(UTC) - timedelta(seconds=120),
            )
        )
        await session.commit()

    async with async_session() as session:
        atualizados = await solicitacao_service.marcar_urgentes(session)

    assert atualizados == []
