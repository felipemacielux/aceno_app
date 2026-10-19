import type { ClienteState } from "../reducer";

export function BannerReconexao({ status }: { status: ClienteState["wsStatus"] }) {
  if (status === "conectando") return null;
  if (status === "reconectando") return <div className="banner banner-reconectando">Reconectando...</div>;
  return <div className="banner banner-conectado">Conectado</div>;
}
