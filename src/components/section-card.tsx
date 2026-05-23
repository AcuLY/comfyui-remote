import type { ReactNode } from "react";

export function SectionCard({ id, title, subtitle, actions, children, className }: { id?: string; title: ReactNode; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`w-full min-w-0 scroll-mt-20${className ? ` ${className}` : ""}`}>
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 break-words text-xs text-zinc-400">{subtitle}</p> : null}
        </div>
        {actions ? <div className="w-full min-w-0 sm:w-auto">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
