/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aceno: {
          escuro: "#15803d",
          medio: "#22c55e",
          claro: "#dcfce7",
        },
      },
      keyframes: {
        "pulso-anel": {
          "0%, 100%": { boxShadow: "0 0 0 0 var(--anel-cor)" },
          "50%": { boxShadow: "0 0 0 4px var(--anel-cor)" },
        },
      },
      animation: {
        "pulso-anel": "pulso-anel 1.6s ease-in-out infinite",
        "pulso-anel-rapido": "pulso-anel 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
