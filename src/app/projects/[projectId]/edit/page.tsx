import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getProjectEditData, getProjectFormOptions } from "@/lib/server-data";
import { ProjectEditForm } from "./project-edit-form";

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, options] = await Promise.all([
    getProjectEditData(projectId),
    getProjectFormOptions(),
  ]);

  if (!project) notFound();

  return (
    <div className="w-full max-w-4xl min-w-0 space-y-4">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-4" /> 返回详情
      </Link>

      <SectionCard title="编辑项目" subtitle="修改参数后保存，不影响已有运行记录。">
        <ProjectEditForm
          project={project}
          categories={options.categories}
        />
      </SectionCard>
    </div>
  );
}
