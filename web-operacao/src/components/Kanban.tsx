import { CheckCircle2, Clock3, Inbox, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { MesaOut, SolicitacaoOut } from "../types";
import { SolicitacaoCard } from "./SolicitacaoCard";

interface Props {
  solicitacoes: SolicitacaoOut[];
  mesas: Record<number, MesaOut>;
  onAceitar: (id: number) => void;
  onConcluir: (solicitacao: SolicitacaoOut) => void;
}

interface ColunaDef {
  chave: "pendentes" | "em_atendimento" | "concluidos";
  titulo: string;
  corPonto: string;
  itens: SolicitacaoOut[];
  vazio: string;
  iconeVazio: LucideIcon;
}

function Coluna({
  def,
  mesas,
  onAceitar,
  onConcluir,
}: {
  def: ColunaDef;
  mesas: Record<number, MesaOut>;
  onAceitar: (id: number) => void;
  onConcluir: (solicitacao: SolicitacaoOut) => void;
}) {
  const IconeVazio = def.iconeVazio;
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white/95 shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className={`h-2 w-2 rounded-full ${def.corPonto}`} />
        <span className="text-sm font-semibold text-gray-900">{def.titulo}</span>
        <span className="rounded-md bg-gray-100 px-1.5 text-xs font-medium text-gray-600">{def.itens.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {def.itens.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <IconeVazio size={20} strokeWidth={1.75} />
            {def.vazio}
          </div>
        ) : (
          def.itens.map((s) => (
            <SolicitacaoCard
              key={s.id}
              solicitacao={s}
              mesa={mesas[s.mesa_id]}
              onAceitar={() => onAceitar(s.id)}
              onConcluir={() => onConcluir(s)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ordenarPendentes(itens: SolicitacaoOut[]): SolicitacaoOut[] {
  return [...itens].sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
    return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
  });
}

export function Kanban({ solicitacoes, mesas, onAceitar, onConcluir }: Props) {
  const [abaMobile, setAbaMobile] = useState<ColunaDef["chave"]>("pendentes");

  const pendentes = ordenarPendentes(solicitacoes.filter((s) => s.status === "pendente"));
  const emAtendimento = solicitacoes
    .filter((s) => s.status === "em_atendimento")
    .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
  const concluidos = solicitacoes
    .filter((s) => s.status === "concluido" || s.status === "cancelado")
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const colunas: ColunaDef[] = [
    {
      chave: "pendentes",
      titulo: "Pendentes",
      corPonto: "bg-amber-500",
      itens: pendentes,
      vazio: "Nenhum chamado pendente",
      iconeVazio: Inbox,
    },
    {
      chave: "em_atendimento",
      titulo: "Em Atendimento",
      corPonto: "bg-blue-500",
      itens: emAtendimento,
      vazio: "Ninguém em atendimento",
      iconeVazio: Clock3,
    },
    {
      chave: "concluidos",
      titulo: "Concluídos",
      corPonto: "bg-gray-400",
      itens: concluidos,
      vazio: "Nada concluído ainda",
      iconeVazio: CheckCircle2,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 pb-4">
      <div className="flex gap-1 rounded-lg bg-white/15 p-1 md:hidden">
        {colunas.map((c) => (
          <button
            key={c.chave}
            onClick={() => setAbaMobile(c.chave)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
              abaMobile === c.chave ? "bg-white text-gray-900 shadow-sm" : "text-white/90"
            }`}
          >
            {c.titulo}
            {c.chave === "pendentes" && c.itens.length > 0 && (
              <span className="rounded-md bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                {c.itens.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="hidden flex-1 grid-cols-3 gap-4 md:grid">
        {colunas.map((c) => (
          <Coluna key={c.chave} def={c} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
        ))}
      </div>

      <div className="flex-1 md:hidden">
        {colunas
          .filter((c) => c.chave === abaMobile)
          .map((c) => (
            <Coluna key={c.chave} def={c} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
          ))}
      </div>
    </div>
  );
}
