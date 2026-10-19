import type { FormaPagamento } from "../types";

interface Props {
  aberto: boolean;
  onEscolher: (forma: FormaPagamento) => void;
  onClose: () => void;
}

const OPCOES: { valor: FormaPagamento; label: string }[] = [
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "cartao", label: "Cartão" },
  { valor: "pix", label: "Pix" },
];

export function ModalPagamento({ aberto, onEscolher, onClose }: Props) {
  if (!aberto) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Forma de pagamento</h2>
        {OPCOES.map((op) => (
          <button key={op.valor} onClick={() => onEscolher(op.valor)}>
            {op.label}
          </button>
        ))}
        <button onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
