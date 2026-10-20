import type { SolicitacaoOut } from "./types";

const LABEL_TIPO: Record<SolicitacaoOut["tipo"], string> = {
  chamar_garcom: "Chamar Garçom",
  fechar_conta: "Fechar Conta",
};

export function pedirPermissaoNotificacao(): void {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function notificarNovoChamado(mesaNumero: number, tipo: SolicitacaoOut["tipo"]): void {
  if (!document.hidden) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(`Mesa ${mesaNumero} — ${LABEL_TIPO[tipo]}`);
}
