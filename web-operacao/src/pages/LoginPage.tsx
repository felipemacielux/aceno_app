import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { salvarAuth } from "../auth";
import { desbloquearAudio } from "../sound";
import acenoIcon from "../assets/aceno-icon.png";
import acenoLogoFull from "../assets/aceno-logo-full.png";

function Campo({
  label,
  icon,
  ...props
}: { label: string; icon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-texto">{label}</span>
      <div className="relative">
        <input
          className="h-14 w-full rounded-xl border border-[#928F9D]/40 bg-white px-5 text-[15px] text-texto outline-none placeholder:text-texto-3 focus:border-login-laranja focus:ring-[4px] focus:ring-login-laranja/20"
          style={icon ? { paddingRight: 48 } : undefined}
          {...props}
        />
        {icon}
      </div>
    </label>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    desbloquearAudio();
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await login(username, senha);
      salvarAuth(resposta, username);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.erro === "credenciais_invalidas") {
        setErro("Usuário ou senha inválidos.");
        return;
      }
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFE4CC] bg-login-bg p-6">
      <div className="grid w-full max-w-[1180px] grid-cols-2 rounded-3xl bg-white p-14 shadow-card max-md:grid-cols-1">
        <div className="flex flex-col pr-14 max-md:pr-0">
          <img src={acenoIcon} alt="Aceno" className="h-20 w-20 rounded-2xl" />

          <form onSubmit={handleSubmit} className="mt-14 flex flex-col gap-7 max-w-[420px]">
            <Campo
              label="Usuário"
              placeholder="Digite seu usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <Campo
              label="Senha"
              type={mostrarSenha ? "text" : "password"}
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              icon={
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-texto-3"
                  tabIndex={-1}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              }
            />

            {erro && <p className="text-[14px] text-perigo">{erro}</p>}

            <button
              type="submit"
              disabled={carregando}
              className="mt-5 flex h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-[#FF7802] bg-login-laranja text-[17px] font-medium text-white transition hover:bg-[#FF7802]/90 hover:bg-login-laranja/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="relative hidden items-center justify-center rounded-2xl border-[6px] border-[#FF7802] border-login-laranja shadow-[0_0_40px_10px_rgba(255,120,2,0.35),inset_0_0_30px_rgba(255,120,2,0.2)] md:flex">
          <img src={acenoLogoFull} alt="Aceno — Seu pedido, no seu tempo." className="w-[70%]" />
        </div>
      </div>
    </div>
  );
}
