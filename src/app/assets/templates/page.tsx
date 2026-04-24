import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { listProjectTemplates } from "@/lib/server-data";
import { TemplatesListClient } from "./templates-list-client";

export default async function TemplatesPage() {
  const templates = await listProjectTemplates();

  return (
    <div className="space-y-4">
      <SectionCard title="项目模板" subtitle="管理可复用的小节配置模板，在项目中一键批量导入。">
        <div className="space-y-3">
          <Link
            href="/assets/templates/new"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400 transition hover:border-sky-500/30 hover:bg-sky-500/5 hover:text-sky-300"
          >
            <Plus className="size-4" /> 新建模板
          </Link>
          <TemplatesListClient templates={templates} />
        </div>
      </SectionCard>
    </div>
  );
}
