import { Bell, Receipt } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { MesaOut, SolicitacaoOut } from "../types";

interface Props {
  mesa: MesaOut;
  chamadosAtivos: SolicitacaoOut[];
  onAbrir: () => void;
  onFechar: () => void;
}

function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function MesaCard({ mesa, chamadosAtivos, onAbrir, onFechar }: Props) {
  const [carregando, setCarregando] = useState(false);
  const temUrgente = chamadosAtivos.some((s) => s.urgente);
  const temChamado = chamadosAtivos.length > 0;

  function executar(acao: () => void) {
    setCarregando(true);
    acao();
  }

  const fundo = mesa.status === "fechada" ? "bg-white/60" : temUrgente ? "bg-col-rosa" : temChamado ? "bg-col-pendente" : "bg-white";

  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-3 ${fundo} ${temUrgente ? "motion-safe:animate-pulso-anel" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-texto">Mesa {mesa.numero}</span>
        {mesa.status === "fechada" ? (
          <Badge variante="neutro">Fechada</Badge>
        ) : (
          <Badge variante="ok">Aberta</Badge>
        )}
      </div>

      <div className="text-[13px] text-texto-3">
        {mesa.status === "aberta" && mesa.aberta_em
          ? `Aberta há ${formatarDuracao(Math.max(0, Math.floor((Date.now() - new Date(mesa.aberta_em).getTime()) / 1000)))}`
          : "Fechada"}
      </div>

      {temChamado && (
        <div className="flex gap-1.5">
          {chamadosAtivos.map((s) => {
            const Icone = s.tipo === "chamar_garcom" ? Bell : Receipt;
            return (
              <span key={s.id} className="h-7 w-7 flex items-center justify-center rounded-full bg-white">
                <Icone size={14} strokeWidth={1.75} className="text-texto-2" />
              </span>
            );
          })}
        </div>
      )}

      {mesa.status === "fechada" ? (
        <Button variante="primary" className="w-full" carregando={carregando} onClick={() => executar(onAbrir)}>
          Abrir
        </Button>
      ) : (
        <Button variante="secondary" className="w-full" carregando={carregando} onClick={() => executar(onFechar)}>
          Fechar
        </Button>
      )}
    </div>
  );
}
