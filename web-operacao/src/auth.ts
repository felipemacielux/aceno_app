import type { LoginResponse } from "./types";

const TOKEN_KEY = "operacao.token";
const NOME_KEY = "operacao.nome_estabelecimento";

export function salvarAuth(login: LoginResponse): void {
  localStorage.setItem(TOKEN_KEY, login.access_token);
  localStorage.setItem(NOME_KEY, login.nome_estabelecimento);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getNomeEstabelecimento(): string | null {
  return localStorage.getItem(NOME_KEY);
}

export function limparAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NOME_KEY);
}
