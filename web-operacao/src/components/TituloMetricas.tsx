import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  titulo: string;
  nomeEstabelecimento: string;
  turnoDesde: Date;
  wsStatus: "conectando" | "conectado" | "reconectando";
  solicitacoes?: SolicitacaoOut[];
  mesas?: Record<number, MesaOut>;
}

const LABEL_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  reconectando: "Reconectando…",
};

const CLASSE_STATUS: Record<Props["wsStatus"], string> = {
  conectando: "bg-[#FEF3C7] text-[#92400E]",
  conectado: "bg-[#CFEFF4] text-[#1B7C90]",
  reconectando: "bg-[#FEF3C7] text-[#92400E]",
};

function horaFormatada(data: Date): string {
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function TituloMetricas({
  titulo,
  nomeEstabelecimento,
  turnoDesde,
  wsStatus,
}: Props) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-texto">{titulo}</h1>
        <div className="flex items-center gap-1 text-[13px] text-texto-2">
          <span className="font-medium text-texto">{nomeEstabelecimento}</span>
          <span>·</span>
          <span>Turno desde {horaFormatada(turnoDesde)}</span>
          <span>·</span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${CLASSE_STATUS[wsStatus]}`}
          >
            {LABEL_STATUS[wsStatus]}
          </span>
        </div>
      </div>
    </div>
  );
}
