import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aceitar, ApiError, concluir, fecharMesa } from "../api";
import { getNomeEstabelecimento, getToken, limparAuth } from "../auth";
import { ConfirmarFecharMesaDialog } from "../components/ConfirmarFecharMesaDialog";
import { Header } from "../components/Header";
import { IniciarTurnoOverlay } from "../components/IniciarTurnoOverlay";
import { Kanban } from "../components/Kanban";
import { notificarNovoChamado } from "../notificacoes";
import { temUrgentePendente, tocarBipeNovo, tocarBipeUrgente } from "../sound";
import { useTituloPiscante } from "../titulo";
import type { MesaOut, SolicitacaoOut } from "../types";
import { useOperacaoSocket } from "../ws";

export function OperacaoPage() {
  const navigate = useNavigate();
  const token = getToken();
  const [turnoIniciado, setTurnoIniciado] = useState(false);
  const [fecharMesaPendente, setFecharMesaPendente] = useState<{ mesaId: number; numero: number } | null>(
    null
  );

  // onEvento fires inside the WS hook's own closure, before this render's
  // `mesas` exists — a ref is how it reads the latest mesa numbers instead
  // of a stale (or undefined, on the very first event) snapshot.
  const mesasRef = useRef<Record<number, MesaOut>>({});

  const onEvento = useCallback((tipo: string, dados: unknown) => {
    if (tipo !== "solicitacao.criada") return;
    const solicitacao = dados as SolicitacaoOut;
    tocarBipeNovo();
    const numero = mesasRef.current[solicitacao.mesa_id]?.numero ?? solicitacao.mesa_id;
    notificarNovoChamado(numero, solicitacao.tipo);
  }, []);

  const { mesas, solicitacoes, wsStatus } = useOperacaoSocket(token ?? "", onEvento);

  useEffect(() => {
    mesasRef.current = mesas;
  }, [mesas]);

  const listaSolicitacoes = Object.values(solicitacoes);

  useTituloPiscante(
    listaSolicitacoes
      .filter((s) => s.status === "pendente")
      .map((s) => ({ mesaNumero: mesas[s.mesa_id]?.numero ?? s.mesa_id, tipo: s.tipo }))
  );

  useBipeUrgenteRepetido(() => temUrgentePendente(listaSolicitacoes));

  if (!token) {
    navigate("/login");
    return null;
  }

  async function handleAceitar(id: number) {
    try {
      await aceitar(id);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }

  async function handleConcluir(solicitacao: SolicitacaoOut) {
    try {
      await concluir(solicitacao.id);
      if (solicitacao.tipo === "fechar_conta") {
        const numero = mesas[solicitacao.mesa_id]?.numero ?? solicitacao.mesa_id;
        setFecharMesaPendente({ mesaId: solicitacao.mesa_id, numero });
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }

  async function handleConfirmarFecharMesa() {
    if (fecharMesaPendente) await fecharMesa(fecharMesaPendente.mesaId);
    setFecharMesaPendente(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {!turnoIniciado && <IniciarTurnoOverlay onIniciar={() => setTurnoIniciado(true)} />}
      <Header nomeEstabelecimento={getNomeEstabelecimento() ?? ""} wsStatus={wsStatus} />
      <Kanban
        solicitacoes={listaSolicitacoes}
        mesas={mesas}
        onAceitar={handleAceitar}
        onConcluir={handleConcluir}
      />
      {fecharMesaPendente && (
        <ConfirmarFecharMesaDialog
          mesaNumero={fecharMesaPendente.numero}
          onConfirmar={handleConfirmarFecharMesa}
          onCancelar={() => setFecharMesaPendente(null)}
        />
      )}
      <button
        onClick={() => {
          limparAuth();
          navigate("/login");
        }}
        className="fixed bottom-4 right-4 rounded bg-slate-700 px-3 py-1 text-sm text-white"
      >
        Sair
      </button>
    </div>
  );
}

function useBipeUrgenteRepetido(temUrgente: () => boolean): void {
  const temUrgenteRef = useRef(temUrgente);
  temUrgenteRef.current = temUrgente;
  useEffect(() => {
    const id = setInterval(() => {
      if (temUrgenteRef.current()) tocarBipeUrgente();
    }, 10000);
    return () => clearInterval(id);
  }, []);
}
