export function StatChip({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "accent" | "warn" }) {
  const toneClass = {
    default: "border-white/10 bg-white/5 text-zinc-300",
    accent: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
