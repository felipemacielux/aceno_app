import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { salvarAuth } from "../auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const resposta = await login(username, senha);
      salvarAuth(resposta);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.erro === "credenciais_invalidas") {
        setErro("Usuário ou senha inválidos.");
        return;
      }
      setErro("Não foi possível entrar. Tente novamente.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold">Entrar</h1>
        <input
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="mb-2 w-full rounded border px-3 py-2"
          placeholder="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
        <button type="submit" className="w-full rounded bg-emerald-600 py-2 font-semibold text-white">
          Entrar
        </button>
      </form>
    </div>
  );
}
