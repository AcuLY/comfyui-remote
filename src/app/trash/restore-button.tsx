"use client";

import { RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { restoreImage } from "@/lib/actions";

export function RestoreButton({ trashRecordId }: { trashRecordId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => restoreImage(trashRecordId))}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
    >
      <RotateCcw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "恢复中…" : "恢复"}
    </button>
  );
}
