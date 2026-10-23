# Chamar Garçom — Protótipo de Demonstração

Sistema em que o cliente escaneia um QR Code fixo na mesa e chama o garçom ou pede a conta pelo celular. A equipe recebe o chamado em tempo real numa central (PC) e no celular, e controla quais mesas estão abertas.

**Objetivo deste protótipo:** demonstrar o produto ao vivo para donos de restaurante. O dono escaneia o QR, toca em "Chamar Garçom" e vê o cartão piscar e apitar na central na hora. Priorize **fluidez, tempo real confiável e visual convincente**, não completude.

---

## 1. Escopo

### Dentro do escopo
- Tela do cliente: dois botões ("Chamar Garçom" e "Fechar Conta"), modal de forma de pagamento, status do chamado, cancelamento e cooldown.
- Botões informativos que **não geram chamado**: senha do Wi-Fi e link do cardápio.
- **Abertura e fechamento de mesa pelo garçom.** Uma mesa fechada não aceita chamados.
- Central da operação (PC): kanban de chamados, mapa de mesas, som, alerta urgente e botão "Iniciar turno".
- Visão do garçom: a mesma central em layout mobile (web responsiva).
- Card de métricas do dia (tempo médio até o aceite e até a conclusão, total de chamados).
- Tempo real via WebSocket nos dois lados.
- Seed com 1 estabelecimento e 10 mesas, e um script que gera os QR Codes para impressão.
- Infra idêntica à do produto final (Docker Compose + Caddy), exposta na internet via Cloudflare Tunnel.

### Fora do escopo (NÃO implementar agora)
- APK, Capacitor, FCM ou push nativo.
- Limite de frequência por janela de tempo (ex.: 6 chamados a cada 10 min).
- Expiração automática de chamados "em atendimento".
- Painel administrativo (CRUD de mesas, usuários e configurações).
- Login individual por garçom e distribuição por setor.
- Multi-estabelecimento ativo. O modelo tem `estabelecimento_id`, mas existe só um.
- Redis e múltiplos workers.
- Avaliação de atendimento e integração com Pix.
- Instalador, backups e scripts de atualização para a VPS do cliente.

Se uma tarefa parecer exigir algo desta lista, pare e pergunte antes.

---

## 2. Stack e estrutura

| Camada | Tecnologia |
|---|---|
| Front cliente | React + Vite + TypeScript (CSS simples ou CSS Modules, sem libs pesadas) |
| Front operação | React + Vite + TypeScript + Tailwind CSS |
| Back-end e realtime | Python 3.12 + FastAPI + WebSockets nativos |
| ORM e migrações | SQLAlchemy 2 (async) + asyncpg + Alembic |
| Validação | Pydantic v2 |
| Banco | PostgreSQL 16 |
| Orquestração | Docker Compose (`db`, `api`, `caddy`) |
| Proxy e estáticos | Caddy (serve os dois fronts e faz proxy de `/api` e `/ws`) |
| Produto final | VPS do restaurante + Docker Compose + Caddy com HTTPS automático |
| Demo | O mesmo Compose rodando no notebook, exposto via Cloudflare Tunnel (seção 9) |



### Um único domínio, roteado por caminho (Caddyfile)

| Caminho | Destino |
|---|---|
| `/api/*` | `api:8000` |
| `/ws/*` | `api:8000` (WebSocket) |
| `/m/*` | estáticos do web-cliente (SPA fallback para `index.html`) |
| `/painel/*` | estáticos do web-operacao (SPA fallback para `index.html`) |
| `/` | redireciona para `/painel/` |

O endereço do site vem da variável `SITE_ADDRESS` no Caddyfile:
- **Demo:** `SITE_ADDRESS=:80`. O HTTPS fica por conta do Cloudflare Tunnel.
- **Produção:** `SITE_ADDRESS=restaurante.com.br`. O Caddy emite o certificado automaticamente (portas 80 e 443 abertas).

Os fronts usam URLs relativas (`/api`, `/ws`), sem variável de ambiente de URL. Em desenvolvimento, o Vite faz proxy de `/api` e `/ws` para `localhost:8000`.

**Importante:** a API roda com **1 worker** (`uvicorn --workers 1`). O ConnectionManager é em memória. Não adicione Redis.

---

## 3. Regras de negócio

