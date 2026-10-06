# Etapa 1 — Fundação (design)

Escopo: seção 7, item 1 do CLAUDE.md. Monorepo, docker-compose (Postgres + API),
FastAPI com `/health`, Alembic com o modelo de dados, script de seed.

## Gaps no CLAUDE.md resolvidos nesta etapa

- Seção 4 não trazia modelo de dados (só WebSocket). Schema abaixo foi inferido
  das regras de negócio (seção 3) e aprovado pelo usuário.
- Dados fake de demo (nome do restaurante, Wi-Fi, cardápio, login) definidos
  como placeholder, aprovados pelo usuário.
- web-cliente usará Tailwind também (desvio da seção 2, que pedia "CSS simples
  ou CSS Modules" — decisão explícita do usuário; Tailwind é build-time, sem
  custo de runtime).

## Estrutura de pastas

```
aceno_app/
  api/
    app/
      models.py
      db.py
      main.py
    alembic/
    scripts/seed.py
    pyproject.toml / requirements.txt
    Dockerfile
  web-cliente/      (Vite + React + TS + Tailwind)
  web-operacao/      (Vite + React + TS + Tailwind)
  docker-compose.yml
```

## Modelo de dados (SQLAlchemy 2 async)

```
estabelecimento
  id (pk)
  nome
  wifi_ssid
  wifi_senha
  cardapio_url
  cfg_cooldown_seg (default 30)
  cfg_urgente_seg (default 60)
  criado_em (timestamptz)

mesa
  id (pk)
  estabelecimento_id (fk)
  numero (int)
  token (string, unique) — usado na URL /m/:token
  status (enum: aberta | fechada, default fechada)
  aberta_em (timestamptz, nullable) — reinicia a cada abertura (M4)
  criado_em

solicitacao
  id (pk)
  mesa_id (fk)
  tipo (enum: chamar_garcom | fechar_conta)
  forma_pagamento (enum: dinheiro | cartao | pix, nullable)
  status (enum: pendente | em_atendimento | concluido | cancelado)
  urgente (bool, default false)
  criado_em
  aceito_em (nullable)
  concluido_em (nullable)

  índice único parcial:
    (mesa_id, tipo) WHERE status IN ('pendente', 'em_atendimento')
    → garante regra 1 (um chamado ativo por tipo por mesa)

usuario_operacao
  id (pk)
  estabelecimento_id (fk)
  username (unique)
  senha_hash
  criado_em
```

Todas as datas em UTC (`timestamptz`), sem lógica de timezone nesta etapa
(exibição em America/Sao_Paulo fica para o front, etapa 4+).

## Docker Compose (etapa 1)

Serviços: `db` (postgres:16) e `api` (uvicorn --workers 1, hot-reload em dev).
Caddy entra só na etapa 7. Sem profile `demo` ainda (etapa 8).

## Seed

Script `api/scripts/seed.py`:
- 1 estabelecimento: nome "Restaurante Sabor & Arte", wifi_ssid "Sabor_Arte_Wifi",
  wifi_senha "bemvindo123", cardapio_url placeholder.
- 10 mesas, todas `fechada`, numeradas 1–10, token único por mesa (uuid4).
- 1 usuario_operacao: username "demo", senha "demo123" (hasheada com passlib/bcrypt).

Idempotente: rodar de novo não duplica (limpa e recria, ou verifica existência).

## Testes desta etapa

- `GET /health` retorna 200.
- Seed roda sem erro e é idempotente (rodar 2x não falha nem duplica).
- Migration sobe e desce (`alembic upgrade head` / `downgrade base`) sem erro.

## Fora do escopo desta etapa

Regras de negócio (M1-M6, regras 1-7), endpoints REST, WebSocket, JWT real
(login existe só como dado no banco, sem endpoint de auth ainda), fronts.
Essas entram nas etapas 2-6.
