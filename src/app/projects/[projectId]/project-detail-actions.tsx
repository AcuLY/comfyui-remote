"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Download, CheckCircle, XCircle, Trash2, Save } from "lucide-react";
import { runProject, runSection, deleteProject, saveProjectAsTemplate } from "@/lib/actions";
import { toast } from "sonner";
import { exportProjectImages } from "@/app/projects/actions-export";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

export function ProjectDetailActions({ projectId, projectTitle }: { projectId: string; projectTitle?: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [batchSize, setBatchSize] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleRun() {
    const parsed = batchSize.trim() ? parseInt(batchSize, 10) : undefined;
    const overrideBatchSize = parsed && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    startTransition(async () => {
      try {
        await runProject(projectId, overrideBatchSize);
        toast.success("已提交运行");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "运行失败");
      }
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

  const actionButtonClass = "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs transition disabled:opacity-50";

  return (
    <div className="space-y-2 text-xs">
      <div className="space-y-1.5">
        <label className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
          Batch Size 覆盖
          <input
            type="number"
            min={1}
            placeholder="留空使用各小节设定"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            className="input-number h-8 w-36 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs text-white outline-none placeholder:text-zinc-600"
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
      <div className="grid grid-cols-2 gap-1.5">
        <button
          disabled={isPending}
          onClick={handleRun}
          className={`${actionButtonClass} border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20`}
        >
          <Play className="size-3.5" /> {isPending ? "提交中…" : "运行整组"}
        </button>
        <button
          disabled={exporting}
          onClick={handleExport}
          className={`${actionButtonClass} border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}
        >
          <Download className="size-3.5" /> {exporting ? "导出中…" : "图片整合"}
        </button>
        <button
          onClick={() => {
            const name = prompt("模板名称：", projectTitle || "");
            if (!name) return;
            startTransition(async () => {
              try {
                await saveProjectAsTemplate(projectId, name);
                toast.success(`已保存为模板「${name}」`);
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "保存失败");
              }
            });
          }}
          disabled={isPending}
          className={`${actionButtonClass} border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
        >
          <Save className="size-3.5" /> {isPending ? "保存中…" : "保存为模板"}
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            const name = projectTitle || "此项目";
            if (!confirm(`确认删除「${name}」？\n\n此操作将同时删除所有小节、运行记录和图片数据，不可撤销。`)) return;
            startTransition(async () => {
              try {
                await deleteProject(projectId);
                toast.success("项目已删除");
                router.push("/projects");
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "删除失败");
              }
            });
          }}
          className={`${actionButtonClass} border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
        >
          <Trash2 className="size-3.5" /> {isPending ? "删除中…" : "删除项目"}
        </button>
      </div>
      {exportMsg && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] ${
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
    <div className="flex items-center gap-2">
      {showBatchOverride && (
        <BatchSizeQuickFill
          onSelect={(val) => setBatchSizeValue(String(val))}
          currentValue={parsedBatchSize}
          disabled={isPending}
          size="sm"
        />
      )}
      {!showBatchOverride && (
        <div className="flex items-center gap-1.5">
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
        className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-3.5" /> {isPending ? "提交中…" : "运行本节"}
      </button>
    </div>
  );
}
