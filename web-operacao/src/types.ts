export type StatusMesa = "aberta" | "fechada";
export type TipoSolicitacao = "chamar_garcom" | "fechar_conta";
export type FormaPagamento = "dinheiro" | "cartao" | "pix";
export type StatusSolicitacao = "pendente" | "em_atendimento" | "concluido" | "cancelado";

export interface MesaOut {
  id: number;
  numero: number;
  status: StatusMesa;
  aberta_em: string | null;
}

export interface SolicitacaoOut {
  id: number;
  mesa_id: number;
  tipo: TipoSolicitacao;
  forma_pagamento: FormaPagamento | null;
  status: StatusSolicitacao;
  urgente: boolean;
  criado_em: string;
  aceito_em: string | null;
  concluido_em: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  nome_estabelecimento: string;
}

export interface EstadoInicialOperacao {
  mesas: MesaOut[];
  solicitacoes: SolicitacaoOut[];
}

export interface WsEnvelope<T> {
  tipo: string;
  dados: T;
}
