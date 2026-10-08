# Etapa 2 — Regras e API REST Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Services de mesa e solicitação implementando as regras M1-M4 e 1-5 (CLAUDE.md seção 3), endpoints REST do cliente e da operação, autenticação JWT, e testes contra Postgres real (Docker).

**Architecture:** Routers finos (`app/routers/`) chamam services (`app/services/`) que fazem toda regra de negócio e persistência via SQLAlchemy async. Erros de negócio são exceções Python dedicadas (`app/exceptions.py`), convertidas em respostas HTTP por um exception handler único no FastAPI — nenhum router escreve `HTTPException` manualmente. Autenticação da operação é JWT stateless (sem tabela de sessão); o cliente não autentica, usa o `token` da mesa (UUID na URL) como capability token.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, PyJWT, passlib[bcrypt] (já no projeto), pytest + pytest-asyncio contra o mesmo Postgres do `docker-compose.yml`.

## Global Constraints

- Entidades e campos de domínio em português (`mesa`, `solicitacao`, `forma_pagamento`). Termos técnicos em inglês (`router`, `service`, `manager`).
- Python: type hints em tudo.
- Regras de negócio moram em `services/`; routers ficam finos (seção 6 do CLAUDE.md).
- API roda com 1 worker, sem Redis.
- Fora de escopo nesta etapa (fica para etapa 3): job de urgência (regra 6), evento `mesa.atualizada`/WebSocket (M6), diálogo "Fechar a Mesa N?" (M5, é só UX do front).
- Sem tabela de métricas/endpoint de métricas nesta etapa — isso é etapa 5 (card de métricas no front da operação); construir agora seria escopo além do pedido.
- Sem variável de URL nos fronts — não se aplica a esta etapa (back-end only).
- Datas em UTC (`timestamptz`), já garantido pelo schema da etapa 1.
- Commits pequenos, um por task.
- Sem Python local nesta máquina — todo `pytest`/`pip install` roda via Docker. Ver gotcha: prefixar comandos de volume no Git Bash com `MSYS_NO_PATHCONV=1`.
- `passlib==1.7.4` requer `bcrypt==4.0.1` pinado (já no `requirements.txt`).

---

## Arquivos desta etapa

```
api/
  app/
    config.py           # + jwt_secret, jwt_expire_horas
    security.py          # novo: hash/verify senha, criar/decodificar JWT
    exceptions.py         # novo: exceções de negócio -> status HTTP
    schemas.py            # novo: Pydantic request/response
    deps.py                # novo: get_db, get_usuario_atual
    main.py                # + exception handler, include_router
    services/
      __init__.py
      mesa_service.py
      solicitacao_service.py
    routers/
      __init__.py
      cliente.py
      operacao.py
  tests/
    conftest.py            # + fixtures de banco/estabelecimento/mesa/usuario
    test_auth.py
    test_mesa_service.py
    test_solicitacao_service.py
  requirements.txt          # + pyjwt==2.9.0
```

---

### Task 1: Autenticação JWT + fixtures de teste

**Files:**
- Create: `api/app/security.py`
- Create: `api/app/exceptions.py`
- Create: `api/app/deps.py`
- Create: `api/app/schemas.py`
- Create: `api/app/routers/__init__.py` (empty)
- Create: `api/app/routers/operacao.py` (só login nesta task)
- Modify: `api/app/config.py`
- Modify: `api/app/main.py`
- Modify: `api/tests/conftest.py`
- Create: `api/tests/test_auth.py`
- Modify: `api/requirements.txt`

**Interfaces:**
- Produces: `app.security.criar_token(dados: dict) -> str`, `app.security.decode_token(token: str) -> dict | None`, `app.security.verificar_senha(senha: str, senha_hash: str) -> bool`
- Produces: `app.exceptions.ErroNegocio` (base, tem `.status_code: int`, `.erro: str`, `.extra: dict`) e subclasses `CredenciaisInvalidas` (401)
- Produces: `app.deps.get_db` (dependency, yields `AsyncSession`), `app.deps.get_usuario_atual` (dependency, retorna `dict` do payload JWT ou levanta `CredenciaisInvalidas`)
- Produces fixtures de teste: `estabelecimento`, `usuario` (ambas retornam a entidade ORM já commitada), `client` (TestClient)

