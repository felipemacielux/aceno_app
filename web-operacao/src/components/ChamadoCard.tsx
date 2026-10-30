import { AlertTriangle, Banknote, Bell, Clock, CreditCard, QrCode, Receipt } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { ProgressBar } from "../ui/ProgressBar";
import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  solicitacao: SolicitacaoOut;
  mesa: MesaOut | undefined;
  onAceitar: () => void;
  onConcluir: () => void;
}

const CFG_URGENTE_SEG = 60;

const LABEL_TIPO: Record<SolicitacaoOut["tipo"], string> = {
  chamar_garcom: "Chamar Garçom",
  fechar_conta: "Fechar Conta",
};

const ICONE_TIPO: Record<SolicitacaoOut["tipo"], typeof Bell> = {
  chamar_garcom: Bell,
  fechar_conta: Receipt,
};

const BADGE_TIPO: Record<SolicitacaoOut["tipo"], "garcom" | "conta"> = {
  chamar_garcom: "garcom",
  fechar_conta: "conta",
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

export function ChamadoCard({ solicitacao, mesa, onAceitar, onConcluir }: Props) {
  const [carregando, setCarregando] = useState(false);
  const segundos = segundosDecorridos(solicitacao, Date.now());
  const IconeTipo = ICONE_TIPO[solicitacao.tipo];
  const IconeForma = solicitacao.forma_pagamento ? ICONE_FORMA[solicitacao.forma_pagamento] : null;
  const pendente = solicitacao.status === "pendente";
  const emAtendimento = solicitacao.status === "em_atendimento";
  const finalizado = solicitacao.status === "concluido" || solicitacao.status === "cancelado";
  const urgente = pendente && solicitacao.urgente;

  function executar(acao: () => void) {
    setCarregando(true);
    acao();
  }

  let detalhe: string | null = null;
  if (solicitacao.forma_pagamento) detalhe = `Pagamento: ${LABEL_FORMA[solicitacao.forma_pagamento]}`;
  else if (emAtendimento) detalhe = `Aceito há ${formatarTempo(segundosDecorridos({ ...solicitacao, criado_em: solicitacao.aceito_em ?? solicitacao.criado_em }, Date.now()))}`;

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl bg-white p-4 transition shadow-[0_1px_2px_rgb(16_24_40/0.04)] hover:shadow-[0_4px_12px_rgb(16_24_40/0.06)] ${
        finalizado ? "opacity-75" : ""
      } ${urgente ? "motion-safe:animate-pulso-anel" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <Badge variante={BADGE_TIPO[solicitacao.tipo]}>{LABEL_TIPO[solicitacao.tipo]}</Badge>
        {urgente && (
          <Badge variante="urgente">
            <AlertTriangle size={12} />
            Urgente
          </Badge>
        )}
        {solicitacao.status === "cancelado" && <Badge variante="neutro">Cancelado</Badge>}
      </div>

      <div className="text-[15px] font-semibold text-texto">Mesa {mesa?.numero ?? solicitacao.mesa_id}</div>

      {detalhe && (
        <div className="flex items-center gap-1.5 text-[13px] text-texto-3">
          {solicitacao.forma_pagamento && IconeForma && <IconeForma size={14} strokeWidth={1.75} />}
          {detalhe}
        </div>
      )}
      {!detalhe && !emAtendimento && (
        <div className="flex items-center gap-1.5 text-[13px] text-texto-3">
          <IconeTipo size={14} strokeWidth={1.75} />
        </div>
      )}

      {pendente && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-texto-3">
            <span>Tempo de espera</span>
            <span>
              {segundos}s / {CFG_URGENTE_SEG}s
            </span>
          </div>
          <ProgressBar fracao={segundos / CFG_URGENTE_SEG} />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Chip>
          <Clock size={12} strokeWidth={1.75} />
          {finalizado ? `levou ${formatarTempo(segundos)}` : `há ${formatarTempo(segundos)}`}
        </Chip>
        {pendente && (
          <Button variante="primary" tamanho="sm" carregando={carregando} onClick={() => executar(onAceitar)}>
            Aceitar
          </Button>
        )}
        {emAtendimento && (
          <Button variante="brand" tamanho="sm" carregando={carregando} onClick={() => executar(onConcluir)}>
            Concluir
          </Button>
        )}
      </div>
    </div>
  );
}
