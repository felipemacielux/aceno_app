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

const ICONE_TIPO: Record<SolicitacaoOut["tipo"], string> = {
  chamar_garcom: "🔔",
  fechar_conta: "💳",
};

const LABEL_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "Pix",
};

function corDeFundo(solicitacao: SolicitacaoOut): string {
  if (solicitacao.status === "concluido") return "bg-gray-200";
  if (solicitacao.status === "em_atendimento") return "bg-blue-100";
  if (solicitacao.urgente) return "bg-red-200 animate-pulse";
  return "bg-yellow-200 animate-pulse";
}

function segundosDecorridos(solicitacao: SolicitacaoOut, agora: number): number {
  const inicio = new Date(solicitacao.criado_em).getTime();
  const fim =
    solicitacao.status === "concluido" || solicitacao.status === "cancelado"
      ? new Date(solicitacao.concluido_em!).getTime()
      : agora;
  return Math.max(0, Math.floor((fim - inicio) / 1000));
}

export function SolicitacaoCard({ solicitacao, mesa, onAceitar, onConcluir }: Props) {
  const segundos = segundosDecorridos(solicitacao, Date.now());

  return (
    <div className={`rounded-md p-3 shadow ${corDeFundo(solicitacao)}`}>
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold">Mesa {mesa?.numero ?? solicitacao.mesa_id}</span>
        {solicitacao.urgente && solicitacao.status === "pendente" && (
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">URGENTE</span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span>{ICONE_TIPO[solicitacao.tipo]}</span>
        <span>{LABEL_TIPO[solicitacao.tipo]}</span>
        {solicitacao.forma_pagamento && <span>· {LABEL_FORMA[solicitacao.forma_pagamento]}</span>}
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {solicitacao.status === "concluido" ? `levou ${segundos}s` : `há ${segundos}s`}
      </div>
      {solicitacao.status === "pendente" && (
        <button
          onClick={onAceitar}
          className="mt-2 w-full rounded bg-emerald-600 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Aceitar
        </button>
      )}
      {solicitacao.status === "em_atendimento" && (
        <button
          onClick={onConcluir}
          className="mt-2 w-full rounded bg-blue-600 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Concluir
        </button>
      )}
    </div>
  );
}
