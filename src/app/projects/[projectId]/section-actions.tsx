"use client";

import { useState, useTransition, useEffect } from "react";
import { Copy, Plus, Trash2, Download } from "lucide-react";
import { addSection, copySection, deleteSection, importTemplateToProject, getTemplateOptionsForClient } from "@/lib/actions";
import { toast } from "sonner";

export function AddSectionButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      try {
        await addSection(projectId);
        toast.success("小节已添加");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "添加失败");
      }
    });
  }

  return (
    <button
      disabled={isPending}
      onClick={handleAdd}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400 transition hover:border-sky-500/30 hover:bg-sky-500/5 hover:text-sky-300 disabled:opacity-50"
    >
      <Plus className="size-4" /> {isPending ? "添加中…" : "添加小节"}
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
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "复制失败");
      }
    });
  }

  return (
    <button
      disabled={isPending}
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-50"
    >
      <Copy className="size-3.5" /> {isPending ? "复制中…" : "复制"}
    </button>
  );
}

export function DeleteSectionButton({ sectionId, sectionName }: { sectionId: string; sectionName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`确定要删除小节"${sectionName}"吗？此操作不可撤销。`)) return;
    startTransition(async () => {
      try {
        await deleteSection(sectionId);
        toast.success("小节已删除");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <button
      disabled={isPending}
      onClick={handleDelete}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
    >
      <Trash2 className="size-3.5" /> {isPending ? "删除中…" : "删除"}
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

  function handleImport() {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        const count = await importTemplateToProject(projectId, selectedId);
        toast.success(`已导入 ${count} 个小节`);
        setIsOpen(false);
        setSelectedId("");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "导入失败");
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] px-3 py-3 text-xs text-emerald-400 transition hover:bg-emerald-500/[0.08]"
      >
        <Download className="size-3.5" /> 导入模板
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-3 shadow-xl backdrop-blur">
            {templates.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-zinc-500">
                暂无模板，请先在设置中创建
              </div>
            ) : (
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                      selectedId === t.id
                        ? "border border-sky-500/30 bg-sky-500/10 text-sky-300"
                        : "border border-transparent text-zinc-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-zinc-500">{t.sectionCount} 节</span>
                  </button>
                ))}
                <button
                  disabled={isPending || !selectedId}
                  onClick={handleImport}
                  className="mt-1 w-full rounded-xl border border-sky-500/20 bg-sky-500/10 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-40"
                >
                  {isPending ? "导入中…" : "确认导入"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
