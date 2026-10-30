import type { HTMLAttributes } from "react";

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-full border border-borda px-2.5 text-[11px] text-texto-2 ${className ?? ""}`}
      {...props}
    />
  );
}
