from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    AceiteConcorrente,
    CancelamentoInvalido,
    ConclusaoInvalida,
    EmCooldown,
    MesaFechada,
    SolicitacaoAtiva,
    SolicitacaoNaoEncontrada,
)
from app.models import (
    Estabelecimento,
    FormaPagamento,
    Mesa,
    Solicitacao,
    StatusMesa,
    StatusSolicitacao,
    TipoSolicitacao,
)
from app.schemas import SolicitacaoOut
from app.ws.manager import manager

ATIVOS = (StatusSolicitacao.pendente, StatusSolicitacao.em_atendimento)
CONCLUIDOS = (StatusSolicitacao.concluido, StatusSolicitacao.cancelado)


async def _token_mesa(session: AsyncSession, mesa_id: int) -> str:
    return (await session.execute(select(Mesa.token).where(Mesa.id == mesa_id))).scalar_one()


async def _emitir_solicitacao(session: AsyncSession, solicitacao: Solicitacao, tipo: str) -> None:
    token = await _token_mesa(session, solicitacao.mesa_id)
    dados = SolicitacaoOut.model_validate(solicitacao).model_dump(mode="json")
    await manager.emitir_mesa(token, tipo, dados)
    await manager.emitir_operacao(tipo, dados)


async def _validar_sem_ativa(session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao) -> None:
    ativa = (
        await session.execute(
            select(Solicitacao).where(
                Solicitacao.mesa_id == mesa.id, Solicitacao.tipo == tipo, Solicitacao.status.in_(ATIVOS)
            )
        )
    ).scalars().first()
    if ativa is not None:
        raise SolicitacaoAtiva()


async def _validar_cooldown(session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao) -> None:
    ultima = (
        await session.execute(
            select(Solicitacao)
            .where(
                Solicitacao.mesa_id == mesa.id,
                Solicitacao.tipo == tipo,
                Solicitacao.status.in_(CONCLUIDOS),
                Solicitacao.criado_em >= mesa.aberta_em,
            )
            .order_by(Solicitacao.concluido_em.desc())
            .limit(1)
        )
    ).scalars().first()
    if ultima is None or ultima.concluido_em is None:
        return
    decorrido = (datetime.now(UTC) - ultima.concluido_em).total_seconds()
    cooldown = mesa.estabelecimento.cfg_cooldown_seg
    if decorrido < cooldown:
        raise EmCooldown(segundos_restantes=int(cooldown - decorrido))


async def criar_solicitacao(
    session: AsyncSession, mesa: Mesa, tipo: TipoSolicitacao, forma_pagamento: FormaPagamento | None = None
) -> Solicitacao:
    if mesa.status != StatusMesa.aberta:
        raise MesaFechada()
    await _validar_sem_ativa(session, mesa, tipo)
    await _validar_cooldown(session, mesa, tipo)

    solicitacao = Solicitacao(mesa_id=mesa.id, tipo=tipo, forma_pagamento=forma_pagamento)
    session.add(solicitacao)
    await session.commit()
    await session.refresh(solicitacao)
    await _emitir_solicitacao(session, solicitacao, "solicitacao.criada")
    return solicitacao


async def cancelar_solicitacao(session: AsyncSession, solicitacao_id: int, mesa_id: int) -> Solicitacao:
    solicitacao = (
        await session.execute(
            select(Solicitacao).where(Solicitacao.id == solicitacao_id, Solicitacao.mesa_id == mesa_id)
        )
    ).scalars().first()
    if solicitacao is None:
        raise SolicitacaoNaoEncontrada()
    if solicitacao.status != StatusSolicitacao.pendente:
        raise CancelamentoInvalido()
    solicitacao.status = StatusSolicitacao.cancelado
    solicitacao.concluido_em = datetime.now(UTC)
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao


async def aceitar_solicitacao(session: AsyncSession, solicitacao_id: int) -> Solicitacao:
    resultado = await session.execute(
        update(Solicitacao)
        .where(Solicitacao.id == solicitacao_id, Solicitacao.status == StatusSolicitacao.pendente)
        .values(status=StatusSolicitacao.em_atendimento, aceito_em=datetime.now(UTC))
        .returning(Solicitacao)
    )
    solicitacao = resultado.scalars().first()
    if solicitacao is None:
        existe = (
            await session.execute(select(Solicitacao).where(Solicitacao.id == solicitacao_id))
        ).scalars().first()
        if existe is None:
            raise SolicitacaoNaoEncontrada()
        raise AceiteConcorrente()
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao


async def concluir_solicitacao(session: AsyncSession, solicitacao_id: int) -> Solicitacao:
    solicitacao = (
        await session.execute(select(Solicitacao).where(Solicitacao.id == solicitacao_id))
    ).scalars().first()
    if solicitacao is None:
        raise SolicitacaoNaoEncontrada()
    if solicitacao.status != StatusSolicitacao.em_atendimento:
        raise ConclusaoInvalida()
    solicitacao.status = StatusSolicitacao.concluido
    solicitacao.concluido_em = datetime.now(UTC)
    await session.commit()
    await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return solicitacao


async def marcar_urgentes(session: AsyncSession) -> list[Solicitacao]:
    estabelecimento = (await session.execute(select(Estabelecimento))).scalars().first()
    if estabelecimento is None:
        return []
    limite = datetime.now(UTC) - timedelta(seconds=estabelecimento.cfg_urgente_seg)
    resultado = await session.execute(
        update(Solicitacao)
        .where(
            Solicitacao.status == StatusSolicitacao.pendente,
            Solicitacao.urgente.is_(False),
            Solicitacao.criado_em < limite,
        )
        .values(urgente=True)
        .returning(Solicitacao)
    )
    atualizados = resultado.scalars().all()
    if atualizados:
        await session.commit()
        for solicitacao in atualizados:
            await _emitir_solicitacao(session, solicitacao, "solicitacao.atualizada")
    return atualizados


async def listar_ativas_por_mesa(session: AsyncSession, mesa_id: int) -> list[Solicitacao]:
    return (
        await session.execute(
            select(Solicitacao).where(Solicitacao.mesa_id == mesa_id, Solicitacao.status.in_(ATIVOS))
        )
    ).scalars().all()


async def listar_solicitacoes(session: AsyncSession) -> list[Solicitacao]:
    return (
        await session.execute(select(Solicitacao).order_by(Solicitacao.criado_em.desc()))
    ).scalars().all()
