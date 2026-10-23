import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./auth";
import { Header } from "./components/Header";
import { Kanban } from "./components/Kanban";
import { MetricasFaixa } from "./components/MetricasFaixa";
import { LoginPage } from "./pages/LoginPage";
import { OperacaoPage } from "./pages/OperacaoPage";
import type { MesaOut, SolicitacaoOut } from "./types";

const MOCK_MESAS: Record<number, MesaOut> = {
  1: { id: 1, numero: 3, status: "aberta", aberta_em: new Date().toISOString() },
  2: { id: 2, numero: 7, status: "aberta", aberta_em: new Date().toISOString() },
  3: { id: 3, numero: 12, status: "aberta", aberta_em: new Date().toISOString() },
};
const MOCK_SOLICITACOES: SolicitacaoOut[] = [
  { id: 1, mesa_id: 1, tipo: "chamar_garcom", forma_pagamento: null, status: "pendente", urgente: false, criado_em: new Date(Date.now() - 20000).toISOString(), aceito_em: null, concluido_em: null },
  { id: 2, mesa_id: 2, tipo: "fechar_conta", forma_pagamento: "pix", status: "pendente", urgente: true, criado_em: new Date(Date.now() - 90000).toISOString(), aceito_em: null, concluido_em: null },
  { id: 3, mesa_id: 3, tipo: "chamar_garcom", forma_pagamento: null, status: "em_atendimento", urgente: false, criado_em: new Date(Date.now() - 60000).toISOString(), aceito_em: new Date().toISOString(), concluido_em: null },
  { id: 4, mesa_id: 1, tipo: "fechar_conta", forma_pagamento: "cartao", status: "concluido", urgente: false, criado_em: new Date(Date.now() - 300000).toISOString(), aceito_em: new Date().toISOString(), concluido_em: new Date().toISOString() },
];

function PreviewKanban() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-aceno-escuro via-aceno-medio to-aceno-claro">
      <Header wsStatus="conectado" busca="" onBuscaChange={() => {}} />
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 lg:px-6">
        <MetricasFaixa solicitacoes={MOCK_SOLICITACOES} mesas={MOCK_MESAS} />
        <Kanban solicitacoes={MOCK_SOLICITACOES} mesas={MOCK_MESAS} onAceitar={() => {}} onConcluir={() => {}} />
      </div>
      <footer className="border-t border-green-900/10 py-3 text-center text-xs text-green-900/70">
        Aceno 👋 · Painel da operação
      </footer>
    </div>
  );
}

function RotaProtegida({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/painel">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/preview" element={<PreviewKanban />} />
        <Route
          path="/"
          element={
            <RotaProtegida>
              <OperacaoPage />
            </RotaProtegida>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
