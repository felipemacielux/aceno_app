import { useState } from "react";
import { Tabs } from "../ui/Tabs";
import type { MesaOut, SolicitacaoOut } from "../types";
import { MesaCard } from "./MesaCard";

type Filtro = "todas" | "abertas" | "fechadas" | "com_chamado";

interface Props {
  mesas: MesaOut[];
  solicitacoes: SolicitacaoOut[];
  onAbrir: (mesaId: number) => void;
  onFechar: (mesa: MesaOut) => void;
}

export function MesasView({ mesas, solicitacoes, onAbrir, onFechar }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todas");

  function chamadosAtivosDe(mesaId: number): SolicitacaoOut[] {
    return solicitacoes.filter(
      (s) => s.mesa_id === mesaId && (s.status === "pendente" || s.status === "em_atendimento")
    );
  }

  const mesasOrdenadas = [...mesas].sort((a, b) => a.numero - b.numero);
  const mesasFiltradas = mesasOrdenadas.filter((m) => {
    if (filtro === "abertas") return m.status === "aberta";
    if (filtro === "fechadas") return m.status === "fechada";
    if (filtro === "com_chamado") return chamadosAtivosDe(m.id).length > 0;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        itens={[
          { valor: "todas", label: "Todas" },
          { valor: "abertas", label: "Abertas" },
          { valor: "fechadas", label: "Fechadas" },
          { valor: "com_chamado", label: "Com chamado" },
        ]}
        ativo={filtro}
        onChange={setFiltro}
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {mesasFiltradas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            chamadosAtivos={chamadosAtivosDe(mesa.id)}
            onAbrir={() => onAbrir(mesa.id)}
            onFechar={() => onFechar(mesa)}
          />
        ))}
      </div>
    </div>
  );
}
