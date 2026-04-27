import Link from "next/link";
import { ArrowLeft, Plus, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { getProjectDetail } from "@/lib/server-data";
import { ProjectDetailActions } from "./project-detail-actions";
import { AddSectionButton, ImportTemplateButton } from "./section-actions";
import { SectionList } from "./section-list";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);
  if (!project) notFound();

  return (
    <div className="space-y-3">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回项目列表
      </Link>
      <SectionCard title={project.title} subtitle="项目操作与参数概览">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="rounded-xl bg-white/[0.03] p-2.5">
              <div className="text-xs text-zinc-500">预设</div>
              <div className="mt-0.5">{project.presetNames.join(" · ") || "无预设"}</div>
            </div>
            <Link
              href={`/projects/${projectId}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.08]"
            >
              <SlidersHorizontal className="size-3.5" /> 编辑当前项目参数
            </Link>
          </div>
          <ProjectDetailActions projectId={project.id} projectTitle={project.title} />
        </div>
      </SectionCard>

      <SectionCard title="小节列表" subtitle="拖动排序、点击名称重命名。每个小节对应一次完整生图的参数集合，可独立运行。">
        <div className="space-y-3">
          {project.sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
              暂无小节，点击下方按钮添加
            </div>
          ) : (
            <SectionList projectId={project.id} sections={project.sections} />
          )}
          <AddSectionButton projectId={project.id} />
          <ImportTemplateButton projectId={project.id} />
          <Link
            href={`/projects/${project.id}/batch-create`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-3 py-3 text-xs text-sky-400 transition hover:bg-sky-500/[0.08]"
          >
            <Plus className="size-3.5" /> 批量创建小节
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
