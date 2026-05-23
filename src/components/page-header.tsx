import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-lg font-semibold text-white">{title}</h1>
        {description ? <p className="mt-1 break-words text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
