import type { MesaAtualizadaEvento, MesaClienteOut, SolicitacaoOut, TipoSolicitacao } from "./types";

export interface ClienteState {
  mesa: MesaClienteOut | null;
  wsStatus: "conectando" | "conectado" | "reconectando";
}

export type ClienteAction =
  | { type: "estado.inicial"; dados: MesaClienteOut }
  | { type: "mesa.atualizada"; dados: MesaAtualizadaEvento }
  | { type: "solicitacao.criada" | "solicitacao.atualizada"; dados: SolicitacaoOut }
  | { type: "ws.status"; status: ClienteState["wsStatus"] };

const ATIVOS = new Set(["pendente", "em_atendimento"]);

function aplicarSolicitacao(mesa: MesaClienteOut, dados: SolicitacaoOut): MesaClienteOut {
  const outros = mesa.solicitacoes_ativas.filter((s) => s.id !== dados.id);
  if (ATIVOS.has(dados.status)) {
    return { ...mesa, solicitacoes_ativas: [...outros, dados] };
  }
  return {
    ...mesa,
    solicitacoes_ativas: outros,
    cooldowns: { ...mesa.cooldowns, [dados.tipo]: dados.concluido_em },
  };
}

export function reducer(state: ClienteState, action: ClienteAction): ClienteState {
  switch (action.type) {
    case "estado.inicial":
      return { ...state, mesa: action.dados };
    case "mesa.atualizada": {
      if (state.mesa === null) return state;
      return {
        ...state,
        mesa: {
          ...state.mesa,
          numero: action.dados.numero,
          status: action.dados.status,
        },
      };
    }
    case "solicitacao.criada":
    case "solicitacao.atualizada": {
      if (state.mesa === null) return state;
      return { ...state, mesa: aplicarSolicitacao(state.mesa, action.dados) };
    }
    case "ws.status":
      return { ...state, wsStatus: action.status };
  }
}

export function segundosRestantes(mesa: MesaClienteOut, tipo: TipoSolicitacao, agora: number): number {
  const ultima = mesa.cooldowns[tipo];
  if (ultima === null) return 0;
  const decorrido = (agora - new Date(ultima).getTime()) / 1000;
  const restante = Math.ceil(mesa.cfg_cooldown_seg - decorrido);
  return restante > 0 ? restante : 0;
}
