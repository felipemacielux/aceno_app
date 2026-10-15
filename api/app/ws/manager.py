from collections.abc import Callable
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.mesa_conexoes: dict[str, set[WebSocket]] = {}
        self.operacao_conexoes: set[WebSocket] = set()

    async def conectar_mesa(self, token: str, ws: WebSocket) -> None:
        await ws.accept()
        self.mesa_conexoes.setdefault(token, set()).add(ws)

    def desconectar_mesa(self, token: str, ws: WebSocket) -> None:
        conexoes = self.mesa_conexoes.get(token)
        if conexoes is None:
            return
        conexoes.discard(ws)
        if not conexoes:
            del self.mesa_conexoes[token]

    async def conectar_operacao(self, ws: WebSocket) -> None:
        await ws.accept()
        self.operacao_conexoes.add(ws)

    def desconectar_operacao(self, ws: WebSocket) -> None:
        self.operacao_conexoes.discard(ws)

    async def emitir_mesa(self, token: str, tipo: str, dados: dict[str, Any]) -> None:
        for ws in list(self.mesa_conexoes.get(token, ())):
            await self._enviar(ws, tipo, dados, lambda: self.desconectar_mesa(token, ws))

    async def emitir_operacao(self, tipo: str, dados: dict[str, Any]) -> None:
        for ws in list(self.operacao_conexoes):
            await self._enviar(ws, tipo, dados, lambda: self.desconectar_operacao(ws))

    async def _enviar(
        self, ws: WebSocket, tipo: str, dados: dict[str, Any], ao_falhar: Callable[[], None]
    ) -> None:
        try:
            await ws.send_json({"tipo": tipo, "dados": dados})
        except Exception:
            ao_falhar()


manager = ConnectionManager()