- [ ] **Step 1: Write the failing test**

`api/tests/test_auth.py`:

```python
async def test_login_com_credenciais_corretas_retorna_token(client, usuario):
    response = await client.post(
        "/api/operacao/login", json={"username": usuario.username, "senha": "senha123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_com_senha_errada_retorna_401(client, usuario):
    response = await client.post(
        "/api/operacao/login", json={"username": usuario.username, "senha": "errada"}
    )
    assert response.status_code == 401
    assert response.json()["erro"] == "credenciais_invalidas"


async def test_login_com_usuario_inexistente_retorna_401(client):
    response = await client.post(
        "/api/operacao/login", json={"username": "ninguem", "senha": "x"}
    )
    assert response.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`, container with `db` migrado): `pytest tests/test_auth.py -v`
Expected: FAIL com `fixture 'usuario' not found` (ou `ModuleNotFoundError`, conforme ordem de criação de arquivo).

- [ ] **Step 3: Write minimal implementation**

`api/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aceno:aceno@localhost:5432/aceno"
    jwt_secret: str = "dev-secret-troque-em-producao"
    jwt_expire_horas: int = 12

    class Config:
        env_file = ".env"


settings = Settings()
```

`api/app/security.py`:

```python
from datetime import UTC, datetime, timedelta

import jwt
from passlib.hash import bcrypt

from app.config import settings

ALGORITHM = "HS256"


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return bcrypt.verify(senha, senha_hash)


def criar_token(dados: dict) -> str:
    expira = datetime.now(UTC) + timedelta(hours=settings.jwt_expire_horas)
    payload = {**dados, "exp": expira}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
```

`api/app/exceptions.py`:

```python
class ErroNegocio(Exception):
    status_code = 400
    erro = "erro"

    def __init__(self, **extra: object) -> None:
        self.extra = extra
        super().__init__(self.erro)


class CredenciaisInvalidas(ErroNegocio):
    status_code = 401
    erro = "credenciais_invalidas"


class MesaNaoEncontrada(ErroNegocio):
    status_code = 404
    erro = "mesa_nao_encontrada"


class MesaFechada(ErroNegocio):
    status_code = 409
    erro = "mesa_fechada"


class SolicitacaoAtiva(ErroNegocio):
    status_code = 409
    erro = "solicitacao_ativa"


class EmCooldown(ErroNegocio):
    status_code = 429
    erro = "cooldown"


class SolicitacaoNaoEncontrada(ErroNegocio):
    status_code = 404
    erro = "solicitacao_nao_encontrada"


class CancelamentoInvalido(ErroNegocio):
    status_code = 409
    erro = "cancelamento_invalido"


class AceiteConcorrente(ErroNegocio):
    status_code = 409
    erro = "solicitacao_ja_aceita"


class ConclusaoInvalida(ErroNegocio):
    status_code = 409
    erro = "conclusao_invalida"
```

`api/app/deps.py`:

```python
from collections.abc import AsyncGenerator

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session
from app.exceptions import CredenciaisInvalidas
from app.security import decode_token


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_usuario_atual(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise CredenciaisInvalidas()
    payload = decode_token(authorization.removeprefix("Bearer "))
    if payload is None:
        raise CredenciaisInvalidas()
    return payload
```

`api/app/schemas.py`:

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

`api/app/routers/__init__.py`: empty file.

`api/app/routers/operacao.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.exceptions import CredenciaisInvalidas
from app.models import UsuarioOperacao
from app.schemas import LoginRequest, LoginResponse
from app.security import criar_token, verificar_senha

router = APIRouter(prefix="/api/operacao", tags=["operacao"])


@router.post("/login", response_model=LoginResponse)
async def login(dados: LoginRequest, session: AsyncSession = Depends(get_db)) -> LoginResponse:
    usuario = (
        await session.execute(select(UsuarioOperacao).where(UsuarioOperacao.username == dados.username))
    ).scalars().first()
    if usuario is None or not verificar_senha(dados.senha, usuario.senha_hash):
        raise CredenciaisInvalidas()
    token = criar_token({"sub": usuario.username, "estabelecimento_id": usuario.estabelecimento_id})
    return LoginResponse(access_token=token)
```

