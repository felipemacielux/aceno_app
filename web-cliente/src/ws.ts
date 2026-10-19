import { useEffect, useReducer, useRef } from "react";
import { getMesa } from "./api";
import { reducer, type ClienteAction, type ClienteState } from "./reducer";

const BACKOFF_SEQUENCE_MS = [1000, 2000, 4000, 8000];
const EVENTOS_CONHECIDOS = new Set([
  "estado.inicial",
  "mesa.atualizada",
  "solicitacao.criada",
  "solicitacao.atualizada",
]);

export function useMesaSocket(token: string): ClienteState {
  const [state, dispatch] = useReducer(reducer, { mesa: null, wsStatus: "conectando" });
  const tentativaRef = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fechadoPeloEfeito = false;

    function conectar() {
      const protocolo = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocolo}://${location.host}/ws/m/${token}`);

      socket.onopen = async () => {
        if (tentativaRef.current > 0) {
          try {
            dispatch({ type: "estado.inicial", dados: await getMesa(token) });
          } catch {
            // próxima mensagem do socket (estado.inicial) corrige o estado
          }
        }
        tentativaRef.current = 0;
        dispatch({ type: "ws.status", status: "conectado" });
      };

      socket.onmessage = (event) => {
        const envelope = JSON.parse(event.data) as { tipo: string; dados: unknown };
        if (EVENTOS_CONHECIDOS.has(envelope.tipo)) {
          dispatch({ type: envelope.tipo, dados: envelope.dados } as ClienteAction);
        }
      };

      socket.onclose = () => {
        if (fechadoPeloEfeito) return;
        dispatch({ type: "ws.status", status: "reconectando" });
        const espera = BACKOFF_SEQUENCE_MS[Math.min(tentativaRef.current, BACKOFF_SEQUENCE_MS.length - 1)];
        tentativaRef.current += 1;
        timer = setTimeout(conectar, espera);
      };
    }

    conectar();

    const pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ tipo: "ping" }));
      }
    }, 25000);

    return () => {
      fechadoPeloEfeito = true;
      clearInterval(pingInterval);
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [token]);

  return state;
}
