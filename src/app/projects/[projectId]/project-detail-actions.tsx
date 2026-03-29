"use client";

import { useState, useTransition } from "react";
import { Play, Download, CheckCircle, XCircle } from "lucide-react";
import { runProject, runSection } from "@/lib/actions";
import { exportProjectImages } from "@/app/projects/actions-export";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

export function ProjectDetailActions({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize = parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    startTransition(async () => {
      await runProject(projectId, overrideBatchSize);
    });
  }

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const result = await exportProjectImages(projectId);
      setExportMsg({ ok: result.success, text: result.message });
    } catch {
      setExportMsg({ ok: false, text: "导出失败" });
    } finally {
      setExporting(false);
    }
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
      <button
        disabled={exporting}
        onClick={handleExport}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <Download className="size-4" /> {exporting ? "导出中…" : "图片整合"}
      </button>
      {exportMsg && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-xs ${
            exportMsg.ok
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
              : "border-rose-500/20 bg-rose-500/5 text-rose-300"
          }`}
        >
          {exportMsg.ok ? (
            <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{exportMsg.text}</span>
        </div>
      )}
    </div>
  );
}

export function SectionRunButton({ sectionId, defaultBatchSize }: { sectionId: string; defaultBatchSize?: number | null }) {
  const [isPending, startTransition] = useTransition();
  const [batchSize, setBatchSize] = useState<number>(defaultBatchSize ?? 2);

  function handleRun() {
    startTransition(() => runSection(sectionId, batchSize));
  }

  return (
    <div className="flex items-center gap-2">
      <BatchSizeQuickFill
        onSelect={(val) => setBatchSize(val)}
        currentValue={batchSize}
        disabled={isPending}
        size="sm"
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
