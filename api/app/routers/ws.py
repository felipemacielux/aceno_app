from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import async_session
from app.exceptions import MesaNaoEncontrada
from app.schemas import MesaOut, SolicitacaoOut
from app.security import decode_token
from app.services import mesa_service, solicitacao_service
from app.ws.manager import manager

router = APIRouter()


async def _loop_ping_pong(ws: WebSocket) -> None:
    while True:
        mensagem = await ws.receive_json()
        if mensagem.get("tipo") == "ping":
            await ws.send_json({"tipo": "pong"})


@router.websocket("/ws/m/{token}")
async def ws_mesa(ws: WebSocket, token: str) -> None:
    async with async_session() as session:
        try:
            estado = await mesa_service.obter_estado_cliente(session, token)
        except MesaNaoEncontrada:
            await ws.close(code=1008)
            return

    await manager.conectar_mesa(token, ws)
    await ws.send_json({"tipo": "estado.inicial", "dados": estado.model_dump(mode="json")})
    try:
        await _loop_ping_pong(ws)
    except WebSocketDisconnect:
        pass
    finally:
        manager.desconectar_mesa(token, ws)


@router.websocket("/ws/operacao")
async def ws_operacao(ws: WebSocket, token: str) -> None:
    if decode_token(token) is None:
        await ws.close(code=1008)
        return

    async with async_session() as session:
        mesas = await mesa_service.listar_mesas(session)
        solicitacoes = await solicitacao_service.listar_solicitacoes(session)

    await manager.conectar_operacao(ws)
    estado = {
        "mesas": [MesaOut.model_validate(m).model_dump(mode="json") for m in mesas],
        "solicitacoes": [SolicitacaoOut.model_validate(s).model_dump(mode="json") for s in solicitacoes],
    }
    await ws.send_json({"tipo": "estado.inicial", "dados": estado})
    try:
        await _loop_ping_pong(ws)
    except WebSocketDisconnect:
        pass
    finally:
        manager.desconectar_operacao(ws)
