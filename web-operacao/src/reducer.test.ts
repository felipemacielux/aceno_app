import { describe, it, expect } from "vitest";
import { reducer, type OperacaoState } from "./reducer";
import type { MesaOut, SolicitacaoOut } from "./types";

const ESTADO_VAZIO: OperacaoState = { mesas: {}, solicitacoes: {}, wsStatus: "conectando" };

const mesa1: MesaOut = { id: 1, numero: 1, status: "aberta", aberta_em: "2026-10-20T10:00:00Z" };
const solic1: SolicitacaoOut = {
  id: 10,
  mesa_id: 1,
  tipo: "chamar_garcom",
  forma_pagamento: null,
  status: "pendente",
  urgente: false,
  criado_em: "2026-10-20T10:05:00Z",
  aceito_em: null,
  concluido_em: null,
};

describe("reducer", () => {
  it("estado.inicial populates mesas and solicitacoes keyed by id", () => {
    const novo = reducer(ESTADO_VAZIO, {
      type: "estado.inicial",
      dados: { mesas: [mesa1], solicitacoes: [solic1] },
    });
    expect(novo.mesas[1]).toEqual(mesa1);
    expect(novo.solicitacoes[10]).toEqual(solic1);
  });

  it("mesa.atualizada upserts a single mesa", () => {
    const estado = reducer(ESTADO_VAZIO, {
      type: "estado.inicial",
      dados: { mesas: [mesa1], solicitacoes: [] },
    });
    const fechada: MesaOut = { ...mesa1, status: "fechada", aberta_em: null };
    const novo = reducer(estado, { type: "mesa.atualizada", dados: fechada });
    expect(novo.mesas[1].status).toBe("fechada");
  });

  it("mesa.atualizada for an unknown mesa id still adds it", () => {
    const mesa2: MesaOut = { id: 2, numero: 2, status: "aberta", aberta_em: "2026-10-20T10:00:00Z" };
    const novo = reducer(ESTADO_VAZIO, { type: "mesa.atualizada", dados: mesa2 });
    expect(novo.mesas[2]).toEqual(mesa2);
  });

  it("solicitacao.criada upserts a solicitacao", () => {
    const novo = reducer(ESTADO_VAZIO, { type: "solicitacao.criada", dados: solic1 });
    expect(novo.solicitacoes[10]).toEqual(solic1);
  });

  it("solicitacao.atualizada replaces the existing entry by id", () => {
    const estado = reducer(ESTADO_VAZIO, { type: "solicitacao.criada", dados: solic1 });
    const aceita: SolicitacaoOut = { ...solic1, status: "em_atendimento", aceito_em: "2026-10-20T10:06:00Z" };
    const novo = reducer(estado, { type: "solicitacao.atualizada", dados: aceita });
    expect(novo.solicitacoes[10].status).toBe("em_atendimento");
  });

  it("ws.status updates only wsStatus", () => {
    const novo = reducer(ESTADO_VAZIO, { type: "ws.status", status: "conectado" });
    expect(novo.wsStatus).toBe("conectado");
    expect(novo.mesas).toEqual({});
  });
});
