"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2, Layers } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2">
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
    <Link
      href={`/settings/templates/${template.id}/edit`}
      className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05] md:max-w-[500px]"
    >
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
        <button
          disabled={isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </Link>
  );
}
