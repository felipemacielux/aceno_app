from datetime import UTC, datetime

from app.db import async_session
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
from app.services import mesa_service


def _gravador():
    chamadas_mesa: list[tuple[str, str, dict]] = []
    chamadas_operacao: list[tuple[str, dict]] = []

    async def fake_emitir_mesa(token: str, tipo: str, dados: dict) -> None:
        chamadas_mesa.append((token, tipo, dados))

    async def fake_emitir_operacao(tipo: str, dados: dict) -> None:
        chamadas_operacao.append((tipo, dados))

    return chamadas_mesa, chamadas_operacao, fake_emitir_mesa, fake_emitir_operacao


async def test_abrir_mesa_fechada_emite_mesa_atualizada(mesa, monkeypatch):
    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(mesa_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(mesa_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        await mesa_service.abrir_mesa(session, mesa.id)

    assert len(chamadas_mesa) == 1
    assert chamadas_mesa[0][0] == mesa.token
    assert chamadas_mesa[0][1] == "mesa.atualizada"
    assert chamadas_mesa[0][2]["status"] == "aberta"
    assert len(chamadas_operacao) == 1
    assert chamadas_operacao[0][0] == "mesa.atualizada"


async def test_abrir_mesa_ja_aberta_nao_emite_nada(mesa, monkeypatch):
    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(mesa_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(mesa_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime.now(UTC)
        await session.commit()

    async with async_session() as session:
        await mesa_service.abrir_mesa(session, mesa.id)

    assert chamadas_mesa == []
    assert chamadas_operacao == []


async def test_fechar_mesa_emite_mesa_atualizada_e_solicitacao_atualizada(mesa, monkeypatch):
    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(mesa_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(mesa_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime.now(UTC)
        session.add(
            Solicitacao(mesa_id=mesa.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        )
        await session.commit()

    async with async_session() as session:
        await mesa_service.fechar_mesa(session, mesa.id)

    tipos_emitidos_mesa = [c[1] for c in chamadas_mesa]
    assert "mesa.atualizada" in tipos_emitidos_mesa
    assert "solicitacao.atualizada" in tipos_emitidos_mesa
    tipos_emitidos_operacao = [c[0] for c in chamadas_operacao]
    assert "mesa.atualizada" in tipos_emitidos_operacao
    assert "solicitacao.atualizada" in tipos_emitidos_operacao
