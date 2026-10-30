interface Props {
  fracao: number; // 0..1
}

export function ProgressBar({ fracao }: Props) {
  const pct = Math.min(Math.max(fracao, 0), 1) * 100;
  const cor = pct >= 100 ? "bg-perigo" : pct >= 50 ? "bg-alerta" : "bg-marca";
  return (
    <div className="h-1.5 rounded-full bg-trilho">
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${cor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
