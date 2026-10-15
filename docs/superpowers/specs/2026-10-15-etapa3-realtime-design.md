# Etapa 3 — Realtime: Design

**Data:** 2026-10-15
**Status:** Aprovado para implementação

## Objetivo

Implementar o ConnectionManager, os dois canais WebSocket (cliente e operação), emissão
de eventos nos services (incluindo `mesa.atualizada`, M6), `estado.inicial`, ping/pong e
o job de urgência (regra 6), conforme CLAUDE.md seção 7 item 3.

## Contexto que já existe

`api/app/services/mesa_service.py` e `solicitacao_service.py` implementam as regras de
negócio (etapa 2) e fazem `commit()` da sessão, mas não emitem nenhum evento. Os routers
`cliente.py` e `operacao.py` expõem REST. Não existe nenhum código WebSocket no projeto.

## Premissa confirmada com o usuário

Só existe 1 estabelecimento por instância da aplicação, agora (demo) e em produção — não
é um recorte temporário do protótipo. Cada restaurante roda sua própria instância
separada; `estabelecimento_id` continua no schema (coluna já existe desde a etapa 1) mas
nunca precisa de mais de uma linha. Por isso o canal de operação não precisa ser
particionado por estabelecimento.

## Arquitetura

### ConnectionManager (`api/app/ws/manager.py`)

Singleton em memória (API roda com 1 worker, sem Redis — CLAUDE.md seção 2).

```python
class ConnectionManager:
    mesa_conexoes: dict[str, set[WebSocket]]  # token da mesa -> sockets
    operacao_conexoes: set[WebSocket]          # canal único, 1 estabelecimento

    async def conectar_mesa(token, ws) -> None
    def desconectar_mesa(token, ws) -> None
    async def conectar_operacao(ws) -> None
    def desconectar_operacao(ws) -> None
    async def emitir_mesa(token, tipo, dados) -> None
    async def emitir_operacao(tipo, dados) -> None
```

`emitir_*` serializa `{"tipo": tipo, "dados": dados}` e envia pra cada socket vivo;
sockets que falham no `send_json` (desconexão não detectada ainda) são removidos do set
silenciosamente.

Instância única em nível de módulo: `manager = ConnectionManager()`, importada pelos
services e pelos endpoints WS.

### Envelope de evento

```json
{"tipo": "solicitacao.criada", "dados": { ... }}
```

Tipos: `estado.inicial`, `solicitacao.criada`, `solicitacao.atualizada` (cobre aceite,
conclusão, cancelamento e virar urgente), `mesa.atualizada`. `dados` reusa os schemas
REST já existentes (`SolicitacaoOut`, `MesaOut`, `MesaClienteOut`) via
`.model_dump(mode="json")` — nenhum schema novo nesta etapa.

### Pontos de emissão nos services

- `mesa_service.abrir_mesa` / `fechar_mesa`: emitem `mesa.atualizada` pro canal da mesa
  (token) e pro canal de operação, só quando o status de fato muda (idempotência, M3,
  não emite nada em no-op).
- `mesa_service.fechar_mesa`: além do `mesa.atualizada`, emite `solicitacao.atualizada`
  pra cada chamado que foi cancelado/concluído (M2) — mesmo loop que já existe, só
  adicionando a chamada ao manager.
- `solicitacao_service.criar_solicitacao`: emite `solicitacao.criada` pro canal da mesa e
  pro canal de operação.
- `solicitacao_service.cancelar_solicitacao` / `aceitar_solicitacao` /
  `concluir_solicitacao`: emitem `solicitacao.atualizada` pro canal da mesa e pro canal
  de operação. Essas três funções hoje só carregam `Solicitacao` sem a `mesa` — precisam
  de `selectinload(Solicitacao.mesa)` pra ter o token disponível sem query extra.
- `solicitacao_service.marcar_urgentes` (nova função, usada pelo job): emite
  `solicitacao.atualizada` pra cada chamado que virou urgente.

### Endpoints WebSocket (`api/app/routers/ws.py`, incluído direto no `main.py`, sem
roteador em `app/routers/__init__.py` por ser o único arquivo do tipo)

- `WS /ws/m/{token}`: resolve a mesa via `mesa_service.buscar_mesa_por_token`; token
  inválido → `websocket.close(code=1008)`. Ao conectar: `manager.conectar_mesa`, envia
  `estado.inicial` com o mesmo payload do `GET /api/m/{token}` (`MesaClienteOut`). Loop:
  `receive_json()`; se `{"tipo": "ping"}`, responde `{"tipo": "pong"}`; qualquer outra
  mensagem é ignorada. `WebSocketDisconnect` → `manager.desconectar_mesa`.
- `WS /ws/operacao?token={jwt}`: `decode_token(token)`; inválido/ausente →
  `close(code=1008)`. Ao conectar: `manager.conectar_operacao`, envia `estado.inicial`
  com `{"mesas": [MesaOut...], "solicitacoes": [SolicitacaoOut...]}` (reusa
  `mesa_service.listar_mesas` e `solicitacao_service.listar_solicitacoes`). Mesmo
  ping/pong. `WebSocketDisconnect` → `manager.desconectar_operacao`.

### Job de urgência (regra 6)

`api/app/jobs/urgencia.py`: `async def loop_urgencia() -> None` roda em loop infinito,
`await asyncio.sleep(5)` entre iterações, abre uma `async_session()` e chama
`solicitacao_service.marcar_urgentes(session)`.

`marcar_urgentes(session)`:
```sql
UPDATE solicitacao SET urgente = true
WHERE status = 'pendente' AND NOT urgente
  AND criado_em < now() - (cfg_urgente_seg segundos do estabelecimento da mesa)
RETURNING *
```
Como só existe 1 estabelecimento, o `cfg_urgente_seg` pode ser lido uma vez por
iteração (join simples com `mesa.estabelecimento`) em vez de recalculado por linha.
Depois do update, emite `solicitacao.atualizada` pra cada linha retornada.

A task é criada no `lifespan` do FastAPI (`main.py`): `asyncio.create_task(loop_urgencia())`
no startup, `task.cancel()` no shutdown.

## Testes

- `api/tests/test_ws.py`: usa `fastapi.testclient.TestClient` (síncrono, suporta
  `websocket_connect`) — não o `httpx.AsyncClient` usado nos outros testes. Casos:
  token de mesa inválido fecha com 1008; conexão válida recebe `estado.inicial`; criar
  solicitação via REST faz a conexão WS da mesma mesa receber `solicitacao.criada`;
  token JWT inválido no canal de operação fecha com 1008.
- `api/tests/test_urgencia.py`: chama `solicitacao_service.marcar_urgentes` direto, com
  um chamado cujo `criado_em` foi manipulado pra estar no passado; usa
  `monkeypatch` no `manager.emitir_mesa`/`emitir_operacao` pra verificar que foram
  chamados, sem precisar de socket real.
- Testes de `mesa_service`/`solicitacao_service` existentes (etapa 2) ganham asserts
  extras ou fixtures com `monkeypatch` no manager onde fizer sentido verificar emissão,
  sem reescrever os já existentes.

## Fora do escopo desta etapa

- Reconexão do front (etapa 4).
- Front consumindo os eventos (etapas 4-6).
- Particionamento multi-estabelecimento do canal de operação (nunca necessário, ver
  premissa confirmada).
