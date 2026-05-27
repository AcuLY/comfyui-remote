"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Shield, X, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import {
  censorProjectImages,
  getCensoringPreview,
  getCensoringProgress,
  cancelCensoringTasks,
  pauseCensoringTasks,
  resumeCensoringTasks,
  type CensoringPreview,
  type CensoringProgress,
} from "@/lib/actions";

export function CensorButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<CensoringPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<CensoringProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch preview data when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingPreview(true);
    // Also check if there are already active tasks
    Promise.all([
      getCensoringPreview(projectId),
      getCensoringProgress(projectId),
    ])
      .then(([prev, prog]) => {
        setPreview(prev);
        if (prog.queued + prog.running > 0) {
          setProgress(prog);
          setIsPolling(true);
        }
      })
      .catch(() => setPreview(null))
      .finally(() => setIsLoadingPreview(false));
  }, [isOpen, projectId]);

  // Lock body scroll + Escape key
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPending]);

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;
    let active = true;
    const poll = async () => {
      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;
        const p = await getCensoringProgress(projectId);
        if (!active) break;
        setProgress(p);
        // If no more queued or running, stop polling
        if (p.queued === 0 && p.running === 0) {
          setIsPolling(false);
          if (p.done > 0) {
            toast.success(`打码完成：${p.done} 张成功${p.failed > 0 ? `，${p.failed} 张失败` : ""}`);
          }
          router.refresh();
          break;
        }
      }
    };
    poll();
    return () => { active = false; };
  }, [isPolling, projectId, router]);

  function closeDialog() {
    if (!isPending) {
      setIsOpen(false);
      // Don't reset progress/polling — tasks continue in background
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await censorProjectImages(projectId);
        if (result.success) {
          toast.success(result.message);
          if (result.taskCount > 0) {
            setIsPolling(true);
          } else {
            router.refresh();
          }
        } else {
          toast.error(result.message);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "打码失败");
      }
    });
  }

  async function handleCancel() {
    try {
      const result = await cancelCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        setIsPolling(false);
        setProgress(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("取消失败");
    }
  }

  async function handlePause() {
    try {
      const result = await pauseCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        setIsPolling(false);
        // Refresh progress to reflect paused state
        const p = await getCensoringProgress(projectId);
        setProgress(p);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("暂停失败");
    }
  }

  async function handleResume() {
    try {
      const result = await resumeCensoringTasks(projectId);
      if (result.success) {
        toast.success(result.message);
        setIsPolling(true);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("恢复失败");
    }
  }

  const showProgress = isPolling || (progress && (progress.queued + progress.running > 0));
  const isPaused = progress && progress.queued === 0 && progress.running === 0 && progress.paused > 0;

  const dialogContent = isOpen
    ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={closeDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="批量打码"
            className="fixed left-1/2 top-[50dvh] z-[210] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Shield className="size-4 text-amber-400" />
                  批量打码
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  对项目中已保留的图片执行打码处理
                </div>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200 disabled:opacity-50"
                aria-label="关闭"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {showProgress || isPaused ? (
                <>
                  <div className="space-y-1.5 text-sm text-zinc-300">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">已完成</span>
                      <span className="font-mono text-emerald-300">{progress?.done ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">运行中</span>
                      <span className="font-mono text-amber-300">{progress?.running ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">队列中</span>
                      <span className="font-mono text-zinc-100">{progress?.queued ?? 0}</span>
                    </div>
                    {(progress?.paused ?? 0) > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span className="text-zinc-400">已暂停</span>
                        <span className="font-mono text-sky-300">{progress?.paused}</span>
                      </div>
                    )}
                    {(progress?.failed ?? 0) > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span className="text-zinc-400">失败</span>
                        <span className="font-mono text-rose-400">{progress?.failed ?? 0}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">
                        打码进度 {progress?.done ?? 0}/{progress?.total ?? 0}
                      </span>
                      <span className="font-mono text-amber-200">
                        {progress && progress.total > 0
                          ? Math.round((progress.done / progress.total) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{
                          width: `${progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : isLoadingPreview ? (
                <div className="flex items-center justify-center py-6 text-zinc-500">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="ml-2 text-xs">加载中...</span>
                </div>
              ) : preview ? (
                <>
                  <div className="space-y-1.5 text-sm text-zinc-300">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">已保留图片</span>
                      <span className="font-mono text-zinc-100">
                        {preview.totalKept}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">已打码</span>
                      <span className="font-mono text-zinc-100">
                        {preview.alreadyCensored}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">待打码</span>
                      <span className="font-mono text-amber-300">
                        {preview.needsCensoring}
                      </span>
                    </div>
                  </div>
                  {preview.needsCensoring === 0 && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-300/90">
                      所有保留图片已完成打码
                    </div>
                  )}
                  {preview.needsCensoring > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-xs text-amber-300/90">
                      {preview.totalKept} 张已保留图片中 {preview.alreadyCensored}{" "}
                      张已打码，将对 {preview.needsCensoring} 张执行打码
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center text-xs text-zinc-500">
                  无法加载预览数据
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 p-3">
              {showProgress ? (
                <>
                  <button
                    type="button"
                    onClick={handlePause}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
                  >
                    <Pause className="size-3" />
                    暂停
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                  >
                    <X className="size-3" />
                    取消剩余
                  </button>
                </>
              ) : isPaused ? (
                <>
                  <button
                    type="button"
                    onClick={handleResume}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    <Play className="size-3" />
                    继续
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                  >
                    <X className="size-3" />
                    取消全部
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isPending}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={
                      isPending ||
                      isLoadingPreview ||
                      !preview ||
                      preview.needsCensoring === 0
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Shield className="size-3" />
                        确认打码{preview && preview.needsCensoring > 0
                          ? ` (${preview.needsCensoring} 张)`
                          : ""}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-2 py-2 text-[11px] text-amber-300 transition hover:bg-amber-500/[0.1] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
      >
        <Shield className="size-3.5" /> 批量打码
      </button>
      {dialogContent}
    </>
  );
}