`api/app/main.py`:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import ErroNegocio
from app.routers import operacao

app = FastAPI(title="Chamar Garçom API")
app.include_router(operacao.router)


@app.exception_handler(ErroNegocio)
async def erro_negocio_handler(request: Request, exc: ErroNegocio) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"erro": exc.erro, **exc.extra})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`api/tests/conftest.py`:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest
from passlib.hash import bcrypt
from sqlalchemy import text

from app.db import async_session, engine
from app.main import app
from app.models import Estabelecimento, UsuarioOperacao


@pytest.fixture(autouse=True)
async def limpar_banco():
    async with async_session() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE solicitacao, mesa, usuario_operacao, estabelecimento "
                "RESTART IDENTITY CASCADE"
            )
        )
        await session.commit()
    yield
    # pytest-asyncio abre um novo event loop por teste; conexões pooladas do
    # loop anterior quebram no próximo teste ("another operation is in
    # progress"). Descartar o pool força reconexão limpa a cada teste.
    await engine.dispose()


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def estabelecimento():
    async with async_session() as session:
        est = Estabelecimento(
            nome="Restaurante Teste",
            wifi_ssid="TesteWifi",
            wifi_senha="12345678",
            cardapio_url="https://exemplo.com/cardapio",
        )
        session.add(est)
        await session.commit()
        await session.refresh(est)
        return est


@pytest.fixture
async def usuario(estabelecimento):
    async with async_session() as session:
        u = UsuarioOperacao(
            estabelecimento_id=estabelecimento.id,
            username="garcom_teste",
            senha_hash=bcrypt.hash("senha123"),
        )
        session.add(u)
        await session.commit()
        await session.refresh(u)
        return u
```

Add to `api/requirements.txt`: `pyjwt==2.9.0`

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`): `pip install -r requirements.txt && pytest tests/test_auth.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add api/app/security.py api/app/exceptions.py api/app/deps.py api/app/schemas.py api/app/routers api/app/config.py api/app/main.py api/tests/conftest.py api/tests/test_auth.py api/requirements.txt
git commit -m "feat: add jwt auth for operacao login"
```

---

### Task 2: Mesa service (M1-M4) + endpoints de mesa da operação

**Files:**
- Create: `api/app/services/__init__.py` (empty)
- Create: `api/app/services/mesa_service.py`
- Modify: `api/app/schemas.py` (+ `MesaOut`)
- Modify: `api/app/routers/operacao.py` (+ endpoints de mesa)
- Modify: `api/app/main.py` (nada a mudar — router já incluso)
- Modify: `api/tests/conftest.py` (+ fixtures `mesa`, `token_operacao`)
- Create: `api/tests/test_mesa_service.py`

**Interfaces:**
- Consumes: `app.exceptions.MesaNaoEncontrada`, `app.exceptions.MesaFechada` (Task 1); `app.models.Mesa`, `StatusMesa`, `Solicitacao`, `StatusSolicitacao` (etapa 1)
- Produces: `mesa_service.buscar_mesa_por_token(session, token) -> Mesa` (eager-loads `estabelecimento`), `mesa_service.buscar_mesa_por_id(session, mesa_id) -> Mesa` (idem), `mesa_service.listar_mesas(session) -> list[Mesa]`, `mesa_service.abrir_mesa(session, mesa_id) -> Mesa`, `mesa_service.fechar_mesa(session, mesa_id) -> Mesa`
- Produces endpoints: `GET /api/operacao/mesas`, `POST /api/operacao/mesas/{mesa_id}/abrir`, `POST /api/operacao/mesas/{mesa_id}/fechar` (todos exigem `Authorization: Bearer <token>`)

- [ ] **Step 1: Write the failing test**

`api/tests/test_mesa_service.py`:

