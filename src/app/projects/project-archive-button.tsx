"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { archiveProject } from "@/lib/actions";

export function ProjectArchiveButton({
  projectId,
  projectTitle,
  className,
}: {
  projectId: string;
  projectTitle: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    if (
      !confirm(
        `确定要归档项目 "${projectTitle}" 吗？归档会清理已生成图片、回收站、ComfyUI 输出和导出文件，列表默认不再显示。`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await archiveProject(projectId);
        toast.success("项目已归档");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "归档失败");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleArchive}
      className={className ?? "inline-flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-zinc-950/85 text-amber-300 shadow-sm transition hover:bg-amber-500/15 disabled:opacity-50"}
      title="归档项目"
      aria-label={`归档项目：${projectTitle}`}
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
    </button>
  );
}
