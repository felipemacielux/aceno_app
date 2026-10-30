import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CheckCircle2, Clock3, Inbox, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Column } from "../ui/Column";
import type { MesaOut, SolicitacaoOut } from "../types";
import { ChamadoCard } from "./ChamadoCard";

export type Ordenacao = "mais_antigos" | "numero_mesa";

interface Props {
  solicitacoes: SolicitacaoOut[];
  mesas: Record<number, MesaOut>;
  ordenacao: Ordenacao;
  onAceitar: (id: number) => void;
  onConcluir: (solicitacao: SolicitacaoOut) => void;
}

interface ColunaDef {
  chave: "pendentes" | "em_atendimento" | "concluidos";
  titulo: string;
  cor: "pendente" | "atendimento" | "concluido";
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
  const [listRef] = useAutoAnimate();
  return (
    <Column cor={def.cor}>
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-2">
        <span className={`h-1.5 w-1.5 rounded-full ${def.corPonto}`} />
        <span className="text-sm font-semibold text-texto">{def.titulo}</span>
        <span className="text-sm text-texto-2">{def.itens.length}</span>
      </div>
      <div
        ref={listRef}
        className={`flex flex-col gap-2.5 ${def.chave === "concluidos" ? "max-h-[70vh] overflow-y-auto" : ""}`}
      >
        {def.itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/70 py-8 text-center text-sm text-texto-2">
            <IconeVazio size={20} strokeWidth={1.75} />
            {def.vazio}
          </div>
        ) : (
          def.itens.slice(0, def.chave === "concluidos" ? 20 : undefined).map((s) => (
            <ChamadoCard
              key={s.id}
              solicitacao={s}
              mesa={mesas[s.mesa_id]}
              onAceitar={() => onAceitar(s.id)}
              onConcluir={() => onConcluir(s)}
            />
          ))
        )}
      </div>
    </Column>
  );
}

function ordenar(itens: SolicitacaoOut[], ordenacao: Ordenacao, mesas: Record<number, MesaOut>): SolicitacaoOut[] {
  return [...itens].sort((a, b) => {
    if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
    if (ordenacao === "numero_mesa") {
      return (mesas[a.mesa_id]?.numero ?? a.mesa_id) - (mesas[b.mesa_id]?.numero ?? b.mesa_id);
    }
    return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
  });
}

export function Kanban({ solicitacoes, mesas, ordenacao, onAceitar, onConcluir }: Props) {
  const [abaMobile, setAbaMobile] = useState<ColunaDef["chave"]>("pendentes");

  const pendentes = ordenar(solicitacoes.filter((s) => s.status === "pendente"), ordenacao, mesas);
  const emAtendimento = ordenar(solicitacoes.filter((s) => s.status === "em_atendimento"), ordenacao, mesas);
  const concluidos = solicitacoes
    .filter((s) => s.status === "concluido" || s.status === "cancelado")
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const colunas: ColunaDef[] = [
    {
      chave: "pendentes",
      titulo: "Pendentes",
      cor: "pendente",
      corPonto: "bg-ponto-pendente",
      itens: pendentes,
      vazio: "Nenhum chamado pendente",
      iconeVazio: Inbox,
    },
    {
      chave: "em_atendimento",
      titulo: "Em Atendimento",
      cor: "atendimento",
      corPonto: "bg-ponto-atendimento",
      itens: emAtendimento,
      vazio: "Ninguém em atendimento",
      iconeVazio: Clock3,
    },
    {
      chave: "concluidos",
      titulo: "Concluídos",
      cor: "concluido",
      corPonto: "bg-ponto-concluido",
      itens: concluidos,
      vazio: "Nada concluído ainda",
      iconeVazio: CheckCircle2,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-white p-4">
      <div className="flex gap-1 rounded-full bg-fundo p-1 md:hidden">
        {colunas.map((c) => (
          <button
            key={c.chave}
            onClick={() => setAbaMobile(c.chave)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium ${
              abaMobile === c.chave ? "bg-destaque text-destaque-texto" : "text-texto-2"
            }`}
          >
            {c.titulo}
            {c.chave === "pendentes" && c.itens.length > 0 && (
              <span className="rounded-full bg-perigo px-1.5 text-[11px] text-white">{c.itens.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="hidden grid-cols-3 gap-3.5 items-start md:grid">
        {colunas.map((c) => (
          <Coluna key={c.chave} def={c} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
        ))}
      </div>

      <div className="md:hidden">
        {colunas
          .filter((c) => c.chave === abaMobile)
          .map((c) => (
            <Coluna key={c.chave} def={c} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
          ))}
      </div>
    </div>
  );
}
