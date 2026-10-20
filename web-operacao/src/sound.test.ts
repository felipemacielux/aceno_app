import { describe, it, expect } from "vitest";
import { temUrgentePendente } from "./sound";
import type { SolicitacaoOut } from "./types";

function solic(overrides: Partial<SolicitacaoOut>): SolicitacaoOut {
  return {
    id: 1,
    mesa_id: 1,
    tipo: "chamar_garcom",
    forma_pagamento: null,
    status: "pendente",
    urgente: false,
    criado_em: "2026-10-20T10:00:00Z",
    aceito_em: null,
    concluido_em: null,
    ...overrides,
  };
}

describe("temUrgentePendente", () => {
  it("is false for an empty list", () => {
    expect(temUrgentePendente([])).toBe(false);
  });

  it("is false when urgente but not pendente", () => {
    expect(temUrgentePendente([solic({ urgente: true, status: "em_atendimento" })])).toBe(false);
  });

  it("is false when pendente but not urgente", () => {
    expect(temUrgentePendente([solic({ urgente: false, status: "pendente" })])).toBe(false);
  });

  it("is true when at least one is pendente and urgente", () => {
    expect(temUrgentePendente([solic({ urgente: false }), solic({ id: 2, urgente: true, status: "pendente" })])).toBe(
      true
    );
  });
});
