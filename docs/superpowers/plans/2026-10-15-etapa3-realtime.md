# Etapa 3 — Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ConnectionManager em memória, os dois canais WebSocket (`/ws/m/{token}` e `/ws/operacao`), `estado.inicial`, ping/pong, emissão de eventos nos services (incluindo `mesa.atualizada`, M6) e o job de urgência (regra 6).

**Architecture:** Singleton `ConnectionManager` (`app/ws/manager.py`) guarda sockets em memória — `dict[str, set[WebSocket]]` para mesas (por token) e um `set[WebSocket]` único para operação (só existe 1 estabelecimento por instância, demo e produção — ver `docs/superpowers/specs/2026-10-15-etapa3-realtime-design.md`). Services (`mesa_service`, `solicitacao_service`) chamam o manager direto após `commit()`. Endpoints WS ficam em `app/routers/ws.py`, resolvem o estado inicial reusando os services já existentes. Um job assíncrono roda a cada 5s pro job de urgência.

**Tech Stack:** FastAPI WebSockets nativos, SQLAlchemy 2 async, `asyncio.create_task` pro job (sem Redis, sem Celery), `fastapi.testclient.TestClient` pros testes de WS (síncrono, diferente do `httpx.AsyncClient` usado nos testes REST).

## Global Constraints

- Entidades e campos de domínio em português; termos técnicos em inglês (seção 6 do CLAUDE.md).
- Regras de negócio e emissão de eventos moram em `services/`; routers (incluindo WS) ficam finos.
- API roda com 1 worker. ConnectionManager é em memória — nunca adicionar Redis.
- Só existe 1 estabelecimento por instância (demo e produção) — canal de operação não é particionado por `estabelecimento_id`.
- Sem Python local nesta máquina — todo teste roda via Docker. Prefixar comandos com volume (`-v`) no Git Bash com `MSYS_NO_PATHCONV=1`.
- `asyncio_mode = auto` já configurado em `api/pytest.ini` — fixtures e testes `async def` funcionam sem decorator.
- Commits pequenos, um por task.
- Fora do escopo: reconexão do front, consumo dos eventos pelo front (etapas 4-6), particionamento multi-estabelecimento (nunca necessário).

---

## Arquivos desta etapa

```
api/
  app/
    ws/
      __init__.py          # novo, vazio
      manager.py            # novo: ConnectionManager + singleton `manager`
    jobs/
      __init__.py          # novo, vazio
      urgencia.py            # novo: loop_urgencia()
    routers/
      ws.py                  # novo: WS /ws/m/{token} e /ws/operacao
      cliente.py              # modificado: obter_mesa usa mesa_service.obter_estado_cliente
    services/
      mesa_service.py          # modificado: obter_estado_cliente, emissão em abrir/fechar
      solicitacao_service.py    # modificado: emissão em criar/cancelar/aceitar/concluir, marcar_urgentes
    main.py                     # modificado: include_router(ws.router), lifespan com o job
  tests/
    test_ws_manager.py            # novo
    test_ws.py                     # novo
    test_emissao_mesa.py            # novo
    test_emissao_solicitacao.py      # novo
    test_urgencia.py                  # novo
```

---

### Task 1: ConnectionManager

**Files:**
- Create: `api/app/ws/__init__.py`
- Create: `api/app/ws/manager.py`
- Create: `api/tests/test_ws_manager.py`

**Interfaces:**
- Produces: `app.ws.manager.ConnectionManager` com `conectar_mesa(token: str, ws: WebSocket) -> None`, `desconectar_mesa(token: str, ws: WebSocket) -> None`, `conectar_operacao(ws: WebSocket) -> None`, `desconectar_operacao(ws: WebSocket) -> None`, `emitir_mesa(token: str, tipo: str, dados: dict) -> None`, `emitir_operacao(tipo: str, dados: dict) -> None`. Produces singleton `app.ws.manager.manager`.

- [ ] **Step 1: Write the failing test**

`api/tests/test_ws_manager.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose up -d db
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_ws_manager.py -v
```
Expected: FAIL com `ModuleNotFoundError: No module named 'app.ws'`.

- [ ] **Step 3: Write minimal implementation**

`api/app/ws/__init__.py`: arquivo vazio.

`api/app/ws/manager.py`:

