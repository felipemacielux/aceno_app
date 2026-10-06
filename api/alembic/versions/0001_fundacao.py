"""fundacao

Revision ID: 0001
Revises:
Create Date: 2026-10-06

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

status_mesa = sa.Enum("aberta", "fechada", name="status_mesa")
tipo_solicitacao = sa.Enum("chamar_garcom", "fechar_conta", name="tipo_solicitacao")
forma_pagamento = sa.Enum("dinheiro", "cartao", "pix", name="forma_pagamento")
status_solicitacao = sa.Enum(
    "pendente", "em_atendimento", "concluido", "cancelado", name="status_solicitacao"
)


def upgrade() -> None:
    # Os tipos ENUM do Postgres são criados automaticamente por
    # op.create_table a partir da coluna — nada a fazer aqui antes.
    op.create_table(
        "estabelecimento",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.String, nullable=False),
        sa.Column("wifi_ssid", sa.String, nullable=False),
        sa.Column("wifi_senha", sa.String, nullable=False),
        sa.Column("cardapio_url", sa.String, nullable=False),
        sa.Column("cfg_cooldown_seg", sa.Integer, nullable=False, server_default="30"),
        sa.Column("cfg_urgente_seg", sa.Integer, nullable=False, server_default="60"),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "mesa",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "estabelecimento_id", sa.Integer, sa.ForeignKey("estabelecimento.id"), nullable=False
        ),
        sa.Column("numero", sa.Integer, nullable=False),
        sa.Column("token", sa.String, nullable=False, unique=True),
        sa.Column("status", status_mesa, nullable=False, server_default="fechada"),
        sa.Column("aberta_em", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "solicitacao",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("mesa_id", sa.Integer, sa.ForeignKey("mesa.id"), nullable=False),
        sa.Column("tipo", tipo_solicitacao, nullable=False),
        sa.Column("forma_pagamento", forma_pagamento, nullable=True),
        sa.Column(
            "status", status_solicitacao, nullable=False, server_default="pendente"
        ),
        sa.Column("urgente", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("aceito_em", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("concluido_em", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_solicitacao_ativa_por_tipo_mesa",
        "solicitacao",
        ["mesa_id", "tipo"],
        unique=True,
        postgresql_where=sa.text("status IN ('pendente', 'em_atendimento')"),
    )

    op.create_table(
        "usuario_operacao",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "estabelecimento_id", sa.Integer, sa.ForeignKey("estabelecimento.id"), nullable=False
        ),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("senha_hash", sa.String, nullable=False),
        sa.Column("criado_em", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("usuario_operacao")
    op.drop_index("ix_solicitacao_ativa_por_tipo_mesa", table_name="solicitacao")
    op.drop_table("solicitacao")
    op.drop_table("mesa")
    op.drop_table("estabelecimento")
    status_solicitacao.drop(op.get_bind(), checkfirst=True)
    forma_pagamento.drop(op.get_bind(), checkfirst=True)
    tipo_solicitacao.drop(op.get_bind(), checkfirst=True)
    status_mesa.drop(op.get_bind(), checkfirst=True)
