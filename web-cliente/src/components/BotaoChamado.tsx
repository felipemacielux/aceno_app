import { useEffect, useState } from "react";
import { segundosRestantes } from "../reducer";
import type { MesaClienteOut, TipoSolicitacao } from "../types";

interface Props {
  label: string;
  tipo: TipoSolicitacao;
  mesa: MesaClienteOut;
  onClick: () => void;
}

export function BotaoChamado({ label, tipo, mesa, onClick }: Props) {
  const [restante, setRestante] = useState(() => segundosRestantes(mesa, tipo, Date.now()));

  useEffect(() => {
    setRestante(segundosRestantes(mesa, tipo, Date.now()));
    const interval = setInterval(() => {
      setRestante(segundosRestantes(mesa, tipo, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [mesa, tipo]);

  if (restante > 0) {
    return <button disabled>Disponível em {restante}s</button>;
  }
  return <button onClick={onClick}>{label}</button>;
}
