from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_usuario_atual
from app.exceptions import CredenciaisInvalidas
from app.models import Estabelecimento, UsuarioOperacao
from app.schemas import LoginRequest, LoginResponse, MesaOut, SolicitacaoOut
from app.security import criar_token, verificar_senha
from app.services import mesa_service, solicitacao_service

router = APIRouter(prefix="/api/operacao", tags=["operacao"])


@router.post("/login", response_model=LoginResponse)
async def login(dados: LoginRequest, session: AsyncSession = Depends(get_db)) -> LoginResponse:
    usuario = (
        await session.execute(select(UsuarioOperacao).where(UsuarioOperacao.username == dados.username))
    ).scalars().first()
    if usuario is None or not verificar_senha(dados.senha, usuario.senha_hash):
        raise CredenciaisInvalidas()
    nome_estabelecimento = (
        await session.execute(
            select(Estabelecimento.nome).where(Estabelecimento.id == usuario.estabelecimento_id)
        )
    ).scalar_one()
    token = criar_token({"sub": usuario.username, "estabelecimento_id": usuario.estabelecimento_id})
    return LoginResponse(access_token=token, nome_estabelecimento=nome_estabelecimento)


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
