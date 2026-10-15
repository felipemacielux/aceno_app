from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import MesaNaoEncontrada
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao
from app.schemas import MesaClienteOut, SolicitacaoOut
from app.services import solicitacao_service


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


async def obter_estado_cliente(session: AsyncSession, token: str) -> MesaClienteOut:
    mesa = await buscar_mesa_por_token(session, token)
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
