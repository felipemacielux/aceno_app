from datetime import datetime

from pydantic import BaseModel

from app.models import FormaPagamento, StatusMesa, StatusSolicitacao, TipoSolicitacao


class LoginRequest(BaseModel):
    username: str
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    nome_estabelecimento: str


class MesaOut(BaseModel):
    id: int
    numero: int
    status: StatusMesa
    aberta_em: datetime | None

    class Config:
        from_attributes = True


class SolicitacaoOut(BaseModel):
    id: int
    mesa_id: int
    tipo: TipoSolicitacao
    forma_pagamento: FormaPagamento | None
    status: StatusSolicitacao
    urgente: bool
    criado_em: datetime
    aceito_em: datetime | None
    concluido_em: datetime | None

    class Config:
        from_attributes = True


class FecharContaRequest(BaseModel):
    forma_pagamento: FormaPagamento


class MesaClienteOut(BaseModel):
    numero: int
    status: StatusMesa
    nome_estabelecimento: str
    wifi_ssid: str
    wifi_senha: str
    cardapio_url: str
    cfg_cooldown_seg: int
    cooldowns: dict[TipoSolicitacao, datetime | None]
    solicitacoes_ativas: list[SolicitacaoOut]