```python
from datetime import UTC, datetime

import pytest

from app.db import async_session
from app.exceptions import MesaNaoEncontrada
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
from app.services import mesa_service


async def test_abrir_mesa_fechada_muda_status_e_marca_sessao(mesa):
    aberta = await mesa_service.abrir_mesa(async_session(), mesa.id)
    assert aberta.status == StatusMesa.aberta
    assert aberta.aberta_em is not None


async def test_abrir_mesa_ja_aberta_e_idempotente(mesa):
    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime(2026, 1, 1, tzinfo=UTC)
        await session.commit()

    resultado = await mesa_service.abrir_mesa(async_session(), mesa.id)
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
            await session.execute(
                __import__("sqlalchemy").select(Solicitacao).where(Solicitacao.mesa_id == mesa.id)
            )
        ).scalars().all()
        status_por_tipo = {s.tipo: s.status for s in solicitacoes}
        assert status_por_tipo[TipoSolicitacao.chamar_garcom] == StatusSolicitacao.cancelado
        assert status_por_tipo[TipoSolicitacao.fechar_conta] == StatusSolicitacao.concluido


async def test_fechar_mesa_ja_fechada_e_idempotente(mesa):
    resultado = await mesa_service.fechar_mesa(async_session(), mesa.id)
    assert resultado.status == StatusMesa.fechada


async def test_buscar_mesa_inexistente_levanta_erro():
    with pytest.raises(MesaNaoEncontrada):
        await mesa_service.buscar_mesa_por_id(async_session(), 999999)
```

Note: `async_session()` abre uma sessão por chamada aqui só para simplificar o teste (os services recebem `AsyncSession` já aberto); prefira `async with async_session() as session: await mesa_service.algo(session, ...)` se preferir sessão fechada explicitamente — ambos funcionam porque `expire_on_commit=False`.

Add to `api/tests/conftest.py`:

```python
@pytest.fixture
async def mesa(estabelecimento):
    async with async_session() as session:
        m = Mesa(estabelecimento_id=estabelecimento.id, numero=1, token="token-teste")
        session.add(m)
        await session.commit()
        await session.refresh(m)
        return m


@pytest.fixture
def token_operacao(usuario):
    from app.security import criar_token

    return criar_token({"sub": usuario.username, "estabelecimento_id": usuario.estabelecimento_id})
```

(add `from app.models import Mesa` to the existing import line in `conftest.py`)

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`): `pytest tests/test_mesa_service.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.services'`

- [ ] **Step 3: Write minimal implementation**

`api/app/services/__init__.py`: empty file.

`api/app/services/mesa_service.py`:

```python
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import MesaNaoEncontrada
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao


async def buscar_mesa_por_token(session: AsyncSession, token: str) -> Mesa:
    mesa = (
        await session.execute(
            select(Mesa).options(selectinload(Mesa.estabelecimento)).where(Mesa.token == token)
        )
    ).scalars().first()
    if mesa is None:
        raise MesaNaoEncontrada()
    return mesa


async def buscar_mesa_por_id(session: AsyncSession, mesa_id: int) -> Mesa:
    mesa = (
        await session.execute(
            select(Mesa).options(selectinload(Mesa.estabelecimento)).where(Mesa.id == mesa_id)
        )
    ).scalars().first()
    if mesa is None:
        raise MesaNaoEncontrada()
    return mesa


async def listar_mesas(session: AsyncSession) -> list[Mesa]:
    return (await session.execute(select(Mesa).order_by(Mesa.numero))).scalars().all()


async def abrir_mesa(session: AsyncSession, mesa_id: int) -> Mesa:
    mesa = await buscar_mesa_por_id(session, mesa_id)
    if mesa.status == StatusMesa.fechada:
        mesa.status = StatusMesa.aberta
        mesa.aberta_em = datetime.now(UTC)
        await session.commit()
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
    return mesa
```

Add to `api/app/schemas.py`:

```python
from datetime import datetime

from app.models import StatusMesa


class MesaOut(BaseModel):
    id: int
    numero: int
    status: StatusMesa
    aberta_em: datetime | None

    class Config:
        from_attributes = True
```

Modify `api/app/routers/operacao.py` — add imports and endpoints:

