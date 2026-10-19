import { describe, it, expect } from "vitest";
import { reducer, segundosRestantes, type ClienteState } from "./reducer";
import type { MesaClienteOut, SolicitacaoOut } from "./types";

const mesaBase: MesaClienteOut = {
  numero: 12,
  status: "aberta",
  nome_estabelecimento: "Restaurante Teste",
  wifi_ssid: "Wifi",
  wifi_senha: "12345678",
  cardapio_url: "https://x.com",
  cfg_cooldown_seg: 30,
  cooldowns: { chamar_garcom: null, fechar_conta: null },
  solicitacoes_ativas: [],
};

const initialState: ClienteState = { mesa: null, wsStatus: "conectando" };

function solicitacao(overrides: Partial<SolicitacaoOut>): SolicitacaoOut {
  return {
    id: 1,
    mesa_id: 1,
    tipo: "chamar_garcom",
    forma_pagamento: null,
    status: "pendente",
    urgente: false,
    criado_em: "2026-01-01T00:00:00Z",
    aceito_em: null,
    concluido_em: null,
    ...overrides,
  };
}

describe("reducer", () => {
  it("estado.inicial replaces mesa wholesale", () => {
    const state = reducer(initialState, { type: "estado.inicial", dados: mesaBase });
    expect(state.mesa).toEqual(mesaBase);
  });

  it("solicitacao.criada adds to solicitacoes_ativas", () => {
    const afterInit = reducer(initialState, { type: "estado.inicial", dados: mesaBase });
    const pendente = solicitacao({ id: 1, status: "pendente" });
    const state = reducer(afterInit, { type: "solicitacao.criada", dados: pendente });
    expect(state.mesa!.solicitacoes_ativas).toEqual([pendente]);
  });

  it("solicitacao.atualizada to concluido removes from ativas and sets cooldown", () => {
    const afterInit = reducer(initialState, { type: "estado.inicial", dados: mesaBase });
    const pendente = solicitacao({ id: 1, status: "pendente" });
    const afterCriada = reducer(afterInit, { type: "solicitacao.criada", dados: pendente });
    const concluida = solicitacao({ id: 1, status: "concluido", concluido_em: "2026-01-01T00:05:00Z" });
    const state = reducer(afterCriada, { type: "solicitacao.atualizada", dados: concluida });
    expect(state.mesa!.solicitacoes_ativas).toEqual([]);
    expect(state.mesa!.cooldowns.chamar_garcom).toBe("2026-01-01T00:05:00Z");
  });

  it("mesa.atualizada patches numero/status/aberta_em only", () => {
    const afterInit = reducer(initialState, { type: "estado.inicial", dados: mesaBase });
    const state = reducer(afterInit, {
      type: "mesa.atualizada",
      dados: { id: 1, numero: 12, status: "fechada", aberta_em: null },
    });
    expect(state.mesa!.status).toBe("fechada");
    expect(state.mesa!.nome_estabelecimento).toBe("Restaurante Teste");
  });

  it("ws.status updates wsStatus", () => {
    const state = reducer(initialState, { type: "ws.status", status: "reconectando" });
    expect(state.wsStatus).toBe("reconectando");
  });
});

describe("segundosRestantes", () => {
  it("returns remaining seconds when within cooldown window", () => {
    const mesa: MesaClienteOut = {
      ...mesaBase,
      cooldowns: { chamar_garcom: "2026-01-01T00:00:00Z", fechar_conta: null },
    };
    const agora = new Date("2026-01-01T00:00:20Z").getTime();
    expect(segundosRestantes(mesa, "chamar_garcom", agora)).toBe(10);
  });

  it("returns 0 when no cooldown recorded", () => {
    expect(segundosRestantes(mesaBase, "fechar_conta", Date.now())).toBe(0);
  });

  it("returns 0 when cooldown already elapsed", () => {
    const mesa: MesaClienteOut = {
      ...mesaBase,
      cooldowns: { chamar_garcom: "2026-01-01T00:00:00Z", fechar_conta: null },
    };
    const agora = new Date("2026-01-01T00:01:00Z").getTime();
    expect(segundosRestantes(mesa, "chamar_garcom", agora)).toBe(0);
  });
});
