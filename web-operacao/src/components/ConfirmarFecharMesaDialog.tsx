interface Props {
  mesaNumero: number;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmarFecharMesaDialog({ mesaNumero, onConfirmar, onCancelar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white p-6 shadow-xl">
        <p className="mb-4 text-lg">Fechar a Mesa {mesaNumero}?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100">
            Não
          </button>
          <button
            onClick={onConfirmar}
            className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}
