import {
  AlertTriangle,
  Armchair,
  Bell,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  Search,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getUsuario } from "../auth";
import { pedirPermissaoNotificacao } from "../notificacoes";
import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  busca: string;
  onBuscaChange: (valor: string) => void;
  onSair: () => void;
  solicitacoes?: SolicitacaoOut[];
  mesas?: Record<number, MesaOut>;
}

function iniciais(nome: string): string {
  return nome.slice(0, 2).toUpperCase();
}

function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${Math.round(segundos)}s`;
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return seg > 0 ? `${min}m ${seg}s` : `${min}m`;
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

export function TopBar({
  busca,
  onBuscaChange,
  onSair,
  solicitacoes = [],
  mesas = {},
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const usuario = getUsuario() ?? "operador";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const finalizados = solicitacoes.filter(
    (s) => s.status === "concluido" || s.status === "cancelado"
  );
  const aceiteMedioSeg = media(
    solicitacoes
      .filter((s) => s.aceito_em)
      .map(
        (s) =>
          (new Date(s.aceito_em!).getTime() -
            new Date(s.criado_em).getTime()) /
          1000
      )
  );
  const conclusaoMediaSeg = media(
    finalizados
      .filter((s) => s.concluido_em)
      .map(
        (s) =>
          (new Date(s.concluido_em!).getTime() -
            new Date(s.criado_em).getTime()) /
          1000
      )
  );
  const urgentes = solicitacoes.filter(
    (s) => s.urgente && s.status === "pendente"
  ).length;
  const mesasAbertas = Object.values(mesas).filter(
    (m) => m.status === "aberta"
  ).length;

  const metricas = [
    {
      rotulo: "Total",
      valor: String(solicitacoes.length),
      icone: ListChecks,
      destaque: false,
    },
    {
      rotulo: "Aceite",
      valor: formatarDuracao(aceiteMedioSeg),
      icone: Timer,
      destaque: false,
    },
    {
      rotulo: "Conclusão",
      valor: formatarDuracao(conclusaoMediaSeg),
      icone: CheckCircle2,
      destaque: false,
    },
    {
      rotulo: "Urgentes",
      valor: String(urgentes),
      icone: AlertTriangle,
      destaque: urgentes > 0,
    },
    {
      rotulo: "Mesas abertas",
      valor: String(mesasAbertas),
      icone: Armchair,
      destaque: false,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap w-full">
      {/* Campo de busca */}
      <div className="relative shrink-0">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3"
        />
        <input
          ref={inputRef}
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar mesa…"
          className="h-10 w-72 max-md:w-44 rounded-full bg-white pl-10 pr-10 text-sm outline-none placeholder:text-texto-3"
        />
        <kbd className="hidden md:block pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-texto-3 bg-fundo rounded-md px-1.5">
          /
        </kbd>
      </div>

      {/* Lado direito: Métricas + Notificação e Perfil */}
      <div className="flex items-center gap-2 max-md:w-full">
        <div className="flex items-center gap-2 overflow-x-auto max-md:pb-1">
          {metricas.map((item) => (
            <div
              key={item.rotulo}
              className={`h-10 shrink-0 rounded-full px-3.5 text-sm flex items-center gap-2 ${item.destaque ? "bg-[#FCE6E1]" : "bg-white"
                }`}
            >
              <item.icone
                size={16}
                strokeWidth={1.75}
                className={item.destaque ? "text-perigo" : "text-texto-2"}
              />
              <span className="text-texto-2 text-xs md:text-sm">
                {item.rotulo}
              </span>
              <span
                className={`font-semibold text-xs md:text-sm ${item.destaque ? "text-perigo" : "text-texto"
                  }`}
              >
                {item.valor}
              </span>
            </div>
          ))}
        </div>

        {/* Notificações e Perfil */}
        <div className="h-10 shrink-0 rounded-full bg-white px-2 flex items-center gap-1.5">
          <button
            onClick={pedirPermissaoNotificacao}
            className="h-8 w-8 flex items-center justify-center rounded-full text-texto-2 hover:bg-fundo hover:text-texto transition-colors"
            title="Notificações"
          >
            <Bell size={16} strokeWidth={1.75} />
          </button>

          <div className="h-4 w-px bg-borda mx-0.5" />

          <div className="relative flex items-center">
            <button
              onClick={() => setMenuAberto((v) => !v)}
              className="h-8 flex items-center gap-2 pl-0.5 pr-2.5 rounded-full hover:bg-fundo/70 transition-colors"
            >
              <span className="h-7 w-7 rounded-full bg-[#F4631E] text-white text-xs font-medium flex items-center justify-center shrink-0">
                {iniciais(usuario)}
              </span>
              <span className="text-sm font-medium leading-none text-texto max-md:hidden">
                {usuario}
              </span>
              <ChevronDown
                size={14}
                className={`text-texto-2 transition-transform duration-200 ${menuAberto ? "rotate-180" : ""
                  }`}
              />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-white p-1 shadow-[0_4px_16px_rgb(16_24_40/0.08)] border border-borda/60 z-50">
                <button
                  onClick={onSair}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-texto hover:bg-fundo transition-colors"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