```python
from collections.abc import Awaitable, Callable
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_ws_manager.py -v
```
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add api/app/ws api/tests/test_ws_manager.py
git commit -m "feat: add in-memory websocket connection manager"
```

---

### Task 2: Endpoints WebSocket + estado.inicial + ping/pong

**Files:**
- Create: `api/app/routers/ws.py`
- Modify: `api/app/services/mesa_service.py` (+ `obter_estado_cliente`)
- Modify: `api/app/routers/cliente.py` (`obter_mesa` passa a usar `mesa_service.obter_estado_cliente`)
- Modify: `api/app/main.py` (+ `include_router(ws.router)`)
- Create: `api/tests/test_ws.py`

**Interfaces:**
- Consumes: `app.ws.manager.manager` (Task 1); `mesa_service.buscar_mesa_por_token`, `solicitacao_service.listar_ativas_por_mesa`, `mesa_service.listar_mesas`, `solicitacao_service.listar_solicitacoes` (etapa 2); `app.security.decode_token` (etapa 2); `app.exceptions.MesaNaoEncontrada` (etapa 2).
- Produces: `mesa_service.obter_estado_cliente(session: AsyncSession, token: str) -> MesaClienteOut`. Produces WS routes `GET /ws/m/{token}` e `GET /ws/operacao?token=`.

- [ ] **Step 1: Write the failing test**

`api/tests/test_ws.py`:

```python
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


def test_ws_mesa_token_invalido_fecha_com_1008():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/m/token-inexistente"):
            pass
    assert excinfo.value.code == 1008