```python
from app.deps import get_db, get_usuario_atual
from app.schemas import LoginRequest, LoginResponse, MesaOut
from app.services import mesa_service


@router.get("/mesas", response_model=list[MesaOut])
async def listar_mesas(
    session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> list[MesaOut]:
    mesas = await mesa_service.listar_mesas(session)
    return [MesaOut.model_validate(m) for m in mesas]


@router.post("/mesas/{mesa_id}/abrir", response_model=MesaOut)
async def abrir_mesa(
    mesa_id: int, session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> MesaOut:
    mesa = await mesa_service.abrir_mesa(session, mesa_id)
    return MesaOut.model_validate(mesa)


@router.post("/mesas/{mesa_id}/fechar", response_model=MesaOut)
async def fechar_mesa(
    mesa_id: int, session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> MesaOut:
    mesa = await mesa_service.fechar_mesa(session, mesa_id)
    return MesaOut.model_validate(mesa)
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`): `pytest tests/test_mesa_service.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Smoke-test endpoints with running API**

Run: `docker compose up -d --build db api`, then (replace `<token>` with a login response):
```bash
curl -s -X POST http://localhost:8000/api/operacao/login -H "Content-Type: application/json" -d '{"username":"demo","senha":"demo123"}'
curl -s http://localhost:8000/api/operacao/mesas -H "Authorization: Bearer <token>"
```
Expected: login returns `access_token`; mesas list returns 10 seeded mesas (requires `python scripts/seed.py` already run — reuse etapa 1 seed).

- [ ] **Step 6: Commit**

```bash
git add api/app/services api/app/schemas.py api/app/routers/operacao.py api/tests/conftest.py api/tests/test_mesa_service.py
git commit -m "feat: add mesa service with open/close rules"
```

---

### Task 3: Solicitação service (regras 1-5) + endpoints cliente e operação

**Files:**
- Create: `api/app/services/solicitacao_service.py`
- Modify: `api/app/schemas.py` (+ `SolicitacaoOut`, `FecharContaRequest`, `MesaClienteOut`)
- Create: `api/app/routers/cliente.py`
- Modify: `api/app/routers/operacao.py` (+ endpoints de solicitação)
- Modify: `api/app/main.py` (+ `include_router(cliente.router)`)
- Modify: `api/tests/conftest.py` (+ fixture `mesa_aberta`)
- Create: `api/tests/test_solicitacao_service.py`

**Interfaces:**
- Consumes: `mesa_service.buscar_mesa_por_token`, `buscar_mesa_por_id` (Task 2); `app.exceptions.*` (Task 1)
- Produces: `solicitacao_service.criar_solicitacao(session, mesa, tipo, forma_pagamento=None) -> Solicitacao`, `cancelar_solicitacao(session, solicitacao_id, mesa_id) -> Solicitacao`, `aceitar_solicitacao(session, solicitacao_id) -> Solicitacao`, `concluir_solicitacao(session, solicitacao_id) -> Solicitacao`, `listar_ativas_por_mesa(session, mesa_id) -> list[Solicitacao]`, `listar_solicitacoes(session) -> list[Solicitacao]`
- Produces endpoints: `GET /api/m/{token}`, `POST /api/m/{token}/chamar-garcom`, `POST /api/m/{token}/fechar-conta`, `POST /api/m/{token}/solicitacoes/{id}/cancelar`, `GET /api/operacao/solicitacoes`, `POST /api/operacao/solicitacoes/{id}/aceitar`, `POST /api/operacao/solicitacoes/{id}/concluir`

- [ ] **Step 1: Write the failing test**

`api/tests/test_solicitacao_service.py`:

```python
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.db import async_session
from app.exceptions import (
    AceiteConcorrente,
    CancelamentoInvalido,
    ConclusaoInvalida,
    EmCooldown,
    MesaFechada,
    SolicitacaoAtiva,
)
from app.models import Solicitacao, StatusSolicitacao, TipoSolicitacao
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
        from app.models import FormaPagamento

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
        from app.models import Mesa

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
        s = Solicitacao(mesa_id=mesa_aberta.id, tipo=TipoSolicitacao.chamar_garcom, status=StatusSolicitacao.em_atendimento)
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
```

Add to `api/tests/conftest.py`:

```python
@pytest.fixture
async def mesa_aberta(mesa):
    async with async_session() as session:
        m = await session.get(Mesa, mesa.id)
        m.status = StatusMesa.aberta
        m.aberta_em = datetime.now(UTC)
        await session.commit()
        await session.refresh(m)
        return m
