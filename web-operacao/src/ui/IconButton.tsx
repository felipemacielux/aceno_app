import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

export const iconButton = cva(
  "flex items-center justify-center rounded-full transition disabled:opacity-60",
  {
    variants: {
      ativo: {
        true: "bg-destaque text-destaque-texto",
        false: "text-texto-2",
      },
      tamanho: {
        sm: "h-9 w-9",
        md: "h-10 w-10",
        lg: "h-11 w-11",
      },
    },
    defaultVariants: { ativo: false, tamanho: "md" },
  }
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButton> {}

export function IconButton({ className, ativo, tamanho, ...props }: Props) {
  return <button className={`${iconButton({ ativo, tamanho })} ${className ?? ""}`} {...props} />;
}
