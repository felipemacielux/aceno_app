import { useEffect, useRef } from "react";
import type { SolicitacaoOut } from "./types";

export interface ItemAlerta {
  mesaNumero: number;
  tipo: SolicitacaoOut["tipo"];
}

const LABEL_TIPO: Record<SolicitacaoOut["tipo"], string> = {
  chamar_garcom: "Chamar Garçom",
  fechar_conta: "Fechar Conta",
};

export function formatarTituloAlerta(pendentes: ItemAlerta[]): string | null {
  if (pendentes.length === 0) return null;
  const primeiro = pendentes[0];
  return `(${pendentes.length}) Mesa ${primeiro.mesaNumero} — ${LABEL_TIPO[primeiro.tipo]}`;
}

export function useTituloPiscante(pendentes: ItemAlerta[]): void {
  const tituloOriginalRef = useRef(document.title);

  useEffect(() => {
    const alerta = formatarTituloAlerta(pendentes);
    if (alerta === null || !document.hidden) {
      document.title = tituloOriginalRef.current;
      return;
    }

    let mostrandoAlerta = true;
    document.title = alerta;
    const interval = setInterval(() => {
      mostrandoAlerta = !mostrandoAlerta;
      document.title = mostrandoAlerta ? alerta : tituloOriginalRef.current;
    }, 1000);

    function restaurarAoFicarVisivel() {
      if (!document.hidden) {
        document.title = tituloOriginalRef.current;
      }
    }
    document.addEventListener("visibilitychange", restaurarAoFicarVisivel);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", restaurarAoFicarVisivel);
      document.title = tituloOriginalRef.current;
    };
  }, [pendentes]);
}
