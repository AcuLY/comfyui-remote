"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProject } from "@/lib/actions";

export function ProjectDeleteButton({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`确定要删除项目 "${projectTitle}" 吗？此操作不可撤销。`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteProject(projectId);
        toast.success("项目已删除");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-lg border border-rose-500/20 bg-zinc-950/85 text-rose-300 shadow-sm transition hover:bg-rose-500/15 disabled:opacity-50"
      title="删除项目"
      aria-label={`删除项目：${projectTitle}`}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
