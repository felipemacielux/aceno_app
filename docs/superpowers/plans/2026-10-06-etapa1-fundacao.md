# Etapa 1 — Fundação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo rodando com `docker compose up`: Postgres + FastAPI (`/health`), modelo de dados via Alembic, e script de seed com 1 estabelecimento + 10 mesas + 1 usuário de operação.

**Architecture:** API em FastAPI (Python 3.12, uvicorn 1 worker), SQLAlchemy 2 async + asyncpg contra Postgres 16, migrações via Alembic, seed via script standalone async. Tudo em containers Docker (`db`, `api`); Caddy e fronts entram em etapas futuras.

**Tech Stack:** FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, Pydantic v2 / pydantic-settings, passlib[bcrypt], pytest + httpx, Docker Compose.

## Global Constraints

- Entidades e campos de domínio em português (`mesa`, `solicitacao`, `forma_pagamento`). Termos técnicos em inglês (`router`, `service`, `manager`).
- Python: type hints em tudo.
- API roda com **1 worker** (`uvicorn --workers 1`). Sem Redis.
- Datas em UTC (`timestamptz`) no banco.
- Regras de negócio (M1-M6, regras 1-7) NÃO são implementadas nesta etapa — só o schema que as suporta.
- Commits pequenos, um por task.

---

## Arquivos desta etapa

```
aceno_app/
  api/
    app/
      __init__.py
      config.py          # Settings (DATABASE_URL)
      db.py               # engine + session factory
      models.py           # Base + 4 tabelas + enums
      main.py             # FastAPI app + /health
    alembic/
      env.py
      script.py.mako
      versions/
        0001_fundacao.py
    alembic.ini
    scripts/
      seed.py
    tests/
      conftest.py
      test_health.py
    requirements.txt
    Dockerfile
  docker-compose.yml
```

---

### Task 1: Monorepo scaffold, FastAPI `/health`, Docker Compose

**Files:**
- Create: `api/app/__init__.py` (empty)
- Create: `api/app/config.py`
- Create: `api/app/main.py`
- Create: `api/requirements.txt`
- Create: `api/Dockerfile`
- Create: `api/tests/conftest.py`
- Create: `api/tests/test_health.py`
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: `app.main:app` (FastAPI instance), `GET /health` → `{"status": "ok"}`
- Produces: `app.config.Settings` with field `database_url: str` (read from env `DATABASE_URL`)

- [ ] **Step 1: Write the failing test**

`api/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

`api/tests/conftest.py`:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`): `pytest tests/test_health.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app'` (app/main.py doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

`api/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aceno:aceno@localhost:5432/aceno"

    class Config:
        env_file = ".env"


settings = Settings()
```

`api/app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="Chamar Garçom API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`api/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.36
asyncpg==0.30.0
alembic==1.13.3
pydantic==2.9.2
pydantic-settings==2.6.0
passlib[bcrypt]==1.7.4
pytest==8.3.3
httpx==0.27.2
```

`api/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts ./scripts

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: aceno
      POSTGRES_PASSWORD: aceno
      POSTGRES_DB: aceno
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: ./api
    environment:
      DATABASE_URL: postgresql+asyncpg://aceno:aceno@db:5432/aceno
    depends_on:
      - db
    ports:
      - "8000:8000"
    volumes:
      - ./api/app:/app/app

volumes:
  db_data:
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`): `pip install -r requirements.txt && pytest tests/test_health.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Verify with Docker Compose**

Run: `docker compose up -d --build` then `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add api/app api/requirements.txt api/Dockerfile api/tests docker-compose.yml
git commit -m "feat: scaffold api monorepo with health endpoint"
```

---

### Task 2: Modelo de dados (SQLAlchemy 2 async)

**Files:**
- Create: `api/app/models.py`
- Modify: `api/app/db.py` (create)

**Interfaces:**
- Consumes: nenhuma (primeira definição de dados)
- Produces: `app.models.Base` (declarative base), `app.models.Estabelecimento`,
  `app.models.Mesa`, `app.models.Solicitacao`, `app.models.UsuarioOperacao`,
  enums `StatusMesa`, `TipoSolicitacao`, `FormaPagamento`, `StatusSolicitacao`.
- Produces: `app.db.engine` (AsyncEngine), `app.db.async_session` (async_sessionmaker)

- [ ] **Step 1: Write the failing test**

`api/tests/test_models.py`:

```python
from app.models import (
    Estabelecimento,
    Mesa,
    Solicitacao,
    StatusMesa,
    StatusSolicitacao,
    TipoSolicitacao,
    UsuarioOperacao,
)


def test_mesa_default_status_is_fechada():
    mesa = Mesa(numero=1, token="abc123")
    assert mesa.status == StatusMesa.fechada


def test_solicitacao_default_status_is_pendente():
    solicitacao = Solicitacao(tipo=TipoSolicitacao.chamar_garcom)
    assert solicitacao.status == StatusSolicitacao.pendente


def test_models_importable():
    assert Estabelecimento.__tablename__ == "estabelecimento"
    assert UsuarioOperacao.__tablename__ == "usuario_operacao"
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`): `pytest tests/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: Write minimal implementation**

`api/app/models.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class StatusMesa(str, enum.Enum):
    aberta = "aberta"
    fechada = "fechada"


