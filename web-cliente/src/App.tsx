import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MesaPage } from "./pages/MesaPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/m/:token" element={<MesaPage />} />
        <Route path="*" element={<div>QR Code inválido. Chame um garçom.</div>} />
      </Routes>
    </BrowserRouter>
  );
}
