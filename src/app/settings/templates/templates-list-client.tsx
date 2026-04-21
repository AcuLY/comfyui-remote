"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2, Edit, Layers } from "lucide-react";
import { deleteProjectTemplate } from "@/lib/actions";
import { toast } from "sonner";
import type { ProjectTemplateListItem } from "@/lib/server-data";

export function TemplatesListClient({
  templates,
}: {
  templates: ProjectTemplateListItem[];
}) {
  const router = useRouter();

  if (templates.length === 0) {
    return (
      <div className="text-center text-xs text-zinc-500">暂无模板</div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onDeleted={() => router.refresh()} />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onDeleted,
}: {
  template: ProjectTemplateListItem;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`确认删除模板「${template.name}」？此操作不可撤销。`)) return;
    startTransition(async () => {
      try {
        await deleteProjectTemplate(template.id);
        toast.success("模板已删除");
        onDeleted();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 shrink-0 text-sky-400" />
            <div className="truncate text-sm font-medium text-white">
              {template.name}
            </div>
          </div>
          {template.description && (
            <div className="mt-1 text-xs text-zinc-400 line-clamp-2">
              {template.description}
            </div>
          )}
          <div className="mt-1.5 flex gap-2 text-[11px] text-zinc-500">
            <span>{template.sectionCount} 个小节</span>
            <span>·</span>
            <span>更新于 {template.updatedAt}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/settings/templates/${template.id}/edit`}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.08]"
          >
            <Edit className="size-3" /> 编辑
          </Link>
          <button
            disabled={isPending}
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
          >
            <Trash2 className="size-3" />
            {isPending ? "删除中…" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
