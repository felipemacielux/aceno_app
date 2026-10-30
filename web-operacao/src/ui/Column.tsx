import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

export const column = cva("rounded-3xl p-3.5 flex flex-col gap-2.5", {
  variants: {
    cor: {
      pendente: "bg-col-pendente",
      atendimento: "bg-col-atendimento",
      concluido: "bg-col-concluido",
      rosa: "bg-col-rosa",
    },
  },
});

interface Props extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof column> {}

export function Column({ className, cor, ...props }: Props) {
  return <div className={`${column({ cor })} ${className ?? ""}`} {...props} />;
}
