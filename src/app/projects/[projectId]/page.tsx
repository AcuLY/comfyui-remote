import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
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
      <SectionCard title={project.title} className="!p-3 lg:!p-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] md:items-start">
          <div />
          <ProjectDetailActions projectId={project.id} projectTitle={project.title} editHref={`/projects/${projectId}/edit`} />
        </div>
      </SectionCard>

      <SectionCard title="小节列表">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <AddSectionButton projectId={project.id} />
            <ImportTemplateButton projectId={project.id} />
            <Link
              href={`/projects/${project.id}/batch-create`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-3 py-3 text-xs text-sky-400 transition hover:bg-sky-500/[0.08]"
            >
              <Plus className="size-3.5" /> 批量创建小节
            </Link>
          </div>
          {project.sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
              暂无小节，点击上方按钮添加
            </div>
          ) : (
            <SectionList projectId={project.id} sections={project.sections} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