### Mesas
```
fechada ──(garçom abre)──> aberta ──(garçom fecha)──> fechada
```
- **M1.** Chamados só podem ser criados em mesa `aberta`. Em mesa fechada, a API retorna **409** com `erro: "mesa_fechada"`.
- **M2.** Ao **fechar** a mesa, os chamados ativos dela são encerrados: os `pendente` viram `cancelado`, os `em_atendimento` viram `concluido`. Cada um emite seu evento.
- **M3.** Abrir uma mesa já aberta, ou fechar uma já fechada, é **idempotente**: retorna 200 sem alterar nada.
- **M4.** Cada abertura inicia uma nova sessão (`aberta_em`). O cooldown (regra 2) só considera chamados da sessão atual, para que um novo cliente nunca herde a contagem do anterior.
- **M5.** Quando o garçom conclui um chamado `fechar_conta`, a operação pergunta "Fechar a Mesa N?" (Sim/Não). Isso é só UX no front: ele chama o endpoint de fechar.
- **M6.** Abrir ou fechar a mesa atualiza a tela do cliente em tempo real (evento `mesa.atualizada`).
- O seed cria todas as mesas **fechadas**.

### Tipos de solicitação
- `chamar_garcom`
- `fechar_conta`, que exige `forma_pagamento`: `dinheiro`, `cartao` ou `pix`.

### Estados da solicitação
```
pendente ──(garçom aceita)──> em_atendimento ──(garçom conclui)──> concluido
   └──(cliente cancela)──> cancelado
```
- `urgente` é uma flag booleana, não um estado. Ela é ligada quando o chamado fica `pendente` por mais de `cfg_urgente_seg`.

### Regras
1. **Um chamado ativo por tipo por mesa.** Ativo significa `pendente` ou `em_atendimento`. A mesa pode ter um "chamar garçom" e um "fechar conta" ativos ao mesmo tempo, mas nunca dois do mesmo tipo. Isso é garantido no banco com um índice único parcial (seção 4). Tentar criar um segundo retorna **409**.
2. **Cooldown.** Depois que um chamado é `concluido` ou `cancelado`, a mesa só pode criar outro do **mesmo tipo** depois de `cfg_cooldown_seg` segundos (padrão 30), contados dentro da sessão atual (M4). Antes disso, retorna **429** com `segundos_restantes`. O cliente exibe uma contagem regressiva no botão.
3. **Cancelamento.** Só o cliente cancela, e só enquanto o chamado está `pendente`. Em qualquer outro estado, retorna **409**.
4. **Aceite atômico.** Em caso de cliques simultâneos, só o primeiro aceite vence:
   ```sql
   UPDATE solicitacao SET status='em_atendimento', aceito_em=now()
   WHERE id=:id AND status='pendente' RETURNING *;
   ```
   Se nenhuma linha voltar, retorna **409**. O front mostra a mensagem "Chamado já foi aceito".
5. **Concluir** só a partir de `em_atendimento`.
6. **Urgência.** Um job em background, a cada 5 s, marca `urgente=true` nos chamados `pendente` com `criado_em` mais antigo que `cfg_urgente_seg` (padrão 60) e emite o evento correspondente.
7. **Datas** são gravadas em UTC (`timestamptz`) e exibidas em `America/Sao_Paulo`.

---


---

## 4. WebSocket

### Canais
- `WS /ws/m/{token}`: cliente da mesa. Recebe só eventos dessa mesa.
- `WS /ws/operacao?token={jwt}`: operação. Recebe todos os eventos do estabelecimento.


---

## 5. Telas

### web-cliente (mobile-first, leve, carregamento rápido)
Rota `/m/:token`.

1. **Mesa fechada:** "Mesa 12", com a mensagem "Esta mesa ainda não foi liberada. Peça a um garçom para liberar o atendimento pelo celular." Os botões de Wi-Fi e cardápio continuam disponíveis. Quando o garçom abre a mesa, a tela muda sozinha para a inicial, com uma animação sutil.
2. **Inicial (mesa aberta):** nome do restaurante, **"Mesa 12" em destaque** e os botões grandes "Chamar Garçom" e "Fechar Conta". Abaixo, links discretos para "Wi-Fi" (abre um modal com rede e senha, com botão de copiar) e "Cardápio".
3. **Modal de pagamento** (ao tocar em "Fechar Conta"): Dinheiro, Cartão e Pix. O chamado só é criado depois da escolha.
4. **Pendente:** "Solicitação enviada! Um garçom já vai até você.", com o botão **Cancelar**.
5. **Em atendimento:** "Garçom a caminho!", sem botão de cancelar.
6. **Concluído ou cancelado:** volta à tela inicial. O botão daquele tipo fica desabilitado com a contagem "Disponível em 25s".
7. **Mesa fechada durante o uso:** volta para a tela 1, com a mensagem "Obrigado pela visita!".
8. **Token inválido:** "QR Code inválido. Chame um garçom."

