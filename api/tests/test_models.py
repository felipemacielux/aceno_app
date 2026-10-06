from app.models import (
    Estabelecimento,
    Mesa,
    Solicitacao,
    StatusMesa,
    StatusSolicitacao,
    UsuarioOperacao,
)


def test_mesa_default_status_is_fechada():
    # SQLAlchemy aplica `default=` no flush/insert, não na construção do
    # objeto — checamos o default declarado na coluna mapeada.
    assert Mesa.__table__.c.status.default.arg == StatusMesa.fechada


def test_solicitacao_default_status_is_pendente():
    assert Solicitacao.__table__.c.status.default.arg == StatusSolicitacao.pendente


def test_models_importable():
    assert Estabelecimento.__tablename__ == "estabelecimento"
    assert UsuarioOperacao.__tablename__ == "usuario_operacao"
