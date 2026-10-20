import { describe, it, expect } from "vitest";
import { formatarTituloAlerta } from "./titulo";

describe("formatarTituloAlerta", () => {
  it("returns null for an empty list", () => {
    expect(formatarTituloAlerta([])).toBeNull();
  });

  it("formats count, mesa number and tipo label for chamar_garcom", () => {
    expect(formatarTituloAlerta([{ mesaNumero: 12, tipo: "chamar_garcom" }])).toBe(
      "(1) Mesa 12 — Chamar Garçom"
    );
  });

  it("formats tipo label for fechar_conta and counts all items", () => {
    expect(
      formatarTituloAlerta([
        { mesaNumero: 3, tipo: "fechar_conta" },
        { mesaNumero: 7, tipo: "chamar_garcom" },
      ])
    ).toBe("(2) Mesa 3 — Fechar Conta");
  });
});
