import type { LoginResponse } from "./types";

const TOKEN_KEY = "operacao.token";
const NOME_KEY = "operacao.nome_estabelecimento";
const USUARIO_KEY = "operacao.usuario";

export function salvarAuth(login: LoginResponse, usuario: string): void {
  localStorage.setItem(TOKEN_KEY, login.access_token);
  localStorage.setItem(NOME_KEY, login.nome_estabelecimento);
  localStorage.setItem(USUARIO_KEY, usuario);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getNomeEstabelecimento(): string | null {
  return localStorage.getItem(NOME_KEY);
}

export function getUsuario(): string | null {
  return localStorage.getItem(USUARIO_KEY);
}

export function limparAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NOME_KEY);
  localStorage.removeItem(USUARIO_KEY);
}
