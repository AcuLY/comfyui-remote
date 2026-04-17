"use client";

import { useTransition } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { addSection, copySection, deleteSection } from "@/lib/actions";
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
