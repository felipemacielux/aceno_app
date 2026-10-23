import { AlertTriangle, Banknote, Bell, Clock, CreditCard, Loader2, QrCode, Receipt } from "lucide-react";
import { useState } from "react";
import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  solicitacao: SolicitacaoOut;
  mesa: MesaOut | undefined;
  onAceitar: () => void;
  onConcluir: () => void;
}

const LABEL_TIPO: Record<SolicitacaoOut["tipo"], string> = {
  chamar_garcom: "Chamar Garçom",
  fechar_conta: "Fechar Conta",
};

const ICONE_TIPO: Record<SolicitacaoOut["tipo"], typeof Bell> = {
  chamar_garcom: Bell,
  fechar_conta: Receipt,
};

const LABEL_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
};

const ICONE_FORMA: Record<string, typeof Banknote> = {
  dinheiro: Banknote,
  cartao: CreditCard,
  pix: QrCode,
};

interface Estilo {
  texto: string;
  badge: string;
  bordaLateral: string;
  animacao: string;
  anelCor?: string;
  icone?: typeof AlertTriangle;
}

function estiloStatus(solicitacao: SolicitacaoOut): Estilo {
  if (solicitacao.status === "concluido") {
    return {
      texto: "CONCLUÍDO",
      badge: "bg-gray-50 border-gray-200 text-gray-600",
      bordaLateral: "border-l-gray-300",
      animacao: "",
    };
  }
  if (solicitacao.status === "cancelado") {
    return {
      texto: "CANCELADO",
      badge: "bg-gray-50 border-gray-200 text-gray-600",
      bordaLateral: "border-l-gray-300",
      animacao: "",
    };
  }
  if (solicitacao.status === "em_atendimento") {
    return {
      texto: "EM ATENDIMENTO",
      badge: "bg-blue-50 border-blue-200 text-blue-700",
      bordaLateral: "border-l-blue-500",
      animacao: "",
    };
  }
  if (solicitacao.urgente) {
    return {
      texto: "URGENTE",
      badge: "bg-red-50 border-red-200 text-red-700",
      bordaLateral: "border-l-red-500",
      animacao: "motion-safe:animate-pulso-anel-rapido",
      anelCor: "rgb(239 68 68 / .5)",
      icone: AlertTriangle,
    };
  }
  return {
    texto: "PENDENTE",
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    bordaLateral: "border-l-amber-400",
    animacao: "motion-safe:animate-pulso-anel",
    anelCor: "rgb(251 191 36 / .45)",
  };
}

function segundosDecorridos(solicitacao: SolicitacaoOut, agora: number): number {
  const inicio = new Date(solicitacao.criado_em).getTime();
  const fim =
    solicitacao.status === "concluido" || solicitacao.status === "cancelado"
      ? new Date(solicitacao.concluido_em!).getTime()
      : agora;
  return Math.max(0, Math.floor((fim - inicio) / 1000));
}

function formatarTempo(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg > 0 ? `${min}m ${seg}s` : `${min}m`;
}

export function SolicitacaoCard({ solicitacao, mesa, onAceitar, onConcluir }: Props) {
  const [carregando, setCarregando] = useState(false);
  const segundos = segundosDecorridos(solicitacao, Date.now());
  const estilo = estiloStatus(solicitacao);
  const IconeTipo = ICONE_TIPO[solicitacao.tipo];
  const IconeBadge = estilo.icone;
  const IconeForma = solicitacao.forma_pagamento ? ICONE_FORMA[solicitacao.forma_pagamento] : null;
  const mostrarRodape = solicitacao.status === "pendente" || solicitacao.status === "em_atendimento";

  function executar(acao: () => void) {
    setCarregando(true);
    acao();
  }

  return (
    <div
      style={estilo.anelCor ? ({ "--anel-cor": estilo.anelCor } as React.CSSProperties) : undefined}
      className={`flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 hover:shadow-md border-l-4 ${estilo.bordaLateral} ${estilo.animacao} ${
        solicitacao.status === "concluido" || solicitacao.status === "cancelado" ? "opacity-80" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${estilo.badge}`}
        >
          {IconeBadge && <IconeBadge size={12} strokeWidth={2} />}
          {estilo.texto}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Clock size={14} strokeWidth={1.75} />
          {solicitacao.status === "concluido" ? `levou ${formatarTempo(segundos)}` : `há ${formatarTempo(segundos)}`}
        </span>
      </div>
      <div className="text-lg font-semibold text-gray-900">Mesa {mesa?.numero ?? solicitacao.mesa_id}</div>
      <div className="flex items-center gap-1.5 text-sm text-gray-600">
        <IconeTipo size={16} strokeWidth={1.75} />
        {LABEL_TIPO[solicitacao.tipo]}
      </div>
      {solicitacao.forma_pagamento && IconeForma && (
        <div>
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            <IconeForma size={12} strokeWidth={1.75} />
            {LABEL_FORMA[solicitacao.forma_pagamento]}
          </span>
        </div>
      )}
      {mostrarRodape && (
        <div className="border-t border-gray-100 pt-3">
          {solicitacao.status === "pendente" && (
            <button
              onClick={() => executar(onAceitar)}
              disabled={carregando}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 active:scale-[0.99] disabled:opacity-60 md:h-9 max-md:h-11"
            >
              {carregando && <Loader2 size={14} className="animate-spin" />}
              Aceitar
            </button>
          )}
          {solicitacao.status === "em_atendimento" && (
            <button
              onClick={() => executar(onConcluir)}
              disabled={carregando}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 active:scale-[0.99] disabled:opacity-60 md:h-9 max-md:h-11"
            >
              {carregando && <Loader2 size={14} className="animate-spin" />}
              Concluir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
