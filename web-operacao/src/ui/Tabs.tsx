import type { ReactNode } from "react";

interface Item<T extends string> {
  valor: T;
  label: string;
  icone?: ReactNode;
  contador?: number;
}

interface Props<T extends string> {
  itens: Item<T>[];
  ativo: T;
  onChange: (valor: T) => void;
}

export function Tabs<T extends string>({ itens, ativo, onChange }: Props<T>) {
  return (
    <div className="inline-flex bg-white rounded-full p-1 gap-1">
      {itens.map((item) => (
        <button
          key={item.valor}
          onClick={() => onChange(item.valor)}
          className={`h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 ${
            ativo === item.valor ? "bg-destaque text-destaque-texto" : "text-texto-2"
          }`}
        >
          {item.icone}
          {item.label}
          {!!item.contador && (
            <span className="rounded-full bg-perigo px-1.5 text-[11px] text-white">{item.contador}</span>
          )}
        </button>
      ))}
    </div>
  );
}
