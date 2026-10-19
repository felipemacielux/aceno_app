interface Props {
  ssid: string;
  senha: string;
  aberto: boolean;
  onClose: () => void;
}

export function ModalWifi({ ssid, senha, aberto, onClose }: Props) {
  if (!aberto) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Wi-Fi</h2>
        <p>Rede: {ssid}</p>
        <p>
          Senha: {senha}{" "}
          <button onClick={() => navigator.clipboard.writeText(senha)}>Copiar</button>
        </p>
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
