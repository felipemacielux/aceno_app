import { describe, it, expect, beforeEach } from "vitest";
import { salvarAuth, getToken, getNomeEstabelecimento, limparAuth } from "./auth";

describe("auth", () => {
  beforeEach(() => localStorage.clear());

  it("salvarAuth persists token and nome_estabelecimento", () => {
    salvarAuth({ access_token: "abc", token_type: "bearer", nome_estabelecimento: "Bar do Zé" });
    expect(getToken()).toBe("abc");
    expect(getNomeEstabelecimento()).toBe("Bar do Zé");
  });

  it("getToken returns null when nothing stored", () => {
    expect(getToken()).toBeNull();
  });

  it("limparAuth removes stored values", () => {
    salvarAuth({ access_token: "abc", token_type: "bearer", nome_estabelecimento: "Bar do Zé" });
    limparAuth();
    expect(getToken()).toBeNull();
    expect(getNomeEstabelecimento()).toBeNull();
  });
});