```

(add `from datetime import UTC, datetime` and `from app.models import StatusMesa` to `conftest.py` imports)

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`): `pytest tests/test_solicitacao_service.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.services.solicitacao_service'`

- [ ] **Step 3: Write minimal implementation**

`api/app/services/solicitacao_service.py`:

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

ATIVOS = (StatusSolicitacao.pendente, StatusSolicitacao.em_atendimento)
CONCLUIDOS = (StatusSolicitacao.concluido, StatusSolicitacao.cancelado)


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
    return solicitacao


async def listar_ativas_por_mesa(session: AsyncSession, mesa_id: int) -> list[Solicitacao]:
    return (
        await session.execute(
            select(Solicitacao).where(Solicitacao.mesa_id == mesa_id, Solicitacao.status.in_(ATIVOS))
        )
    ).scalars().all()


async def listar_solicitacoes(session: AsyncSession) -> list[Solicitacao]:
    return (
        await session.execute(select(Solicitacao).order_by(Solicitacao.criado_em.desc()))
    ).scalars().all()
```

Add to `api/app/schemas.py`:

```python
from datetime import datetime

from app.models import FormaPagamento, StatusSolicitacao, TipoSolicitacao


class SolicitacaoOut(BaseModel):
    id: int
    mesa_id: int
    tipo: TipoSolicitacao
    forma_pagamento: FormaPagamento | None
    status: StatusSolicitacao
    urgente: bool
    criado_em: datetime
    aceito_em: datetime | None
    concluido_em: datetime | None

    class Config:
        from_attributes = True


class FecharContaRequest(BaseModel):
    forma_pagamento: FormaPagamento


class MesaClienteOut(BaseModel):
    numero: int
    status: object
    nome_estabelecimento: str
    wifi_ssid: str
    wifi_senha: str
    cardapio_url: str
    solicitacoes_ativas: list[SolicitacaoOut]
```

(replace `status: object` with `status: StatusMesa` and add `from app.models import StatusMesa` — kept as `object` above only to show diff location; write the real type in the file.)

`api/app/routers/cliente.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models import TipoSolicitacao
from app.schemas import FecharContaRequest, MesaClienteOut, SolicitacaoOut
from app.services import mesa_service, solicitacao_service

router = APIRouter(prefix="/api/m", tags=["cliente"])


@router.get("/{token}", response_model=MesaClienteOut)
async def obter_mesa(token: str, session: AsyncSession = Depends(get_db)) -> MesaClienteOut:
    mesa = await mesa_service.buscar_mesa_por_token(session, token)
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


@router.post("/{token}/chamar-garcom", response_model=SolicitacaoOut, status_code=201)
async def chamar_garcom(token: str, session: AsyncSession = Depends(get_db)) -> SolicitacaoOut:
    mesa = await mesa_service.buscar_mesa_por_token(session, token)
    solicitacao = await solicitacao_service.criar_solicitacao(session, mesa, TipoSolicitacao.chamar_garcom)
    return SolicitacaoOut.model_validate(solicitacao)


@router.post("/{token}/fechar-conta", response_model=SolicitacaoOut, status_code=201)
async def fechar_conta(
    token: str, dados: FecharContaRequest, session: AsyncSession = Depends(get_db)
) -> SolicitacaoOut:
    mesa = await mesa_service.buscar_mesa_por_token(session, token)
    solicitacao = await solicitacao_service.criar_solicitacao(
        session, mesa, TipoSolicitacao.fechar_conta, dados.forma_pagamento
    )
    return SolicitacaoOut.model_validate(solicitacao)


@router.post("/{token}/solicitacoes/{solicitacao_id}/cancelar", response_model=SolicitacaoOut)
async def cancelar(token: str, solicitacao_id: int, session: AsyncSession = Depends(get_db)) -> SolicitacaoOut:
    mesa = await mesa_service.buscar_mesa_por_token(session, token)
    solicitacao = await solicitacao_service.cancelar_solicitacao(session, solicitacao_id, mesa.id)
    return SolicitacaoOut.model_validate(solicitacao)
```

Modify `api/app/routers/operacao.py` — add imports and endpoints:

```python
from app.schemas import SolicitacaoOut
from app.services import solicitacao_service


