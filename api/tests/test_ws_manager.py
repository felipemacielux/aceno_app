from app.ws.manager import ConnectionManager


class FakeWebSocket:
    def __init__(self, falha: bool = False) -> None:
        self.falha = falha
        self.aceita = False
        self.enviados: list[dict] = []

    async def accept(self) -> None:
        self.aceita = True

    async def send_json(self, dados: dict) -> None:
        if self.falha:
            raise RuntimeError("conexao fechada")
        self.enviados.append(dados)


async def test_conectar_mesa_aceita_e_registra_conexao():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    await manager.conectar_mesa("tok1", ws)
    assert ws.aceita is True
    assert ws in manager.mesa_conexoes["tok1"]


async def test_emitir_mesa_envia_para_conexao_registrada():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    await manager.conectar_mesa("tok1", ws)
    await manager.emitir_mesa("tok1", "solicitacao.criada", {"id": 1})
    assert ws.enviados == [{"tipo": "solicitacao.criada", "dados": {"id": 1}}]


async def test_emitir_mesa_sem_conexao_nao_levanta_erro():
    manager = ConnectionManager()
    await manager.emitir_mesa("inexistente", "x", {})


async def test_emitir_mesa_remove_conexao_que_falha_ao_enviar():
    manager = ConnectionManager()
    ws = FakeWebSocket(falha=True)
    await manager.conectar_mesa("tok1", ws)
    await manager.emitir_mesa("tok1", "x", {})
    assert "tok1" not in manager.mesa_conexoes


async def test_desconectar_mesa_remove_do_set():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    await manager.conectar_mesa("tok1", ws)
    manager.desconectar_mesa("tok1", ws)
    assert "tok1" not in manager.mesa_conexoes


async def test_conectar_e_emitir_operacao():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    await manager.conectar_operacao(ws)
    await manager.emitir_operacao("mesa.atualizada", {"id": 2})
    assert ws.enviados == [{"tipo": "mesa.atualizada", "dados": {"id": 2}}]


async def test_desconectar_operacao_remove_do_set():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    await manager.conectar_operacao(ws)
    manager.desconectar_operacao(ws)
    assert ws not in manager.operacao_conexoes
