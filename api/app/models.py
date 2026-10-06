import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class StatusMesa(str, enum.Enum):
    aberta = "aberta"
    fechada = "fechada"


class TipoSolicitacao(str, enum.Enum):
    chamar_garcom = "chamar_garcom"
    fechar_conta = "fechar_conta"


class FormaPagamento(str, enum.Enum):
    dinheiro = "dinheiro"
    cartao = "cartao"
    pix = "pix"


class StatusSolicitacao(str, enum.Enum):
    pendente = "pendente"
    em_atendimento = "em_atendimento"
    concluido = "concluido"
    cancelado = "cancelado"


class Estabelecimento(Base):
    __tablename__ = "estabelecimento"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str]
    wifi_ssid: Mapped[str]
    wifi_senha: Mapped[str]
    cardapio_url: Mapped[str]
    cfg_cooldown_seg: Mapped[int] = mapped_column(default=30)
    cfg_urgente_seg: Mapped[int] = mapped_column(default=60)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    mesas: Mapped[list["Mesa"]] = relationship(back_populates="estabelecimento")
    usuarios: Mapped[list["UsuarioOperacao"]] = relationship(back_populates="estabelecimento")


class Mesa(Base):
    __tablename__ = "mesa"

    id: Mapped[int] = mapped_column(primary_key=True)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimento.id"))
    numero: Mapped[int]
    token: Mapped[str] = mapped_column(unique=True, default=lambda: uuid.uuid4().hex)
    status: Mapped[StatusMesa] = mapped_column(
        Enum(StatusMesa, name="status_mesa"), default=StatusMesa.fechada
    )
    aberta_em: Mapped[datetime | None] = mapped_column(nullable=True)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    estabelecimento: Mapped["Estabelecimento"] = relationship(back_populates="mesas")
    solicitacoes: Mapped[list["Solicitacao"]] = relationship(back_populates="mesa")


class Solicitacao(Base):
    """O índice único parcial que garante 'um chamado ativo por tipo por
    mesa' (regra 1) não é expresso aqui: SQLAlchemy ORM não modela índices
    parciais com WHERE. Ele é criado só na migration."""

    __tablename__ = "solicitacao"

    id: Mapped[int] = mapped_column(primary_key=True)
    mesa_id: Mapped[int] = mapped_column(ForeignKey("mesa.id"))
    tipo: Mapped[TipoSolicitacao] = mapped_column(Enum(TipoSolicitacao, name="tipo_solicitacao"))
    forma_pagamento: Mapped[FormaPagamento | None] = mapped_column(
        Enum(FormaPagamento, name="forma_pagamento"), nullable=True
    )
    status: Mapped[StatusSolicitacao] = mapped_column(
        Enum(StatusSolicitacao, name="status_solicitacao"), default=StatusSolicitacao.pendente
    )
    urgente: Mapped[bool] = mapped_column(default=False)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    aceito_em: Mapped[datetime | None] = mapped_column(nullable=True)
    concluido_em: Mapped[datetime | None] = mapped_column(nullable=True)

    mesa: Mapped["Mesa"] = relationship(back_populates="solicitacoes")


class UsuarioOperacao(Base):
    __tablename__ = "usuario_operacao"

    id: Mapped[int] = mapped_column(primary_key=True)
    estabelecimento_id: Mapped[int] = mapped_column(ForeignKey("estabelecimento.id"))
    username: Mapped[str] = mapped_column(unique=True)
    senha_hash: Mapped[str]
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    estabelecimento: Mapped["Estabelecimento"] = relationship(back_populates="usuarios")
