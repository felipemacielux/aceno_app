import type { FormaPagamento, MesaClienteOut, SolicitacaoOut } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public erro: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(erro);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok) {
    const { erro, ...extra } = body as { erro: string; [k: string]: unknown };
    throw new ApiError(res.status, erro, extra);
  }
  return body as T;
}

export function getMesa(token: string): Promise<MesaClienteOut> {
  return request<MesaClienteOut>(`/api/m/${token}`);
}

export function chamarGarcom(token: string): Promise<SolicitacaoOut> {
  return request<SolicitacaoOut>(`/api/m/${token}/chamar-garcom`, { method: "POST" });
}

export function fecharConta(token: string, forma_pagamento: FormaPagamento): Promise<SolicitacaoOut> {
  return request<SolicitacaoOut>(`/api/m/${token}/fechar-conta`, {
    method: "POST",
    body: JSON.stringify({ forma_pagamento }),
  });
}

export function cancelarSolicitacao(token: string, solicitacaoId: number): Promise<SolicitacaoOut> {
  return request<SolicitacaoOut>(`/api/m/${token}/solicitacoes/${solicitacaoId}/cancelar`, {
    method: "POST",
  });
}
