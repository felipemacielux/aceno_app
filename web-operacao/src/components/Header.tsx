interface Props {
  nomeEstabelecimento: string;
  wsStatus: "conectando" | "conectado" | "reconectando";
}

const LABEL_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  reconectando: "Reconectando…",
};

const COR_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "bg-yellow-400",
  conectado: "bg-emerald-500",
  reconectando: "bg-red-500",
};

export function Header({ nomeEstabelecimento, wsStatus }: Props) {
  return (
    <header className="flex items-center justify-between bg-slate-800 px-6 py-3 text-white">
      <h1 className="text-lg font-semibold">{nomeEstabelecimento}</h1>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${COR_STATUS[wsStatus]}`} />
        {LABEL_STATUS[wsStatus]}
      </div>
    </header>
  );
}
