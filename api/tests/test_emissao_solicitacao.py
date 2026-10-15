from app.db import async_session
from app.models import Solicitacao, StatusSolicitacao, TipoSolicitacao
from app.services import mesa_service, solicitacao_service


def _gravador():
    chamadas_mesa: list[tuple[str, str, dict]] = []
    chamadas_operacao: list[tuple[str, dict]] = []

    async def fake_emitir_mesa(token: str, tipo: str, dados: dict) -> None:
        chamadas_mesa.append((token, tipo, dados))

    async def fake_emitir_operacao(tipo: str, dados: dict) -> None:
        chamadas_operacao.append((tipo, dados))

    return chamadas_mesa, chamadas_operacao, fake_emitir_mesa, fake_emitir_operacao


async def test_criar_solicitacao_emite_solicitacao_criada(mesa_aberta, monkeypatch):
    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(solicitacao_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(solicitacao_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)

    assert chamadas_mesa == [(mesa_aberta.token, "solicitacao.criada", chamadas_mesa[0][2])]
    assert chamadas_operacao[0][0] == "solicitacao.criada"


async def test_cancelar_solicitacao_emite_solicitacao_atualizada(mesa_aberta, monkeypatch):
    async with async_session() as session:
        mesa_atual = await mesa_service.buscar_mesa_por_id(session, mesa_aberta.id)
        criada = await solicitacao_service.criar_solicitacao(session, mesa_atual, TipoSolicitacao.chamar_garcom)

    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(solicitacao_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(solicitacao_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        await solicitacao_service.cancelar_solicitacao(session, criada.id, mesa_aberta.id)

    assert chamadas_mesa == [(mesa_aberta.token, "solicitacao.atualizada", chamadas_mesa[0][2])]
    assert chamadas_operacao[0][0] == "solicitacao.atualizada"


async def test_aceitar_e_concluir_emitem_solicitacao_atualizada(mesa_aberta, monkeypatch):
    async with async_session() as session:
        s = Solicitacao(mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.pendente)
        session.add(s)
        await session.commit()
        await session.refresh(s)

    chamadas_mesa, chamadas_operacao, fake_mesa, fake_operacao = _gravador()
    monkeypatch.setattr(solicitacao_service.manager, "emitir_mesa", fake_mesa)
    monkeypatch.setattr(solicitacao_service.manager, "emitir_operacao", fake_operacao)

    async with async_session() as session:
        await solicitacao_service.aceitar_solicitacao(session, s.id)
    async with async_session() as session:
        await solicitacao_service.concluir_solicitacao(session, s.id)

    assert len(chamadas_mesa) == 2
    assert all(c[1] == "solicitacao.atualizada" for c in chamadas_mesa)
    assert len(chamadas_operacao) == 2
