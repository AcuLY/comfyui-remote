"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Download, Plus, Trash2, X } from "lucide-react";
import {
  addSection,
  copySection,
  deleteSection,
  getTemplateOptionsForClient,
  importTemplateToProject,
} from "@/lib/actions";
import { toast } from "sonner";

export function AddSectionButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      try {
        await addSection(projectId);
        toast.success("小节已添加");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "添加失败");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleAdd}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2 py-2 text-[11px] text-zinc-400 transition hover:border-sky-500/30 hover:bg-sky-500/5 hover:text-sky-300 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
    >
      <Plus className="size-3.5" /> {isPending ? "添加中..." : "添加小节"}
    </button>
  );
}

export function CopySectionButton({ sectionId }: { sectionId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      try {
        await copySection(sectionId);
        toast.success("小节已复制");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "复制失败");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-50"
      title="复制小节"
    >
      <Copy className="size-3.5" />
    </button>
  );
}

export function DeleteSectionButton({
  sectionId,
  sectionName,
}: {
  sectionId: string;
  sectionName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`确定要删除小节 "${sectionName}" 吗？此操作不可撤销。`)) return;

    startTransition(async () => {
      try {
        await deleteSection(sectionId);
        toast.success("小节已删除");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
      title="删除小节"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function ImportTemplateButton({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; sectionCount: number }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      getTemplateOptionsForClient().then(setTemplates);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function closeDialog() {
    if (isPending) return;
    setIsOpen(false);
  }

  function handleImport() {
    if (!selectedId) return;

    startTransition(async () => {
      try {
        const count = await importTemplateToProject(projectId, selectedId);
        toast.success(`已导入 ${count} 个小节`);
        setIsOpen(false);
        setSelectedId("");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "导入失败");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] px-2 py-2 text-[11px] text-emerald-400 transition hover:bg-emerald-500/[0.08] sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
      >
        <Download className="size-3.5" /> 导入模板
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="导入模板"
            className="fixed left-1/2 top-1/2 z-[110] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-100">导入模板</div>
                <div className="mt-0.5 text-xs text-zinc-500">选择模板后会追加到当前项目</div>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200"
                aria-label="关闭"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 px-2 py-6 text-center text-xs text-zinc-500">
                暂无模板，请先在模板页创建
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="max-h-[min(20rem,50dvh)] space-y-1.5 overflow-y-auto pr-1">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedId(template.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                        selectedId === template.id
                          ? "border border-sky-500/30 bg-sky-500/10 text-sky-300"
                          : "border border-transparent text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="flex-1 truncate">{template.name}</span>
                      <span className="text-zinc-500">{template.sectionCount} 节</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={isPending || !selectedId}
                  onClick={handleImport}
                  className="mt-2 w-full rounded-lg border border-sky-500/20 bg-sky-500/10 py-2.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-40"
                >
                  {isPending ? "导入中..." : "确认导入"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
