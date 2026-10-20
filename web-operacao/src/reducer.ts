import type { EstadoInicialOperacao, MesaOut, SolicitacaoOut } from "./types";

export interface OperacaoState {
  mesas: Record<number, MesaOut>;
  solicitacoes: Record<number, SolicitacaoOut>;
  wsStatus: "conectando" | "conectado" | "reconectando";
}

export type OperacaoAction =
  | { type: "estado.inicial"; dados: EstadoInicialOperacao }
  | { type: "mesa.atualizada"; dados: MesaOut }
  | { type: "solicitacao.criada" | "solicitacao.atualizada"; dados: SolicitacaoOut }
  | { type: "ws.status"; status: OperacaoState["wsStatus"] };

function porId<T extends { id: number }>(itens: T[]): Record<number, T> {
  const resultado: Record<number, T> = {};
  for (const item of itens) resultado[item.id] = item;
  return resultado;
}

export function reducer(state: OperacaoState, action: OperacaoAction): OperacaoState {
  switch (action.type) {
    case "estado.inicial":
      return {
        ...state,
        mesas: porId(action.dados.mesas),
        solicitacoes: porId(action.dados.solicitacoes),
      };
    case "mesa.atualizada":
      return { ...state, mesas: { ...state.mesas, [action.dados.id]: action.dados } };
    case "solicitacao.criada":
    case "solicitacao.atualizada":
      return {
        ...state,
        solicitacoes: { ...state.solicitacoes, [action.dados.id]: action.dados },
      };
    case "ws.status":
      return { ...state, wsStatus: action.status };
  }
}
