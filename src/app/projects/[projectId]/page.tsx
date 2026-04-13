import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { getProjectDetail, getProjectRevisions } from "@/lib/server-data";
import { ProjectDetailActions } from "./project-detail-actions";
import { AddSectionButton } from "./section-actions";
import { RevisionHistory } from "./revision-history";
import { SectionList } from "./section-list";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, revisions] = await Promise.all([
    getProjectDetail(projectId),
    getProjectRevisions(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-3">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回项目列表
      </Link>
      <div className="grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2">
        <SectionCard title={project.title} subtitle={project.presetNames.join(" · ") || "无预设"} className="w-full md:max-w-[500px]">
          <ProjectDetailActions projectId={project.id} projectTitle={project.title} />
        </SectionCard>

        <SectionCard title="参数概览" subtitle="结果侧与项目侧都默认编辑当前项目配置。" className="w-full md:max-w-[500px]">
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
        </SectionCard>
      </div>

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
        </div>
      </SectionCard>

      <SectionCard title="修订历史" subtitle="每次编辑参数前自动保存快照，点击展开查看。">
        <RevisionHistory revisions={revisions} projectId={project.id} />
      </SectionCard>
    </div>
  );
}
