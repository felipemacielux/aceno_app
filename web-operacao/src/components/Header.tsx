import { LayoutGrid, Search, Table2 } from "lucide-react";
import { useState } from "react";

interface Props {
  wsStatus: "conectando" | "conectado" | "reconectando";
  busca: string;
  onBuscaChange: (valor: string) => void;
}

const LABEL_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  reconectando: "Reconectando…",
};

const COR_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "bg-amber-500 animate-pulse",
  conectado: "bg-emerald-500",
  reconectando: "bg-amber-500 animate-pulse",
};

export function Header({ wsStatus, busca, onBuscaChange }: Props) {
  const [buscaAberta, setBuscaAberta] = useState(false);

  return (
    <header className="border-b border-white/20 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <h1 className="text-lg font-semibold text-white">Aceno 👋</h1>

        <div className="flex items-center gap-1 rounded-lg bg-white/15 p-1">
          <button className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm">
            <LayoutGrid size={16} strokeWidth={1.75} />
            Chamados
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white/90">
            <Table2 size={16} strokeWidth={1.75} />
            Mesas
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className={`relative ${buscaAberta ? "" : "max-md:hidden"}`}>
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar mesa…"
              className="h-9 w-56 rounded-lg border border-white/40 bg-white/95 pl-9 text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={() => setBuscaAberta((v) => !v)}
            className="hidden h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-gray-600 max-md:flex"
            title="Buscar mesa"
          >
            <Search size={16} strokeWidth={1.75} />
          </button>
          <div className="flex h-9 items-center gap-2 rounded-lg bg-white/95 px-3 text-sm text-gray-700">
            <span className={`h-2 w-2 rounded-full ${COR_STATUS[wsStatus]}`} />
            {LABEL_STATUS[wsStatus]}
          </div>
        </div>
      </div>
    </header>
  );
}
