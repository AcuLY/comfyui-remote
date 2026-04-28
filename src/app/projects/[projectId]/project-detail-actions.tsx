"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Play } from "lucide-react";
import { runSection } from "@/lib/actions";
import { toast } from "sonner";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

export function SectionRunButton({
  projectId,
  sectionId,
  defaultBatchSize,
  showBatchOverride = true,
}: {
  projectId?: string;
  sectionId: string;
  defaultBatchSize?: number | null;
  showBatchOverride?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<string>(defaultBatchSize?.toString() ?? "2");
  const [isSavingBatchSize, setIsSavingBatchSize] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedBatchSize = batchSize.trim() ? parseInt(batchSize, 10) : null;
  const canSaveBatchSize =
    Boolean(projectId) &&
    (batchSize.trim() === "" || (parsedBatchSize !== null && Number.isInteger(parsedBatchSize) && parsedBatchSize >= 1));

  const saveBatchSize = useCallback(async (value: string) => {
    if (!projectId) return;

    const trimmedValue = value.trim();
    const parsedValue = trimmedValue ? parseInt(trimmedValue, 10) : null;
    if (trimmedValue && (parsedValue === null || !Number.isInteger(parsedValue) || parsedValue < 1)) return;

    setIsSavingBatchSize(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: parsedValue }),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error?.message ?? "Batch Size 保存失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Batch Size 保存失败");
    } finally {
      setIsSavingBatchSize(false);
    }
  }, [projectId, sectionId]);

  const scheduleBatchSizeSave = useCallback((value: string) => {
    if (!projectId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveBatchSize(value);
    }, 600);
  }, [projectId, saveBatchSize]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  function setBatchSizeValue(value: string) {
    setBatchSize(value);
    if (!showBatchOverride) scheduleBatchSizeSave(value);
  }

  function handleRun() {
    const overrideBatchSize =
      parsedBatchSize && Number.isInteger(parsedBatchSize) && parsedBatchSize >= 1
        ? parsedBatchSize
        : undefined;

    startTransition(async () => {
      try {
        await runSection(sectionId, overrideBatchSize);
        toast.success("已提交运行");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "运行失败");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {showBatchOverride && (
        <BatchSizeQuickFill
          onSelect={(val) => setBatchSizeValue(String(val))}
          currentValue={parsedBatchSize}
          disabled={isPending}
          size="sm"
        />
      )}
      {!showBatchOverride && (
        <div className="flex min-w-max items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">Batch</span>
          <input
            type="number"
            min={1}
            value={batchSize}
            onChange={(event) => setBatchSizeValue(event.target.value)}
            disabled={isPending || isSavingBatchSize}
            className="input-number w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-60"
          />
          <BatchSizeQuickFill
            onSelect={(val) => setBatchSizeValue(String(val))}
            currentValue={parsedBatchSize}
            disabled={isPending || isSavingBatchSize}
            size="sm"
          />
        </div>
      )}
      <button
        disabled={isPending || (!showBatchOverride && !canSaveBatchSize)}
        onClick={handleRun}
        className="inline-flex items-center justify-center rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
        title={isPending ? "提交中…" : "运行本节"}
      >
        <Play className="size-3" />
      </button>
    </div>
  );
}
