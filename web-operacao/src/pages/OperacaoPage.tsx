import { AlertTriangle, Bell, ChevronDown, Layers, Receipt } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { abrirMesa, aceitar, ApiError, concluir, fecharMesa } from "../api";
import { getNomeEstabelecimento, getToken, limparAuth } from "../auth";
import { ConfirmarFecharMesaDialog } from "../components/ConfirmarFecharMesaDialog";
import { LoadingScreen } from "../components/LoadingScreen";
import { Kanban, type Ordenacao } from "../components/Kanban";
import { MesasView } from "../components/MesasView";
import { Sidebar, type Visao } from "../components/Sidebar";
import { TituloMetricas } from "../components/TituloMetricas";
import { TopBar } from "../components/TopBar";
import { notificarNovoChamado } from "../notificacoes";
import { getSilenciado, setSilenciado, temUrgentePendente, tocarBipeNovo, tocarBipeUrgente } from "../sound";
import { Tabs } from "../ui/Tabs";
import { useTituloPiscante } from "../titulo";
import type { MesaOut, SolicitacaoOut, TipoSolicitacao } from "../types";
import { useOperacaoSocket } from "../ws";

type FiltroTipo = "todos" | TipoSolicitacao | "urgentes";

interface FecharMesaPendente {
  mesaId: number;
  numero: number;
  mensagem: string;
}

export function OperacaoPage() {
  const navigate = useNavigate();
  const token = getToken();
  const [turnoDesde, setTurnoDesde] = useState<Date | null>(null);
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<Visao>("chamados");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("mais_antigos");
  const [silenciadoAtivo, setSilenciadoAtivo] = useState(getSilenciado());
  const [fecharMesaPendente, setFecharMesaPendente] = useState<FecharMesaPendente | null>(null);

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
  const listaBuscada = busca.trim()
    ? listaSolicitacoes.filter((s) => String(mesas[s.mesa_id]?.numero ?? s.mesa_id).includes(busca.trim()))
    : listaSolicitacoes;

  const listaFiltrada = listaBuscada.filter((s) => {
    if (filtroTipo === "todos") return true;
    if (filtroTipo === "urgentes") return s.urgente && s.status === "pendente";
    return s.tipo === filtroTipo;
  });

  const urgentesCount = listaSolicitacoes.filter((s) => s.urgente && s.status === "pendente").length;
  const pendentesCount = listaSolicitacoes.filter((s) => s.status === "pendente").length;

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

  function handleSair() {
    limparAuth();
    navigate("/login");
  }

  function handleToggleSilenciado() {
    const novo = !silenciadoAtivo;
    setSilenciado(novo);
    setSilenciadoAtivo(novo);
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
        setFecharMesaPendente({ mesaId: solicitacao.mesa_id, numero, mensagem: `Fechar a Mesa ${numero}?` });
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
  }

  async function handleAbrirMesa(mesaId: number) {
    await abrirMesa(mesaId);
  }

  function handleFecharMesaClick(mesa: MesaOut) {
    const temChamadoAtivo = listaSolicitacoes.some(
      (s) => s.mesa_id === mesa.id && (s.status === "pendente" || s.status === "em_atendimento")
    );
    if (temChamadoAtivo) {
      setFecharMesaPendente({
        mesaId: mesa.id,
        numero: mesa.numero,
        mensagem: `A Mesa ${mesa.numero} tem chamados ativos. Fechar mesmo assim?`,
      });
      return;
    }
    fecharMesa(mesa.id);
  }

  async function handleConfirmarFecharMesa() {
    if (fecharMesaPendente) await fecharMesa(fecharMesaPendente.mesaId);
    setFecharMesaPendente(null);
  }

  return (
    <div className="flex min-h-screen bg-login-bg">
      {!turnoDesde && <LoadingScreen onPronto={() => setTurnoDesde(new Date())} />}
      <Sidebar
        visao={visao}
        onVisaoChange={setVisao}
        pendentes={pendentesCount}
        silenciado={silenciadoAtivo}
        onToggleSilenciado={handleToggleSilenciado}
        onSair={handleSair}
      />
      <div className="flex-1 pl-2 pr-6 max-md:px-4 py-5 pb-24 md:pb-5 flex flex-col gap-5 w-full min-w-0">
        <TopBar
          busca={busca}
          onBuscaChange={setBusca}
          onSair={handleSair}
          solicitacoes={listaSolicitacoes}
          mesas={mesas}
        />
        <div className="flex flex-1 flex-col gap-5 w-full">
          <TituloMetricas
            titulo={visao === "chamados" ? "Chamados" : "Mesas"}
            nomeEstabelecimento={getNomeEstabelecimento() ?? "Restaurante"}
            turnoDesde={turnoDesde ?? new Date()}
            wsStatus={wsStatus}
          />

          {visao === "chamados" ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <Tabs
                  itens={[
                    { valor: "todos", label: "Todos", icone: <Layers size={16} strokeWidth={1.75} /> },
                    { valor: "chamar_garcom", label: "Chamar Garçom", icone: <Bell size={16} strokeWidth={1.75} /> },
                    { valor: "fechar_conta", label: "Fechar Conta", icone: <Receipt size={16} strokeWidth={1.75} /> },
                    {
                      valor: "urgentes",
                      label: "Urgentes",
                      icone: <AlertTriangle size={16} strokeWidth={1.75} />,
                      contador: urgentesCount,
                    },
                  ]}
                  ativo={filtroTipo}
                  onChange={setFiltroTipo}
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-texto-2">Ordenar por:</span>
                  <div className="relative">
                    <select
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
                      className="h-9 rounded-full bg-white px-4 pr-8 text-sm appearance-none outline-none"
                    >
                      <option value="mais_antigos">Mais antigos</option>
                      <option value="numero_mesa">Número da mesa</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-2"
                    />
                  </div>
                </div>
              </div>
              <Kanban
                solicitacoes={listaFiltrada}
                mesas={mesas}
                ordenacao={ordenacao}
                onAceitar={handleAceitar}
                onConcluir={handleConcluir}
              />
            </>
          ) : (
            <MesasView
              mesas={Object.values(mesas)}
              solicitacoes={listaSolicitacoes}
              onAbrir={handleAbrirMesa}
              onFechar={handleFecharMesaClick}
            />
          )}
        </div>
      </div>
      {fecharMesaPendente && (
        <ConfirmarFecharMesaDialog
          mensagem={fecharMesaPendente.mensagem}
          onConfirmar={handleConfirmarFecharMesa}
          onCancelar={() => setFecharMesaPendente(null)}
        />
      )}
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
