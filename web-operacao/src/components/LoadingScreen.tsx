import { useEffect } from "react";
import { pedirPermissaoNotificacao } from "../notificacoes";
import acenoIcon from "../assets/aceno-icon.png";

interface Props {
  onPronto: () => void;
}

export function LoadingScreen({ onPronto }: Props) {
  useEffect(() => {
    pedirPermissaoNotificacao();
    const id = setTimeout(onPronto, 1200);
    return () => clearTimeout(id);
  }, [onPronto]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-login-bg">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-login-laranja/20 border-t-login-laranja" />
        <img src={acenoIcon} alt="Aceno" className="h-20 w-20 rounded-2xl" />
      </div>
    </div>
  );
}
