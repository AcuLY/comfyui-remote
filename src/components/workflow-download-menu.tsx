import { ChevronDown, Download } from "lucide-react";

type WorkflowDownloadMenuProps = {
  originalHref: string;
  debugHref: string;
  className?: string;
  buttonClassName?: string;
  label?: string;
};

export function WorkflowDownloadMenu({
  originalHref,
  debugHref,
  className,
  buttonClassName,
  label = "下载工作流",
}: WorkflowDownloadMenuProps) {
  const debugHrefWithVariant = debugHref.includes("?")
    ? `${debugHref}&variant=debug`
    : `${debugHref}?variant=debug`;

  return (
    <details className={`group relative inline-block text-left ${className ?? ""}`}>
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden ${buttonClassName ?? ""}`}
        aria-label={label}
      >
        <Download className="size-3.5" />
        <span>{label}</span>
        <ChevronDown className="size-3 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-xl shadow-black/30 backdrop-blur">
        <a
          href={originalHref}
          download
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Download className="size-3" />
          原始工作流
        </a>
        <a
          href={debugHrefWithVariant}
          download
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sky-200 transition hover:bg-sky-500/15 hover:text-sky-100"
        >
          <Download className="size-3" />
          调试工作流
        </a>
      </div>
    </details>
  );
}
