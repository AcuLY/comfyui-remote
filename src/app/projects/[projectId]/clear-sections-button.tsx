"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearAllSections,
  getClearSectionsPreview,
  type ClearSectionsPreview,
} from "@/lib/actions";

export function ClearSectionsButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<ClearSectionsPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setPreview(null);
    setIsLoadingPreview(true);
    setIsOpen(true);
    getClearSectionsPreview(projectId)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setIsLoadingPreview(false));
  }

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

  function closeDialog() {
    if (!isPending) setIsOpen(false);
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await clearAllSections(projectId);
        if (result.ok) {
          toast.success(`已清空 ${result.deletedSections} 个小节`);
          setIsOpen(false);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "清空失败");
      }
    });
  }

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
            aria-label="清空所有小节"
            className="fixed left-1/2 top-[50dvh] z-[210] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <AlertTriangle className="size-4 text-amber-400" />
                  清空所有小节
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  此操作不可撤销，将永久删除以下内容：
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
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-6 text-zinc-500">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="ml-2 text-xs">加载中...</span>
                </div>
              ) : preview ? (
                <>
                  {preview.hasActiveRuns && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      有正在执行或排队中的任务，无法清空。请等待完成后重试。
                    </div>
                  )}
                  <div className="space-y-1.5 text-sm text-zinc-300">
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">小节数</span>
                      <span className="font-mono text-zinc-100">{preview.sectionCount}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">运行记录</span>
                      <span className="font-mono text-zinc-100">{preview.runCount}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span className="text-zinc-400">图片数</span>
                      <span className="font-mono text-zinc-100">{preview.imageCount}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-xs text-amber-300/90">
                    同时会删除本地管理的图片文件和 ComfyUI 输出目录。
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-xs text-zinc-500">无法加载预览数据</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 p-3">
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
                disabled={isPending || isLoadingPreview || !preview || preview.hasActiveRuns || preview.sectionCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    清空中...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3" />
                    确认清空
                  </>
                )}
              </button>
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
        onClick={openDialog}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-2 py-2 text-[11px] text-red-400 transition hover:bg-red-500/[0.1] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
      >
        <Trash2 className="size-3.5" /> 清空小节
      </button>
      {dialogContent}
    </>
  );
}
