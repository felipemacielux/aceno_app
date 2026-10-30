import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

export const badge = cva("inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium", {
  variants: {
    variante: {
      garcom: "bg-[#E1F3EE] text-[#1E7E6B]",
      conta: "bg-[#F7F2D4] text-[#7A6A12]",
      urgente: "bg-[#FCE6E1] text-[#B2412B]",
      ok: "bg-[#CFEFF4] text-[#1B7C90]",
      neutro: "bg-[#EEF0F2] text-texto-2",
    },
  },
});

interface Props extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, variante, ...props }: Props) {
  return <span className={`${badge({ variante })} ${className ?? ""}`} {...props} />;
}
