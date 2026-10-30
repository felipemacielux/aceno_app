import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-60",
  {
    variants: {
      variante: {
        primary: "bg-destaque text-destaque-texto hover:bg-destaque-hover",
        brand: "bg-marca text-white hover:bg-marca-escura",
        secondary: "bg-white text-texto border border-borda hover:bg-fundo",
      },
      tamanho: {
        sm: "h-8 px-4 text-sm",
        md: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variante: "primary", tamanho: "md" },
  }
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  carregando?: boolean;
}

export function Button({ className, variante, tamanho, carregando, children, ...props }: Props) {
  return (
    <button className={`${button({ variante, tamanho })} ${className ?? ""}`} disabled={carregando || props.disabled} {...props}>
      {carregando && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
