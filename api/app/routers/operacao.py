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