@router.get("/solicitacoes", response_model=list[SolicitacaoOut])
async def listar_solicitacoes(
    session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> list[SolicitacaoOut]:
    solicitacoes = await solicitacao_service.listar_solicitacoes(session)
    return [SolicitacaoOut.model_validate(s) for s in solicitacoes]


@router.post("/solicitacoes/{solicitacao_id}/aceitar", response_model=SolicitacaoOut)
async def aceitar(
    solicitacao_id: int, session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> SolicitacaoOut:
    solicitacao = await solicitacao_service.aceitar_solicitacao(session, solicitacao_id)
    return SolicitacaoOut.model_validate(solicitacao)


@router.post("/solicitacoes/{solicitacao_id}/concluir", response_model=SolicitacaoOut)
async def concluir(
    solicitacao_id: int, session: AsyncSession = Depends(get_db), _usuario: dict = Depends(get_usuario_atual)
) -> SolicitacaoOut:
    solicitacao = await solicitacao_service.concluir_solicitacao(session, solicitacao_id)
    return SolicitacaoOut.model_validate(solicitacao)
```

Modify `api/app/main.py` — add import and include:

```python
from app.routers import cliente, operacao

app.include_router(cliente.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`): `pytest tests/test_solicitacao_service.py -v`
Expected: PASS (10 passed)

- [ ] **Step 5: Full test suite + smoke test**

Run (from `api/`): `pytest -v`
Expected: all tests across `test_health.py`, `test_models.py`, `test_seed.py`, `test_auth.py`, `test_mesa_service.py`, `test_solicitacao_service.py` pass.

Run: `docker compose up -d --build db api`, with seed applied, then:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/operacao/login -H "Content-Type: application/json" -d '{"username":"demo","senha":"demo123"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://localhost:8000/api/operacao/mesas/1/abrir -H "Authorization: Bearer $TOKEN"
MESA_TOKEN=$(curl -s http://localhost:8000/api/operacao/mesas -H "Authorization: Bearer $TOKEN" | python -c "import sys,json;print([m for m in json.load(sys.stdin) if m['id']==1])")
curl -s http://localhost:8000/api/m/<token-da-mesa-1>
curl -s -X POST http://localhost:8000/api/m/<token-da-mesa-1>/chamar-garcom
curl -s -X POST http://localhost:8000/api/operacao/solicitacoes/1/aceitar -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:8000/api/operacao/solicitacoes/1/concluir -H "Authorization: Bearer $TOKEN"
```
Expected: chamado criado pendente, aceito, concluído, sem erros 4xx/5xx inesperados.

- [ ] **Step 6: Commit**

```bash
git add api/app/services/solicitacao_service.py api/app/schemas.py api/app/routers api/app/main.py api/tests/conftest.py api/tests/test_solicitacao_service.py
git commit -m "feat: add solicitacao service and rest endpoints for cliente and operacao"
```

---

## Verification checklist (end of etapa 2)

- [ ] `pytest` (todos os arquivos em `api/tests/`) passa, rodando contra Postgres real via Docker
- [ ] `POST /api/operacao/login` com credenciais do seed (`demo`/`demo123`) retorna JWT válido
- [ ] Endpoints da operação (`/api/operacao/mesas*`, `/api/operacao/solicitacoes*`) exigem `Authorization: Bearer` e retornam 401 sem token
- [ ] M1: criar solicitação em mesa fechada → 409 `mesa_fechada`
- [ ] M2: fechar mesa com chamados ativos cancela pendentes e conclui em-atendimento
- [ ] M3: abrir mesa aberta / fechar mesa fechada são idempotentes (200, sem mudança)
- [ ] M4: cooldown não conta chamados de sessão anterior após reabertura
- [ ] Regra 1: duas solicitações ativas do mesmo tipo na mesma mesa → 409 `solicitacao_ativa`
- [ ] Regra 2: solicitação antes do cooldown expirar → 429 `cooldown` com `segundos_restantes`
- [ ] Regra 3: cancelar fora de `pendente` → 409 `cancelamento_invalido`
- [ ] Regra 4: aceite concorrente — segundo aceite → 409 `solicitacao_ja_aceita`
- [ ] Regra 5: concluir fora de `em_atendimento` → 409 `conclusao_invalida`
