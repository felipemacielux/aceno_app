from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

# NullPool: nunca reusa uma conexao asyncpg entre checkouts. Necessario pq
# os testes de WebSocket (TestClient) rodam o app num event loop proprio,
# diferente do loop das fixtures async (pytest-asyncio) - uma conexao
# pooled criada num loop quebra ao ser usada no outro ("attached to a
# different loop"). Sem Redis/múltiplos workers (CLAUDE.md), o overhead de
# abrir conexao por checkout e aceitavel nesta escala de demo.
engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
async_session = async_sessionmaker(engine, expire_on_commit=False)
