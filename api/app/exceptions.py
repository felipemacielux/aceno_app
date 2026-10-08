class ErroNegocio(Exception):
    status_code = 400
    erro = "erro"

    def __init__(self, **extra: object) -> None:
        self.extra = extra
        super().__init__(self.erro)


class CredenciaisInvalidas(ErroNegocio):
    status_code = 401
    erro = "credenciais_invalidas"


class MesaNaoEncontrada(ErroNegocio):
    status_code = 404
    erro = "mesa_nao_encontrada"


class MesaFechada(ErroNegocio):
    status_code = 409
    erro = "mesa_fechada"


class SolicitacaoAtiva(ErroNegocio):
    status_code = 409
    erro = "solicitacao_ativa"


class EmCooldown(ErroNegocio):
    status_code = 429
    erro = "cooldown"


class SolicitacaoNaoEncontrada(ErroNegocio):
    status_code = 404
    erro = "solicitacao_nao_encontrada"


class CancelamentoInvalido(ErroNegocio):
    status_code = 409
    erro = "cancelamento_invalido"


class AceiteConcorrente(ErroNegocio):
    status_code = 409
    erro = "solicitacao_ja_aceita"


class ConclusaoInvalida(ErroNegocio):
    status_code = 409
    erro = "conclusao_invalida"
