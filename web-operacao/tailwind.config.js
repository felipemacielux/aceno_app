/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        poppins: ["Poppins", "system-ui", "sans-serif"],
        display: ["Anton", "sans-serif"],
      },
      colors: {
        fundo: "#EEF4F1",
        borda: "#E3EBE8",
        trilho: "#E6EFEC",
        marca: { DEFAULT: "#13877D", escura: "#0E6B63" },
        destaque: { DEFAULT: "#F8D35E", hover: "#F2C93E", texto: "#3A3000" },
        texto: { DEFAULT: "#1D2433", 2: "#6B7280", 3: "#9AA1A9" },
        col: {
          pendente: "#F8DFCB",
          atendimento: "#C3E9F4",
          concluido: "#D3CCF6",
          rosa: "#F8D4EF",
        },
        ponto: {
          pendente: "#F0883E",
          atendimento: "#14A3A0",
          concluido: "#8B6CF0",
        },
        alerta: "#F59E0B",
        perigo: "#E5484D",
        login: {
          bg: "#FFE4CC",
          laranja: "#FF7802",
        },
      },
      boxShadow: {
        card: "0 24px 60px -12px rgb(19 135 125 / 0.18)",
      },
      keyframes: {
        "pulso-anel": {
          "0%,100%": { boxShadow: "0 0 0 0 rgb(229 72 77 / 0.45)" },
          "50%": { boxShadow: "0 0 0 5px rgb(229 72 77 / 0.45)" },
        },
      },
      animation: { "pulso-anel": "pulso-anel 1s ease-in-out infinite" },
    },
  },
  plugins: [],
};
