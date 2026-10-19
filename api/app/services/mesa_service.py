from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import MesaNaoEncontrada
from app.models import Mesa, Solicitacao, StatusMesa, StatusSolicitacao, TipoSolicitacao
from app.schemas import MesaClienteOut, MesaOut, SolicitacaoOut
from app.services import solicitacao_service
from app.ws.manager import manager


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


async def obter_cooldowns(session: AsyncSession, mesa: Mesa) -> dict[TipoSolicitacao, datetime | None]:
    cooldowns: dict[TipoSolicitacao, datetime | None] = {tipo: None for tipo in TipoSolicitacao}
    if mesa.aberta_em is None:
        return cooldowns
    for tipo in TipoSolicitacao:
        ultima = (
            await session.execute(
                select(Solicitacao)
                .where(
                    Solicitacao.mesa_id == mesa.id,
                    Solicitacao.tipo == tipo,
                    Solicitacao.status.in_([StatusSolicitacao.concluido, StatusSolicitacao.cancelado]),
                    Solicitacao.criado_em >= mesa.aberta_em,
                )
                .order_by(Solicitacao.concluido_em.desc())
                .limit(1)
            )
        ).scalars().first()
        if ultima is not None:
            cooldowns[tipo] = ultima.concluido_em
    return cooldowns


async def obter_estado_cliente(session: AsyncSession, token: str) -> MesaClienteOut:
    mesa = await buscar_mesa_por_token(session, token)
    ativas = await solicitacao_service.listar_ativas_por_mesa(session, mesa.id)
    cooldowns = await obter_cooldowns(session, mesa)
    return MesaClienteOut(
        numero=mesa.numero,
        status=mesa.status,
        nome_estabelecimento=mesa.estabelecimento.nome,
        wifi_ssid=mesa.estabelecimento.wifi_ssid,
        wifi_senha=mesa.estabelecimento.wifi_senha,
        cardapio_url=mesa.estabelecimento.cardapio_url,
        cfg_cooldown_seg=mesa.estabelecimento.cfg_cooldown_seg,
        cooldowns=cooldowns,
        solicitacoes_ativas=[SolicitacaoOut.model_validate(s) for s in ativas],
    )


async def abrir_mesa(session: AsyncSession, mesa_id: int) -> Mesa:
    mesa = await buscar_mesa_por_id(session, mesa_id)
    if mesa.status == StatusMesa.fechada:
        mesa.status = StatusMesa.aberta
        mesa.aberta_em = datetime.now(UTC)
        await session.commit()
        dados = MesaOut.model_validate(mesa).model_dump(mode="json")
        await manager.emitir_mesa(mesa.token, "mesa.atualizada", dados)
        await manager.emitir_operacao("mesa.atualizada", dados)
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

        dados_mesa = MesaOut.model_validate(mesa).model_dump(mode="json")
        await manager.emitir_mesa(mesa.token, "mesa.atualizada", dados_mesa)
        await manager.emitir_operacao("mesa.atualizada", dados_mesa)
        for solicitacao in ativas:
            dados_solicitacao = SolicitacaoOut.model_validate(solicitacao).model_dump(mode="json")
            await manager.emitir_mesa(mesa.token, "solicitacao.atualizada", dados_solicitacao)
            await manager.emitir_operacao("solicitacao.atualizada", dados_solicitacao)
    return mesa
