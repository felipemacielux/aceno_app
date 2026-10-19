import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, cancelarSolicitacao, chamarGarcom, fecharConta, getMesa } from "../api";
import { BannerReconexao } from "../components/BannerReconexao";
import { BotaoChamado } from "../components/BotaoChamado";
import { ModalPagamento } from "../components/ModalPagamento";
import { ModalWifi } from "../components/ModalWifi";
import { useMesaSocket } from "../ws";
import type { FormaPagamento, SolicitacaoOut } from "../types";

function ativaPorTipo(ativas: SolicitacaoOut[], tipo: SolicitacaoOut["tipo"]): SolicitacaoOut | undefined {
  return ativas.find((s) => s.tipo === tipo);
}

export function MesaPage() {
  const { token } = useParams<{ token: string }>();
  const { mesa, wsStatus } = useMesaSocket(token!);
  const [mesaFechadaDuranteUso, setMesaFechadaDuranteUso] = useState(false);
  const [modalWifiAberto, setModalWifiAberto] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [erroToast, setErroToast] = useState<string | null>(null);
  const [mostrarConectado, setMostrarConectado] = useState(false);
  const [tokenInvalido, setTokenInvalido] = useState(false);

  useEffect(() => {
    getMesa(token!).catch((erro) => {
      if (erro instanceof ApiError && erro.erro === "mesa_nao_encontrada") {
        setTokenInvalido(true);
      }
    });
  }, [token]);

  useEffect(() => {
    if (wsStatus === "conectado") {
      setMostrarConectado(true);
      const t = setTimeout(() => setMostrarConectado(false), 2000);
      return () => clearTimeout(t);
    }
  }, [wsStatus]);

  useEffect(() => {
    if (mesa?.status === "fechada") setMesaFechadaDuranteUso(true);
    if (mesa?.status === "aberta") setMesaFechadaDuranteUso(false);
  }, [mesa?.status]);

  if (tokenInvalido) return <div>QR Code inválido. Chame um garçom.</div>;
  if (!mesa) return <div>Carregando...</div>;

  const bannerStatus = mostrarConectado ? "conectado" : wsStatus;

  async function tratarErro(erro: unknown) {
    if (erro instanceof ApiError) {
      if (erro.erro === "mesa_fechada") {
        setMesaFechadaDuranteUso(true);
        return;
      }
      if (erro.erro === "cancelamento_invalido") {
        setErroToast("Chamado já foi aceito");
        return;
      }
    }
  }

  async function handleChamarGarcom() {
    try {
      await chamarGarcom(token!);
    } catch (erro) {
      await tratarErro(erro);
    }
  }

  async function handleEscolherPagamento(forma: FormaPagamento) {
    setModalPagamentoAberto(false);
    try {
      await fecharConta(token!, forma);
    } catch (erro) {
      await tratarErro(erro);
    }
  }

  async function handleCancelar(id: number) {
    try {
      await cancelarSolicitacao(token!, id);
    } catch (erro) {
      await tratarErro(erro);
    }
  }

  if (mesaFechadaDuranteUso || mesa.status === "fechada") {
    return (
      <div>
        <BannerReconexao status={bannerStatus} />
        <h1>Mesa {mesa.numero}</h1>
        <p>
          {mesaFechadaDuranteUso
            ? "Obrigado pela visita!"
            : "Esta mesa ainda não foi liberada. Peça a um garçom para liberar o atendimento pelo celular."}
        </p>
        <button onClick={() => setModalWifiAberto(true)}>Wi-Fi</button>
        <a href={mesa.cardapio_url}>Cardápio</a>
        <ModalWifi
          ssid={mesa.wifi_ssid}
          senha={mesa.wifi_senha}
          aberto={modalWifiAberto}
          onClose={() => setModalWifiAberto(false)}
        />
      </div>
    );
  }

  const chamarAtiva = ativaPorTipo(mesa.solicitacoes_ativas, "chamar_garcom");
  const fecharAtiva = ativaPorTipo(mesa.solicitacoes_ativas, "fechar_conta");

  return (
    <div>
      <BannerReconexao status={bannerStatus} />
      <h1>Mesa {mesa.numero}</h1>
      {erroToast && <div className="toast">{erroToast}</div>}

      {chamarAtiva === undefined && (
        <BotaoChamado label="Chamar Garçom" tipo="chamar_garcom" mesa={mesa} onClick={handleChamarGarcom} />
      )}
      {chamarAtiva?.status === "pendente" && (
        <div>
          <p>Solicitação enviada! Um garçom já vai até você.</p>
          <button onClick={() => handleCancelar(chamarAtiva.id)}>Cancelar</button>
        </div>
      )}
      {chamarAtiva?.status === "em_atendimento" && <p>Garçom a caminho!</p>}

      {fecharAtiva === undefined && (
        <BotaoChamado
          label="Fechar Conta"
          tipo="fechar_conta"
          mesa={mesa}
          onClick={() => setModalPagamentoAberto(true)}
        />
      )}
      {fecharAtiva?.status === "pendente" && (
        <div>
          <p>Solicitação enviada! Um garçom já vai até você.</p>
          <button onClick={() => handleCancelar(fecharAtiva.id)}>Cancelar</button>
        </div>
      )}
      {fecharAtiva?.status === "em_atendimento" && <p>Garçom a caminho!</p>}

      <button onClick={() => setModalWifiAberto(true)}>Wi-Fi</button>
      <a href={mesa.cardapio_url}>Cardápio</a>

      <ModalPagamento
        aberto={modalPagamentoAberto}
        onEscolher={handleEscolherPagamento}
        onClose={() => setModalPagamentoAberto(false)}
      />
      <ModalWifi
        ssid={mesa.wifi_ssid}
        senha={mesa.wifi_senha}
        aberto={modalWifiAberto}
        onClose={() => setModalWifiAberto(false)}
      />
    </div>
  );
}