class TipoSolicitacao(str, enum.Enum):
    chamar_garcom = "chamar_garcom"
    fechar_conta = "fechar_conta"


class FormaPagamento(str, enum.Enum):
    dinheiro = "dinheiro"
    cartao = "cartao"
    pix = "pix"


class StatusSolicitacao(str, enum.Enum):
    pendente = "pendente"
    em_atendimento = "em_atendimento"
    concluido = "concluido"
    cancelado = "cancelado"


class Estabelecimento(Base):
    __tablename__ = "estabelecimento"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str]
    wifi_ssid: Mapped[str]
    wifi_senha: Mapped[str]
    cardapio_url: Mapped[str]
    cfg_cooldown_seg: Mapped[int] = mapped_column(default=30)
    cfg_urgente_seg: Mapped[int] = mapped_column(default=60)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    mesas: Mapped[list["Mesa"]] = relationship(back_populates="estabelecimento")
    usuarios: Mapped[list["UsuarioOperacao"]] = relationship(back_populates="estabelecimento")


class Mesa(Base):
    __tablename__ = "mesa"

    id: Mapped[int] = mapped_column(primary_key=True)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimento.id"))
    numero: Mapped[int]
    token: Mapped[str] = mapped_column(unique=True, default=lambda: uuid.uuid4().hex)
    status: Mapped[StatusMesa] = mapped_column(
        Enum(StatusMesa, name="status_mesa"), default=StatusMesa.fechada
    )
    aberta_em: Mapped[datetime | None] = mapped_column(nullable=True)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    estabelecimento: Mapped["Estabelecimento"] = relationship(back_populates="mesas")
    solicitacoes: Mapped[list["Solicitacao"]] = relationship(back_populates="mesa")


class Solicitacao(Base):
    """O índice único parcial que garante 'um chamado ativo por tipo por
    mesa' (regra 1) não é expresso aqui: SQLAlchemy ORM não modela índices
    parciais com WHERE. Ele é criado só na migration (Task 3)."""

    __tablename__ = "solicitacao"

    id: Mapped[int] = mapped_column(primary_key=True)
    mesa_id: Mapped[int] = mapped_column(ForeignKey("mesa.id"))
    tipo: Mapped[TipoSolicitacao] = mapped_column(Enum(TipoSolicitacao, name="tipo_solicitacao"))
    forma_pagamento: Mapped[FormaPagamento | None] = mapped_column(
        Enum(FormaPagamento, name="forma_pagamento"), nullable=True
    )
    status: Mapped[StatusSolicitacao] = mapped_column(
        Enum(StatusSolicitacao, name="status_solicitacao"), default=StatusSolicitacao.pendente
    )
    urgente: Mapped[bool] = mapped_column(default=False)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    aceito_em: Mapped[datetime | None] = mapped_column(nullable=True)
    concluido_em: Mapped[datetime | None] = mapped_column(nullable=True)

    mesa: Mapped["Mesa"] = relationship(back_populates="solicitacoes")


class UsuarioOperacao(Base):
    __tablename__ = "usuario_operacao"

    id: Mapped[int] = mapped_column(primary_key=True)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimento.id"))
    username: Mapped[str] = mapped_column(unique=True)
    senha_hash: Mapped[str]
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    estabelecimento: Mapped["Estabelecimento"] = relationship(back_populates="usuarios")
```

`api/app/db.py`:

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`): `pytest tests/test_models.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add api/app/models.py api/app/db.py api/tests/test_models.py
git commit -m "feat: add sqlalchemy models for core domain"
```

---

### Task 3: Alembic — migration inicial

**Files:**
- Create: `api/alembic.ini`
- Create: `api/alembic/env.py`
- Create: `api/alembic/script.py.mako`
- Create: `api/alembic/versions/0001_fundacao.py`

