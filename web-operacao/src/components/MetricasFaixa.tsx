import { AlertTriangle, Armchair, CheckCircle2, ListChecks, Timer } from "lucide-react";
import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  solicitacoes: SolicitacaoOut[];
  mesas: Record<number, MesaOut>;
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

export function MetricasFaixa({ solicitacoes, mesas }: Props) {
  const finalizados = solicitacoes.filter((s) => s.status === "concluido" || s.status === "cancelado");

  const aceiteMedioSeg = media(
    solicitacoes
      .filter((s) => s.aceito_em)
      .map((s) => (new Date(s.aceito_em!).getTime() - new Date(s.criado_em).getTime()) / 1000)
  );

  const conclusaoMediaSeg = media(
    finalizados
      .filter((s) => s.concluido_em)
      .map((s) => (new Date(s.concluido_em!).getTime() - new Date(s.criado_em).getTime()) / 1000)
  );

  const urgentes = solicitacoes.filter((s) => s.urgente && s.status === "pendente").length;
  const mesasAbertas = Object.values(mesas).filter((m) => m.status === "aberta").length;

  const itens = [
    { rotulo: "Total", valor: String(solicitacoes.length), icone: ListChecks, destaque: false },
    { rotulo: "Aceite médio", valor: formatarDuracao(aceiteMedioSeg), icone: Timer, destaque: false },
    { rotulo: "Conclusão média", valor: formatarDuracao(conclusaoMediaSeg), icone: CheckCircle2, destaque: false },
    { rotulo: "Urgentes", valor: String(urgentes), icone: AlertTriangle, destaque: urgentes > 0 },
    { rotulo: "Mesas abertas", valor: String(mesasAbertas), icone: Armchair, destaque: false },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto py-4">
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className="min-w-[150px] shrink-0 rounded-xl border border-white/60 bg-white/95 px-4 py-3 max-md:min-w-[130px]"
        >
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <item.icone size={14} strokeWidth={1.75} />
            {item.rotulo}
          </div>
          <div className={`text-xl font-semibold ${item.destaque ? "text-red-600" : "text-gray-900"}`}>
            {item.valor}
          </div>
        </div>
      ))}
    </div>
  );
}
