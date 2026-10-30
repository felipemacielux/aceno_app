import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

export const pill = cva("inline-flex items-center rounded-full", {
  variants: {
    tom: {
      branco: "bg-white",
      transparente: "",
    },
  },
  defaultVariants: { tom: "branco" },
});

interface Props extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof pill> {}

export function Pill({ className, tom, ...props }: Props) {
  return <div className={`${pill({ tom })} ${className ?? ""}`} {...props} />;
}