**Interfaces:**
- Consumes: `app.models.Base`, `app.config.settings.database_url` (Task 2)
- Produces: tabelas `estabelecimento`, `mesa`, `solicitacao`, `usuario_operacao`
  no banco, e índice único parcial
  `ix_solicitacao_ativa_por_tipo_mesa` em `solicitacao(mesa_id, tipo)`
  `WHERE status IN ('pendente', 'em_atendimento')`.

- [ ] **Step 1: Create Alembic config files**

`api/alembic.ini`:

```ini
[alembic]
script_location = alembic
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handlers]
keys = console

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatters]
keys = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

`api/alembic/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

`api/alembic/env.py`:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 2: Write the migration**

`api/alembic/versions/0001_fundacao.py`:

```python
"""fundacao

Revision ID: 0001
Revises:
Create Date: 2026-10-06

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

status_mesa = sa.Enum("aberta", "fechada", name="status_mesa")
tipo_solicitacao = sa.Enum("chamar_garcom", "fechar_conta", name="tipo_solicitacao")
forma_pagamento = sa.Enum("dinheiro", "cartao", "pix", name="forma_pagamento")
status_solicitacao = sa.Enum(
    "pendente", "em_atendimento", "concluido", "cancelado", name="status_solicitacao"
)


def upgrade() -> None:
    bind = op.get_bind()
    status_mesa.create(bind, checkfirst=True)
    tipo_solicitacao.create(bind, checkfirst=True)
    forma_pagamento.create(bind, checkfirst=True)
    status_solicitacao.create(bind, checkfirst=True)

    op.create_table(
        "estabelecimento",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.String, nullable=False),
        sa.Column("wifi_ssid", sa.String, nullable=False),
        sa.Column("wifi_senha", sa.String, nullable=False),
        sa.Column("cardapio_url", sa.String, nullable=False),
        sa.Column("cfg_cooldown_seg", sa.Integer, nullable=False, server_default="30"),
        sa.Column("cfg_urgente_seg", sa.Integer, nullable=False, server_default="60"),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "mesa",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "estabelecimento_id", sa.Integer, sa.ForeignKey("estabelecimento.id"), nullable=False
        ),
        sa.Column("numero", sa.Integer, nullable=False),
        sa.Column("token", sa.String, nullable=False, unique=True),
        sa.Column("status", status_mesa, nullable=False, server_default="fechada"),
        sa.Column("aberta_em", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "solicitacao",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mesa_id", sa.Integer, sa.ForeignKey("mesa.id"), nullable=False),
        sa.Column("tipo", tipo_solicitacao, nullable=False),
        sa.Column("forma_pagamento", forma_pagamento, nullable=True),
        sa.Column(
            "status", status_solicitacao, nullable=False, server_default="pendente"
        ),
        sa.Column("urgente", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("aceito_em", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("concluido_em", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_solicitacao_ativa_por_tipo_mesa",
        "solicitacao",
        ["mesa_id", "tipo"],
        unique=True,
        postgresql_where=sa.text("status IN ('pendente', 'em_atendimento')"),
    )

    op.create_table(
        "usuario_operacao",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "estabelecimento_id", sa.Integer, sa.ForeignKey("estabelecimento.id"), nullable=False
        ),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("senha_hash", sa.String, nullable=False),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("usuario_operacao")
    op.drop_index("ix_solicitacao_ativa_por_tipo_mesa", table_name="solicitacao")
    op.drop_table("solicitacao")
    op.drop_table("mesa")
    op.drop_table("estabelecimento")
    status_solicitacao.drop(op.get_bind(), checkfirst=True)
    forma_pagamento.drop(op.get_bind(), checkfirst=True)
    tipo_solicitacao.drop(op.get_bind(), checkfirst=True)
    status_mesa.drop(op.get_bind(), checkfirst=True)
```

- [ ] **Step 3: Run migration against real Postgres**

Run: `docker compose up -d db` then from `api/`:
`DATABASE_URL=postgresql+asyncpg://aceno:aceno@localhost:5432/aceno alembic upgrade head`
Expected: `Running upgrade -> 0001, fundacao` with no errors.

Verify: `docker compose exec db psql -U aceno -d aceno -c "\dt"`
Expected: lists `estabelecimento`, `mesa`, `solicitacao`, `usuario_operacao`.

- [ ] **Step 4: Verify downgrade works**

Run (from `api/`): `alembic downgrade base`
Expected: all tables and enums dropped with no errors.

Run again: `alembic upgrade head`
Expected: tables recreated (leaves DB in upgraded state for Task 4).

