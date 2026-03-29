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
    <div className="space-y-4">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
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
