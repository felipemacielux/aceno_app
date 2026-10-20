import type { MesaOut, SolicitacaoOut } from "../types";
import { SolicitacaoCard } from "./SolicitacaoCard";

interface Props {
  solicitacoes: SolicitacaoOut[];
  mesas: Record<number, MesaOut>;
  onAceitar: (id: number) => void;
  onConcluir: (solicitacao: SolicitacaoOut) => void;
}

function Coluna({
  titulo,
  itens,
  mesas,
  onAceitar,
  onConcluir,
}: {
  titulo: string;
  itens: SolicitacaoOut[];
  mesas: Record<number, MesaOut>;
  onAceitar: (id: number) => void;
  onConcluir: (solicitacao: SolicitacaoOut) => void;
}) {
  return (
    <div className="flex-1 rounded-lg bg-slate-100 p-3">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
        {titulo}
        <span className="rounded-full bg-slate-300 px-2 text-xs">{itens.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {itens.map((s) => (
          <SolicitacaoCard
            key={s.id}
            solicitacao={s}
            mesa={mesas[s.mesa_id]}
            onAceitar={() => onAceitar(s.id)}
            onConcluir={() => onConcluir(s)}
          />
        ))}
      </div>
    </div>
  );
}

export function Kanban({ solicitacoes, mesas, onAceitar, onConcluir }: Props) {
  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const emAtendimento = solicitacoes.filter((s) => s.status === "em_atendimento");
  const concluidos = solicitacoes.filter((s) => s.status === "concluido");

  return (
    <div className="flex gap-4 p-4">
      <Coluna titulo="Pendentes" itens={pendentes} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
      <Coluna
        titulo="Em Atendimento"
        itens={emAtendimento}
        mesas={mesas}
        onAceitar={onAceitar}
        onConcluir={onConcluir}
      />
      <Coluna titulo="Concluídos" itens={concluidos} mesas={mesas} onAceitar={onAceitar} onConcluir={onConcluir} />
    </div>
  );
}