Cada tipo tem seu próprio estado. Se só "Chamar Garçom" estiver ativo, "Fechar Conta" continua disponível.

### web-operacao (Tailwind)
Rota `/painel/`.

1. **Login.**
2. **Overlay "Iniciar turno"**, que aparece sempre que a página é aberta. O clique desbloqueia o áudio (AudioContext) e pede `Notification.requestPermission()`.
3. **Cabeçalho:** nome do estabelecimento, indicador de conexão, card de métricas do dia (atualizado a cada 30 s e a cada evento) e a alternância **Chamados | Mesas**.
4. **Visão Chamados:**
   - **Desktop:** kanban com 3 colunas: Pendentes, Em Atendimento e Concluídos.
   - **Mobile (< 768 px):** abas no lugar das colunas, com contador nos Pendentes.
   - **Card:** Aparência dos cards e do kanban: ver `specs/spec-kanban.md`.
5. **Visão Mesas:** grade com as mesas, em botões grandes e fáceis de tocar no celular.
   - Fechada: cinza, com a ação "Abrir".
   - Aberta sem chamados: verde, mostrando há quanto tempo está aberta e a ação "Fechar".
   - Aberta com chamado ativo: amarela (ou vermelha se urgente), com o ícone do tipo.
   - Fechar uma mesa com chamados ativos pede confirmação: "A Mesa N tem chamados ativos. Fechar mesmo assim?"
6. **Alertas:**
   - Bipe gerado com Web Audio API (sem arquivos de áudio) quando chega um `solicitacao.criada`.
   - Bipe diferente e **repetido a cada 10 s** enquanto houver qualquer chamado urgente pendente.
   - Notificação do navegador quando a aba não está visível.
   - O título da aba pisca, por exemplo "(2) Mesa 12 — Chamar Garçom".
   - `navigator.vibrate` no mobile, quando disponível.

---


---

## 6. Convenções

- Entidades e campos de domínio em **português**, como neste documento (`mesa`, `solicitacao`, `forma_pagamento`). Termos técnicos em inglês (`router`, `service`, `manager`).
- Todos os textos de interface em **pt-BR**.
- Python: type hints em tudo, `ruff` para lint e formatação, regras de negócio em `services/` (os routers são finos).
- TypeScript com `strict: true`. Tipos dos payloads em um arquivo `types.ts` em cada front.
- Commits pequenos, um por etapa da seção 12.

### Testes obrigatórios (pytest + banco de teste)
---

## 7. Ordem de implementação

Cada etapa termina funcionando e testada antes de seguir para a próxima.

- [ ] **1. Fundação:** monorepo, docker-compose (Postgres + API), FastAPI com `/health`, Alembic com o modelo da seção 4, e o script de seed.
- [ ] **2. Regras e API REST:** services de mesa e de solicitação com as regras M1 a M4 e 1 a 5, os endpoints do cliente e da operação, autenticação JWT e os testes da seção 11.
- [ ] **3. Realtime:** ConnectionManager, os dois canais WebSocket, `estado.inicial`, ping/pong, emissão de eventos (incluindo `mesa.atualizada`) nos services e o job de urgência.
- [ ] **4. web-cliente:** todas as telas da seção 7, incluindo mesa fechada, reconexão e contagem de cooldown.
- [ ] **5. web-operacao (desktop):** login, "Iniciar turno", kanban, ações, sons, notificações e título piscando.
- [ ] **6. web-operacao (Mesas e mobile):** visão Mesas com abrir e fechar, diálogo M5, layout em abas, vibração e card de métricas.
- [ ] **7. Caddy e Compose completos:** Dockerfile multi-stage do Caddy com os dois fronts, Caddyfile com roteamento por caminho e `SITE_ADDRESS`, tudo funcionando com `docker compose up` em `http://localhost`.
- [ ] **8. Demo:** profile `demo` com `cloudflared`, scripts `gerar_qr` e `reset_demo`, e o teste do roteiro da seção 13 pelo 4G.

