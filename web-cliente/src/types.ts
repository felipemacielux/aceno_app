export type StatusMesa = "aberta" | "fechada";
export type TipoSolicitacao = "chamar_garcom" | "fechar_conta";
export type FormaPagamento = "dinheiro" | "cartao" | "pix";
export type StatusSolicitacao = "pendente" | "em_atendimento" | "concluido" | "cancelado";

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

export interface MesaClienteOut {
  numero: number;
  status: StatusMesa;
  nome_estabelecimento: string;
  wifi_ssid: string;
  wifi_senha: string;
  cardapio_url: string;
  cfg_cooldown_seg: number;
  cooldowns: Record<TipoSolicitacao, string | null>;
  solicitacoes_ativas: SolicitacaoOut[];
}

export interface MesaAtualizadaEvento {
  id: number;
  numero: number;
  status: StatusMesa;
  aberta_em: string | null;
}

export interface WsEnvelope<T> {
  tipo: string;
  dados: T;
}
