"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Play, Pencil, Trash2 } from "lucide-react";
import { runProject, copyProject, deleteProject } from "@/lib/actions";

export function ProjectActions({ projectId, projectTitle }: { projectId: string; projectTitle?: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRun() {
    startTransition(async () => {
      await runProject(projectId);
    });
  }

  function handleCopy() {
    startTransition(async () => {
      const newId = await copyProject(projectId);
      if (newId) {
        router.push(`/projects/${newId}`);
      }
    });
  }

  function handleDelete() {
    const name = projectTitle || "此项目";
    if (!confirm(`确认删除「${name}」？\n\n此操作将同时删除所有小节、运行记录和图片数据，不可撤销。`)) return;
    startTransition(async () => {
      await deleteProject(projectId);
      router.push("/projects");
    });
  }

  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      <Link
        href={`/projects/${projectId}/edit`}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200 transition hover:bg-white/[0.08]"
      >
        <Pencil className="size-3.5" /> 编辑
      </Link>
      <button
        disabled={isPending}
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Copy className="size-3.5" /> {isPending ? "…" : "复制"}
      </button>
      <button
        disabled={isPending}
        onClick={handleRun}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-3.5" /> {isPending ? "…" : "运行"}
      </button>
      <button
        disabled={isPending}
        onClick={handleDelete}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" /> {isPending ? "…" : "删除"}
      </button>
    </div>
  );
}
