import { getToken } from "./auth";
import type { LoginResponse, MesaOut, SolicitacaoOut } from "./types";

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
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const body = await res.json();
  if (!res.ok) {
    const { erro, ...extra } = body as { erro: string; [k: string]: unknown };
    throw new ApiError(res.status, erro, extra);
  }
  return body as T;
}

export function login(username: string, senha: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/operacao/login", {
    method: "POST",
    body: JSON.stringify({ username, senha }),
  });
}

export function listarMesas(): Promise<MesaOut[]> {
  return request<MesaOut[]>("/api/operacao/mesas");
}

export function listarSolicitacoes(): Promise<SolicitacaoOut[]> {
  return request<SolicitacaoOut[]>("/api/operacao/solicitacoes");
}

export function abrirMesa(mesaId: number): Promise<MesaOut> {
  return request<MesaOut>(`/api/operacao/mesas/${mesaId}/abrir`, { method: "POST" });
}

export function fecharMesa(mesaId: number): Promise<MesaOut> {
  return request<MesaOut>(`/api/operacao/mesas/${mesaId}/fechar`, { method: "POST" });
}

export function aceitar(solicitacaoId: number): Promise<SolicitacaoOut> {
  return request<SolicitacaoOut>(`/api/operacao/solicitacoes/${solicitacaoId}/aceitar`, {
    method: "POST",
  });
}

export function concluir(solicitacaoId: number): Promise<SolicitacaoOut> {
  return request<SolicitacaoOut>(`/api/operacao/solicitacoes/${solicitacaoId}/concluir`, {
    method: "POST",
  });
}
