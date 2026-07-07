"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { PresetSaveStatus } from "./use-preset-save-queue";

export function PresetFormActionFooter({
  saveStatus,
  saveError,
  onRetry,
}: {
  saveStatus: PresetSaveStatus;
  saveError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 text-[11px]">
      <span className="shrink-0 text-zinc-500">自动保存</span>
      <div className="flex min-w-0 items-center gap-2">
        {saveStatus === "saving" && (
          <span className="inline-flex items-center gap-1.5 text-zinc-400">
            <Loader2 className="size-3 animate-spin" />
            保存中…
          </span>
        )}
        {saveStatus === "queued" && (
          <span className="inline-flex items-center gap-1.5 text-sky-300">
            <Loader2 className="size-3 animate-spin" />
            还有修改待保存
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="inline-flex items-center gap-1.5 text-emerald-400/80">
            <CheckCircle2 className="size-3" />
            已保存
          </span>
        )}
        {saveStatus === "error" && (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5 text-red-300">
              <AlertTriangle className="size-3 shrink-0" />
              <span className="truncate">{saveError ?? "保存失败"}</span>
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200 transition hover:bg-red-500/20"
            >
              重试
            </button>
          </>
        )}
      </div>
    </div>
  );
}
