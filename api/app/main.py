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
