import { Armchair, LayoutGrid, LogOut, Volume2, VolumeX } from "lucide-react";
import { IconButton } from "../ui/IconButton";

export type Visao = "chamados" | "mesas";

interface Props {
  visao: Visao;
  onVisaoChange: (visao: Visao) => void;
  pendentes: number;
  silenciado: boolean;
  onToggleSilenciado: () => void;
  onSair: () => void;
}

export function Sidebar({ visao, onVisaoChange, pendentes, silenciado, onToggleSilenciado, onSair }: Props) {
  return (
    <>
      <div className="hidden md:flex w-[88px] shrink-0 flex-col items-center py-5 gap-6">
        <div className="relative h-11 w-11 rounded-xl bg-[#F4631E] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
            <path
              d="M7.5 12.5V9a1.3 1.3 0 0 1 2.6 0v2.2M10.1 11.2V7.6a1.3 1.3 0 0 1 2.6 0v3.6M12.7 11v-2a1.3 1.3 0 0 1 2.6 0v4.8c0 2.6-1.9 4.8-4.5 4.8h-1a4 4 0 0 1-3.2-1.6l-2-2.7a1.2 1.2 0 0 1 1.8-1.6l1.1 1"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16.3 8.3c.6.6 1 1.4 1 2.3M17.9 6.7a5.3 5.3 0 0 1 1.6 3.8"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-destaque" />
        </div>

        <div className="bg-white rounded-full p-1.5 flex flex-col gap-1.5">
          <div className="relative">
            <IconButton ativo={visao === "chamados"} onClick={() => onVisaoChange("chamados")} title="Chamados">
              <LayoutGrid size={18} strokeWidth={1.75} className={visao === "chamados" ? "" : "text-texto-2"} />
            </IconButton>
            {pendentes > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-perigo text-[10px] text-white">
                {pendentes}
              </span>
            )}
          </div>
          <IconButton ativo={visao === "mesas"} onClick={() => onVisaoChange("mesas")} title="Mesas">
            <Armchair size={18} strokeWidth={1.75} className={visao === "mesas" ? "" : "text-texto-2"} />
          </IconButton>
        </div>

        <div className="mt-auto bg-white rounded-full p-1.5 flex flex-col gap-1.5">
          <IconButton onClick={onToggleSilenciado} title={silenciado ? "Ativar som" : "Silenciar som"}>
            {silenciado ? (
              <VolumeX size={18} strokeWidth={1.75} className="text-texto-2" />
            ) : (
              <Volume2 size={18} strokeWidth={1.75} className="text-texto-2" />
            )}
          </IconButton>
          <IconButton onClick={onSair} title="Sair">
            <LogOut size={18} strokeWidth={1.75} className="text-texto-2" />
          </IconButton>
        </div>
      </div>

      <div className="md:hidden fixed bottom-3 inset-x-3 z-40 h-14 rounded-full bg-white flex justify-around items-center">
        <div className="relative">
          <IconButton ativo={visao === "chamados"} onClick={() => onVisaoChange("chamados")} title="Chamados">
            <LayoutGrid size={18} strokeWidth={1.75} className={visao === "chamados" ? "" : "text-texto-2"} />
          </IconButton>
          {pendentes > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-perigo text-[10px] text-white">
              {pendentes}
            </span>
          )}
        </div>
        <IconButton ativo={visao === "mesas"} onClick={() => onVisaoChange("mesas")} title="Mesas">
          <Armchair size={18} strokeWidth={1.75} className={visao === "mesas" ? "" : "text-texto-2"} />
        </IconButton>
        <IconButton onClick={onToggleSilenciado} title={silenciado ? "Ativar som" : "Silenciar som"}>
          {silenciado ? (
            <VolumeX size={18} strokeWidth={1.75} className="text-texto-2" />
          ) : (
            <Volume2 size={18} strokeWidth={1.75} className="text-texto-2" />
          )}
        </IconButton>
        <IconButton onClick={onSair} title="Sair">
          <LogOut size={18} strokeWidth={1.75} className="text-texto-2" />
        </IconButton>
      </div>
    </>
  );
}
