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