- [ ] **Step 5: Commit**

```bash
git add api/alembic.ini api/alembic/
git commit -m "feat: add alembic migration for core schema"
```

---

### Task 4: Seed script

**Files:**
- Create: `api/scripts/__init__.py` (empty)
- Create: `api/scripts/seed.py`
- Create: `api/tests/test_seed.py`

**Interfaces:**
- Consumes: `app.db.async_session` (Task 2), `app.models.*` (Task 2)
- Produces: `scripts.seed.seed()` — async function, idempotent, returns `None`

- [ ] **Step 1: Write the failing test**

`api/tests/test_seed.py` (unit-level, checks idempotency logic with an
in-memory sqlite engine swap is avoided — this test runs against the same
Postgres used in dev, matching "pytest + banco de teste" from CLAUDE.md):

```python
import pytest
from sqlalchemy import select

from app.db import async_session
from app.models import Estabelecimento, Mesa, UsuarioOperacao
from scripts.seed import seed


@pytest.mark.asyncio
async def test_seed_is_idempotent():
    await seed()
    await seed()

    async with async_session() as session:
        estabelecimentos = (await session.execute(select(Estabelecimento))).scalars().all()
        mesas = (await session.execute(select(Mesa))).scalars().all()
        usuarios = (await session.execute(select(UsuarioOperacao))).scalars().all()

    assert len(estabelecimentos) == 1
    assert len(mesas) == 10
    assert len(usuarios) == 1
    assert all(mesa.status.value == "fechada" for mesa in mesas)
```

Add to `api/requirements.txt`: `pytest-asyncio==0.24.0`

- [ ] **Step 2: Run test to verify it fails**

Run (from `api/`, with `db` container up and migration applied):
`pip install -r requirements.txt && pytest tests/test_seed.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts'` (or `scripts.seed`)

- [ ] **Step 3: Write minimal implementation**

`api/scripts/seed.py`:

```python
import asyncio
import uuid

from passlib.hash import bcrypt
from sqlalchemy import select

from app.db import async_session
from app.models import Estabelecimento, Mesa, UsuarioOperacao


async def seed() -> None:
    async with async_session() as session:
        estabelecimento = (
            await session.execute(select(Estabelecimento))
        ).scalars().first()

        if estabelecimento is None:
            estabelecimento = Estabelecimento(
                nome="Restaurante Sabor & Arte",
                wifi_ssid="Sabor_Arte_Wifi",
                wifi_senha="bemvindo123",
                cardapio_url="https://exemplo.com/cardapio-sabor-arte",
            )
            session.add(estabelecimento)
            await session.flush()

        mesas_existentes = (
            await session.execute(select(Mesa).where(Mesa.estabelecimento_id == estabelecimento.id))
        ).scalars().all()

        if not mesas_existentes:
            for numero in range(1, 11):
                session.add(
                    Mesa(
                        estabelecimento_id=estabelecimento.id,
                        numero=numero,
                        token=uuid.uuid4().hex,
                    )
                )

        usuario_existente = (
            await session.execute(
                select(UsuarioOperacao).where(UsuarioOperacao.username == "demo")
            )
        ).scalars().first()

        if usuario_existente is None:
            session.add(
                UsuarioOperacao(
                    estabelecimento_id=estabelecimento.id,
                    username="demo",
                    senha_hash=bcrypt.hash("demo123"),
                )
            )

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
```

`api/scripts/__init__.py`: empty file.

Add to `api/app/__init__.py` nothing needed (already empty).

Create `api/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `api/`, `db` container up, migration applied):
`pytest tests/test_seed.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Run seed manually and inspect**

Run: `python scripts/seed.py` then
`docker compose exec db psql -U aceno -d aceno -c "SELECT numero, status FROM mesa ORDER BY numero;"`
Expected: 10 rows, all `fechada`.

- [ ] **Step 6: Commit**

```bash
git add api/scripts api/tests/test_seed.py api/pytest.ini api/requirements.txt
git commit -m "feat: add idempotent seed script"
```

---

## Verification checklist (end of etapa 1)

- [ ] `docker compose up -d --build` sobe `db` e `api` sem erro
- [ ] `curl http://localhost:8000/health` → `{"status":"ok"}`
- [ ] `alembic upgrade head` cria as 4 tabelas + índice parcial
- [ ] `alembic downgrade base` reverte sem erro
- [ ] `python scripts/seed.py` rodado 2x não duplica dados
- [ ] `pytest` (todos os arquivos em `api/tests/`) passa
