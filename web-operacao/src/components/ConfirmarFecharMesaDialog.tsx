import { Button } from "../ui/Button";

interface Props {
  mensagem: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmarFecharMesaDialog({ mensagem, onConfirmar, onCancelar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <p className="mb-4 text-lg text-texto">{mensagem}</p>
        <div className="flex justify-end gap-2">
          <Button variante="secondary" onClick={onCancelar}>
            Não
          </Button>
          <Button variante="brand" onClick={onConfirmar}>
            Sim
          </Button>
        </div>
      </div>
    </div>
  );
}
