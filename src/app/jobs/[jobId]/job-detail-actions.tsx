"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { runJob, runPosition } from "@/lib/actions";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

export function JobDetailActions({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<string>("");

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize = parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    startTransition(async () => {
      await runJob(jobId, overrideBatchSize);
    });
  }

  const parsedBatchSize = batchSize.trim() ? parseInt(batchSize, 10) : null;

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Batch Size 覆盖
          <input
            type="number"
            min={1}
            placeholder="留空使用各小节设定"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            className="input-number w-40 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </label>
        <BatchSizeQuickFill
          onSelect={(val) => setBatchSize(String(val))}
          currentValue={parsedBatchSize}
          disabled={isPending}
          showClear
          onClear={() => setBatchSize("")}
        />
      </div>
      <button
        disabled={isPending}
        onClick={handleRun}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-4" /> {isPending ? "提交中…" : "运行整组"}
      </button>
    </div>
  );
}

export function PositionRunButton({ positionId, defaultBatchSize }: { positionId: string; defaultBatchSize?: number | null }) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<string>(defaultBatchSize?.toString() ?? "");

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize = parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    startTransition(() => runPosition(positionId, overrideBatchSize));
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        placeholder="batch"
        value={batchSize}
        onChange={(e) => setBatchSize(e.target.value)}
        className="w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600"
      />
      <button
        disabled={isPending}
        onClick={handleRun}
        className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-3.5" /> {isPending ? "提交中…" : "运行本节"}
      </button>
    </div>
  );
}
