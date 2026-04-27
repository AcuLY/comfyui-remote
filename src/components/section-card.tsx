import type { ReactNode } from "react";

export function SectionCard({ title, subtitle, actions, children, className }: { title: ReactNode; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[var(--panel)] p-3.5 pl-0 shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:pl-3.5 lg:p-4${className ? ` ${className}` : ""}`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-zinc-400">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