def test_ws_mesa_valida_recebe_estado_inicial(mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/m/{mesa_aberta.token}") as ws:
        mensagem = ws.receive_json()
        assert mensagem["tipo"] == "estado.inicial"
        assert mensagem["dados"]["numero"] == mesa_aberta.numero
        assert mensagem["dados"]["status"] == "aberta"


def test_ws_mesa_responde_ping_com_pong(mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/m/{mesa_aberta.token}") as ws:
        ws.receive_json()  # estado.inicial
        ws.send_json({"tipo": "ping"})
        resposta = ws.receive_json()
        assert resposta == {"tipo": "pong"}


def test_ws_operacao_token_invalido_fecha_com_1008():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/operacao?token=invalido"):
            pass
    assert excinfo.value.code == 1008


def test_ws_operacao_token_valido_recebe_estado_inicial(token_operacao, mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/operacao?token={token_operacao}") as ws:
        mensagem = ws.receive_json()
        assert mensagem["tipo"] == "estado.inicial"
        assert "mesas" in mensagem["dados"]
        assert "solicitacoes" in mensagem["dados"]
        assert any(m["id"] == mesa_aberta.id for m in mensagem["dados"]["mesas"])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_ws.py -v
```
Expected: FAIL com `404 Not Found` nos WS (rota não existe ainda) ou `ModuleNotFoundError: No module named 'app.routers.ws'`.

- [ ] **Step 3: Write minimal implementation**

Add to `api/app/services/mesa_service.py` (depois de `listar_mesas`, antes de `abrir_mesa`):

```python
from app.schemas import MesaClienteOut, SolicitacaoOut
from app.services import solicitacao_service


async def obter_estado_cliente(session: AsyncSession, token: str) -> MesaClienteOut:
    mesa = await buscar_mesa_por_token(session, token)
    ativas = await solicitacao_service.listar_ativas_por_mesa(session, mesa.id)
    return MesaClienteOut(
        numero=mesa.numero,
        status=mesa.status,
        nome_estabelecimento=mesa.estabelecimento.nome,
        wifi_ssid=mesa.estabelecimento.wifi_ssid,
        wifi_senha=mesa.estabelecimento.wifi_senha,
        cardapio_url=mesa.estabelecimento.cardapio_url,
        solicitacoes_ativas=[SolicitacaoOut.model_validate(s) for s in ativas],
    )
```

(os dois imports novos vão no topo do arquivo, junto aos imports existentes)

Modify `api/app/routers/cliente.py` — substituir o corpo de `obter_mesa`:

```python
@router.get("/{token}", response_model=MesaClienteOut)
async def obter_mesa(token: str, session: AsyncSession = Depends(get_db)) -> MesaClienteOut:
    return await mesa_service.obter_estado_cliente(session, token)
```

(remove o import de `SolicitacaoOut` **não** — ele continua usado em `chamar_garcom`, `fechar_conta` e `cancelar`.)

`api/app/routers/ws.py`:

```python
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
```

Modify `api/app/main.py`:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import ErroNegocio
from app.routers import cliente, operacao, ws

app = FastAPI(title="Chamar Garçom API")
app.include_router(cliente.router)
app.include_router(operacao.router)
app.include_router(ws.router)


@app.exception_handler(ErroNegocio)
async def erro_negocio_handler(request: Request, exc: ErroNegocio) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"erro": exc.erro, **exc.extra})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_ws.py tests/test_solicitacao_service.py -v
```
Expected: PASS em todos (os de `test_solicitacao_service.py` continuam passando — `obter_estado_cliente` não muda comportamento de `listar_ativas_por_mesa`).

- [ ] **Step 5: Commit**

```bash
git add api/app/routers/ws.py api/app/services/mesa_service.py api/app/routers/cliente.py api/app/main.py api/tests/test_ws.py
git commit -m "feat: add websocket endpoints for mesa and operacao channels"
```

---

### Task 3: Emissão de eventos no mesa_service (M6)

**Files:**
- Modify: `api/app/services/mesa_service.py` (`abrir_mesa`, `fechar_mesa`)
- Create: `api/tests/test_emissao_mesa.py`

**Interfaces:**
- Consumes: `app.ws.manager.manager` (Task 1).
- Produces: nenhuma interface nova — `abrir_mesa`/`fechar_mesa` mantêm as mesmas assinaturas, só passam a emitir eventos como efeito colateral.

- [ ] **Step 1: Write the failing test**

`api/tests/test_emissao_mesa.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_emissao_mesa.py -v
```
Expected: FAIL — `chamadas_mesa`/`chamadas_operacao` ficam vazias (nenhuma emissão ainda).

- [ ] **Step 3: Write minimal implementation**

Replace `abrir_mesa` and `fechar_mesa` in `api/app/services/mesa_service.py`:

```python
async def abrir_mesa(session: AsyncSession, mesa_id: int) -> Mesa:
    mesa = await buscar_mesa_por_id(session, mesa_id)
    if mesa.status == StatusMesa.fechada:
        mesa.status = StatusMesa.aberta
        mesa.aberta_em = datetime.now(UTC)
        await session.commit()
        dados = MesaOut.model_validate(mesa).model_dump(mode="json")
        await manager.emitir_mesa(mesa.token, "mesa.atualizada", dados)
        await manager.emitir_operacao("mesa.atualizada", dados)
    return mesa


async def fechar_mesa(session: AsyncSession, mesa_id: int) -> Mesa:
    mesa = await buscar_mesa_por_id(session, mesa_id)
    if mesa.status == StatusMesa.aberta:
        ativas = (
            await session.execute(
                select(Solicitacao).where(
                    Solicitacao.mesa_id == mesa.id,
                    Solicitacao.status.in_([StatusSolicitacao.pendente, StatusSolicitacao.em_atendimento]),
                )
            )
        ).scalars().all()
        for solicitacao in ativas:
            if solicitacao.status == StatusSolicitacao.pendente:
                solicitacao.status = StatusSolicitacao.cancelado
            else:
                solicitacao.status = StatusSolicitacao.concluido
            solicitacao.concluido_em = datetime.now(UTC)

        mesa.status = StatusMesa.fechada
        mesa.aberta_em = None
        await session.commit()

        dados_mesa = MesaOut.model_validate(mesa).model_dump(mode="json")
        await manager.emitir_mesa(mesa.token, "mesa.atualizada", dados_mesa)
        await manager.emitir_operacao("mesa.atualizada", dados_mesa)
        for solicitacao in ativas:
            dados_solicitacao = SolicitacaoOut.model_validate(solicitacao).model_dump(mode="json")
            await manager.emitir_mesa(mesa.token, "solicitacao.atualizada", dados_solicitacao)
            await manager.emitir_operacao("solicitacao.atualizada", dados_solicitacao)
    return mesa
```

Add import at the top of `api/app/services/mesa_service.py`:

```python
from app.ws.manager import manager
```

- [ ] **Step 4: Run test to verify it passes**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_emissao_mesa.py tests/test_mesa_service.py -v
```
Expected: PASS em todos (os testes antigos de `test_mesa_service.py` não checam emissão e continuam passando).

- [ ] **Step 5: Commit**

```bash
git add api/app/services/mesa_service.py api/tests/test_emissao_mesa.py
git commit -m "feat: emit mesa.atualizada and solicitacao.atualizada events from mesa_service"
```

---

### Task 4: Emissão de eventos no solicitacao_service

**Files:**
- Modify: `api/app/services/solicitacao_service.py` (`criar_solicitacao`, `cancelar_solicitacao`, `aceitar_solicitacao`, `concluir_solicitacao`)
- Create: `api/tests/test_emissao_solicitacao.py`
- Modify: `api/tests/test_ws.py` (+ teste de integração REST → WS)

**Interfaces:**
- Consumes: `app.ws.manager.manager` (Task 1).
- Produces: `_token_mesa(session, mesa_id) -> str` (helper interno, não exportado).

- [ ] **Step 1: Write the failing test**

`api/tests/test_emissao_solicitacao.py`:

```python
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
```

Add to `api/tests/test_ws.py` (teste de integração, sem monkeypatch — usa o manager real):

```python
def test_criar_solicitacao_via_rest_notifica_ws_da_mesa(mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/m/{mesa_aberta.token}") as ws:
        ws.receive_json()  # estado.inicial
        resposta = client.post(f"/api/m/{mesa_aberta.token}/chamar-garcom")
        assert resposta.status_code == 201
        evento = ws.receive_json()
        assert evento["tipo"] == "solicitacao.criada"
        assert evento["dados"]["mesa_id"] == mesa_aberta.id
```

(`from app.main import app`, `from fastapi.testclient import TestClient` já importados no topo do arquivo pelo Task 2)

- [ ] **Step 2: Run test to verify it fails**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_emissao_solicitacao.py tests/test_ws.py -v
```
Expected: FAIL — nenhuma chamada registrada / `ws.receive_json()` do teste de integração trava até timeout (nenhum evento é enviado ainda).

- [ ] **Step 3: Write minimal implementation**

Replace the body of `api/app/services/solicitacao_service.py` from the imports through `concluir_solicitacao` with:

```python
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    AceiteConcorrente,
    CancelamentoInvalido,
    ConclusaoInvalida,
    EmCooldown,
    MesaFechada,
    SolicitacaoAtiva,
    SolicitacaoNaoEncontrada,
)
from app.models import FormaPagamento, Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
from app.schemas import SolicitacaoOut
from app.ws.manager import manager

ATIVOS = (StatusSolicitacao.pendente, StatusSolicitacao.em_atendimento)
CONCLUIDOS = (StatusSolicitacao.concluido, StatusSolicitacao.cancelado)


async def _token_mesa(session: AsyncSession, mesa_id: int) -> str:
    return (await session.execute(select(Mesa.token).where(Mesa.id == mesa_id))).scalar_one()


async def _emitir_solicitacao(session: AsyncSession, solicitacao: Solicitacao, tipo: str) -> None:
    token = await _token_mesa(session, solicitacao.mesa_id)
    dados = SolicitacaoOut.model_validate(solicitacao).model_dump(mode="json")
    await manager.emitir_mesa(token, tipo, dados)
    await manager.emitir_operacao(tipo, dados)


async def _validar_sem_ativa(session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao) -> None:
    ativa = (
        await session.execute(
            select(Solicitacao).where(
                Solicitacao.mesa_id == mesa.id, Solicitacao.tipo == tipo, Solicitacao.status.in_(ATIVOS)
            )
        )
    ).scalars().first()
    if ativa is not None:
        raise SolicitacaoAtiva()


async def _validar_cooldown(session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao) -> None:
    ultima = (
        await session.execute(
            select(Solicitacao)
            .where(
                Solicitacao.mesa_id == mesa.id,
                Solicitacao.tipo == tipo,
                Solicitacao.status.in_(CONCLUIDOS),
                Solicitacao.criado_em >= mesa.aberta_em,
            )
            .order_by(Solicitacao.concluido_em.desc())
            .limit(1)
        )
    ).scalars().first()
    if ultima is None or ultima.concluido_em is None:
        return
    decorrido = (datetime.now(UTC) - ultima.concluido_em).total_seconds()
    cooldown = mesa.estabelecimento.cfg_cooldown_seg
    if decorrido < cooldown:
        raise EmCooldown(segundos_restantes=int(cooldown - decorrido))


async def criar_solicitacao(
    session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao, forma_pagamento: FormaPagamento | None = None
) -> Solicitacao:
    if mesa.status != StatusMesa.aberta:
        raise MesaFechada()
    await _validar_sem_ativa(session, mesa, tipo)
    await _validar_cooldown(session, mesa, tipo)

    solicitacao = Solicitacao(mesa_id=mesa.id, tipo=tipo, forma_pagamento=forma_pagamento)
    session.add(solicitacao)
    await session.commit()
    await session.refresh(solicitacao)
    await _emitir_solicitacao(session, solicitacao, "solicitacao.criada")
    return solicitacao


async def cancelar_solicitacao(session: AsyncSession, solicitacao_id: int, mesa_id: int) -> Solicitacao:
    solicitacao = (
        await session.execute(
            select(Solicitacao).where(Solicitacao.id == solicitacao_id, Solicitacao.mesa_id == mesa_id)
        )
    ).scalars().first()
    if solicitacao is None:
        raise SolicitacaoNaoEncontrada()
    if solicitacao.status != StatusSolicitacao.pendente:
        raise CancelamentoInvalido()
    solicitacao.status = StatusSolicitacao.cancelado
    solicitacao.concluido_em = datetime.now(UTC)
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao


async def aceitar_solicitacao(session: AsyncSession, solicitacao_id: int) -> Solicitacao:
    resultado = await session.execute(
        update(Solicitacao)
        .where(Solicitacao.id == solicitacao_id, Solicitacao.status == StatusSolicitacao.pendente)
        .values(status=StatusSolicitacao.em_atendimento, aceito_em=datetime.now(UTC))
        .returning(Solicitacao)
    )
    solicitacao = resultado.scalars().first()
    if solicitacao is None:
        existe = (
            await session.execute(select(Solicitacao).where(Solicitacao.id == solicitacao_id))
        ).scalars().first()
        if existe is None:
            raise SolicitacaoNaoEncontrada()
        raise AceiteConcorrente()
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao


async def concluir_solicitacao(session: AsyncSession, solicitacao_id: int) -> Solicitacao:
    solicitacao = (
        await session.execute(select(Solicitacao).where(Solicitacao.id == solicitacao_id))
    ).scalars().first()
    if solicitacao is None:
        raise SolicitacaoNaoEncontrada()
    if solicitacao.status != StatusSolicitacao.em_atendimento:
        raise ConclusaoInvalida()
    solicitacao.status = StatusSolicitacao.concluido
    solicitacao.concluido_em = datetime.now(UTC)
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao
```

(`listar_ativas_por_mesa` e `listar_solicitacoes`, no final do arquivo, ficam exatamente como estão — não fazem parte deste replace.)

- [ ] **Step 4: Run test to verify it passes**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_emissao_solicitacao.py tests/test_ws.py tests/test_solicitacao_service.py -v
```
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add api/app/services/solicitacao_service.py api/tests/test_emissao_solicitacao.py api/tests/test_ws.py
git commit -m "feat: emit solicitacao events from solicitacao_service"
```

---

### Task 5: Job de urgência (regra 6)

**Files:**
- Modify: `api/app/services/solicitacao_service.py` (+ `marcar_urgentes`)
- Create: `api/app/jobs/__init__.py`
- Create: `api/app/jobs/urgencia.py`
- Modify: `api/app/main.py` (+ `lifespan` que inicia/cancela o job)
- Create: `api/tests/test_urgencia.py`

**Interfaces:**
- Consumes: `app.ws.manager.manager`, `_emitir_solicitacao` (Task 4, interno ao módulo).
- Produces: `solicitacao_service.marcar_urgentes(session: AsyncSession) -> list[Solicitacao]`; `app.jobs.urgencia.loop_urgencia() -> None` (coroutine infinita).

- [ ] **Step 1: Write the failing test**

`api/tests/test_urgencia.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_urgencia.py -v
```
Expected: FAIL com `AttributeError: module 'app.services.solicitacao_service' has no attribute 'marcar_urgentes'`.

- [ ] **Step 3: Write minimal implementation**

Add to `api/app/services/solicitacao_service.py` (after `concluir_solicitacao`, before `listar_ativas_por_mesa`):

```python
async def marcar_urgentes(session: AsyncSession) -> list[Solicitacao]:
    estabelecimento = (await session.execute(select(Estabelecimento))).scalars().first()
    if estabelecimento is None:
        return []
    limite = datetime.now(UTC) - timedelta(seconds=estabelecimento.cfg_urgente_seg)
    resultado = await session.execute(
        update(Solicitacao)
        .where(
            Solicitacao.status == StatusSolicitacao.pendente,
            Solicitacao.urgente.is_(False),
            Solicitacao.criado_em < limite,
        )
        .values(urgente=True)
        .returning(Solicitacao)
    )
    atualizados = resultado.scalars().all()
    if atualizados:
        await session.commit()
        for solicitacao in atualizados:
            await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return atualizados
```

Add to the imports at the top of `api/app/services/solicitacao_service.py`:

```python
from datetime import UTC, datetime, timedelta
```
(replace the existing `from datetime import UTC, datetime` line with the one above)

```python
from app.models import Estabelecimento, FormaPagamento, Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
```
(replace the existing `from app.models import ...` line with the one above — adds `Estabelecimento`)

`api/app/jobs/__init__.py`: arquivo vazio.

`api/app/jobs/urgencia.py`:

```python
import asyncio

from app.db import async_session
from app.services import solicitacao_service

INTERVALO_SEG = 5


async def loop_urgencia() -> None:
    while True:
        await asyncio.sleep(INTERVALO_SEG)
        async with async_session() as session:
            await solicitacao_service.marcar_urgentes(session)
```

Modify `api/app/main.py`:

```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import ErroNegocio
from app.jobs.urgencia import loop_urgencia
from app.routers import cliente, operacao, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    tarefa = asyncio.create_task(loop_urgencia())
    yield
    tarefa.cancel()


app = FastAPI(title="Chamar Garçom API", lifespan=lifespan)
app.include_router(cliente.router)
app.include_router(operacao.router)
app.include_router(ws.router)


@app.exception_handler(ErroNegocio)
async def erro_negocio_handler(request: Request, exc: ErroNegocio) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"erro": exc.erro, **exc.extra})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest tests/test_urgencia.py -v
```
Expected: PASS (3 passed).

- [ ] **Step 5: Full test suite**

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm -v "$(pwd)/api/tests:/app/tests" api pytest -v
```
Expected: todos os testes passam (os de etapas 1-2 inclusos).

- [ ] **Step 6: Smoke test manual com o servidor rodando**

```bash
docker compose up -d --build db api
TOKEN=$(curl -s -X POST http://localhost:8000/api/operacao/login -H "Content-Type: application/json" -d '{"username":"demo","senha":"demo123"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://localhost:8000/api/operacao/mesas/1/abrir -H "Authorization: Bearer $TOKEN"
```
Abra duas conexões WS (ex.: `websocat`, ou um client de WS qualquer) pra `ws://localhost:8000/ws/operacao?token=$TOKEN` e pra `ws://localhost:8000/ws/m/<token-da-mesa-1>` — a segunda recebe `estado.inicial` com a mesa aberta; a primeira recebe `estado.inicial` com a lista de mesas. Em seguida:
```bash
curl -s -X POST http://localhost:8000/api/m/<token-da-mesa-1>/chamar-garcom
```
Expected: ambas as conexões WS recebem um evento `solicitacao.criada` em tempo real.

- [ ] **Step 7: Commit**

```bash
git add api/app/services/solicitacao_service.py api/app/jobs api/app/main.py api/tests/test_urgencia.py
git commit -m "feat: add background job to flag urgent pending solicitacoes"
```

---

## Verification checklist (end of etapa 3)

- [ ] `pytest` (todos os arquivos em `api/tests/`) passa, rodando contra Postgres real via Docker
- [ ] `WS /ws/m/{token}` com token inválido fecha com código 1008
- [ ] `WS /ws/m/{token}` válido recebe `estado.inicial` com os dados da mesa
- [ ] `WS /ws/operacao?token=` com JWT inválido fecha com código 1008
- [ ] `WS /ws/operacao?token=` válido recebe `estado.inicial` com `mesas` e `solicitacoes`
- [ ] Ping/pong funciona nos dois canais
- [ ] M6: abrir/fechar mesa emite `mesa.atualizada` pro canal da mesa e da operação
- [ ] M2 + realtime: fechar mesa com chamados ativos emite `solicitacao.atualizada` pra cada um
- [ ] Criar/cancelar/aceitar/concluir solicitação emite o evento correspondente nos dois canais
- [ ] Regra 6: chamado `pendente` passa de `cfg_urgente_seg` segundos e vira `urgente=true`, emitindo evento, sem intervenção manual (job roda a cada 5s)
- [ ] API continua rodando com 1 worker, sem Redis
