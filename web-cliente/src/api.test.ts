import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, getMesa, chamarGarcom } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("getMesa returns parsed body on 200", async () => {
    const mesa = { numero: 1, status: "aberta" } as any;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mesa })
    );
    const result = await getMesa("tok");
    expect(result).toEqual(mesa);
    expect((fetch as any).mock.calls[0][0]).toBe("/api/m/tok");
  });

  it("throws ApiError with status+erro on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ erro: "cooldown", segundos_restantes: 12 }),
      })
    );
    await expect(chamarGarcom("tok")).rejects.toMatchObject(
      new ApiError(429, "cooldown", { segundos_restantes: 12 })
    );
  });
});
