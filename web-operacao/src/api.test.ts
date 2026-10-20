import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, login, listarMesas, aceitar } from "./api";
import { salvarAuth, limparAuth } from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
  limparAuth();
});

describe("api", () => {
  it("login posts credentials without auth header", async () => {
    const body = { access_token: "tok", token_type: "bearer", nome_estabelecimento: "X" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    const result = await login("ana", "senha123");
    expect(result).toEqual(body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/operacao/login");
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBeUndefined();
  });

  it("listarMesas sends Authorization header when token is stored", async () => {
    salvarAuth({ access_token: "tok123", token_type: "bearer", nome_estabelecimento: "X" });
    const mesas = [{ id: 1, numero: 1, status: "aberta", aberta_em: null }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mesas });
    vi.stubGlobal("fetch", fetchMock);
    const result = await listarMesas();
    expect(result).toEqual(mesas);
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer tok123");
  });

  it("throws ApiError with status+erro on non-2xx", async () => {
    salvarAuth({ access_token: "tok123", token_type: "bearer", nome_estabelecimento: "X" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ erro: "solicitacao_ja_aceita" }),
      })
    );
    await expect(aceitar(5)).rejects.toMatchObject(new ApiError(409, "solicitacao_ja_aceita", {}));
  });
});
