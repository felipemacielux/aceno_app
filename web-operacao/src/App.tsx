import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./auth";
import { LoginPage } from "./pages/LoginPage";
import { OperacaoPage } from "./pages/OperacaoPage";

function RotaProtegida({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/painel">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
