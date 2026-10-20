import { desbloquearAudio } from "../sound";
import { pedirPermissaoNotificacao } from "../notificacoes";

interface Props {
  onIniciar: () => void;
}

export function IniciarTurnoOverlay({ onIniciar }: Props) {
  function handleClick() {
    desbloquearAudio();
    pedirPermissaoNotificacao();
    onIniciar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <button
        onClick={handleClick}
        className="rounded-lg bg-emerald-500 px-10 py-6 text-2xl font-bold text-white shadow-lg hover:bg-emerald-600"
      >
        Iniciar Turno
      </button>
    </div>
  );
}
