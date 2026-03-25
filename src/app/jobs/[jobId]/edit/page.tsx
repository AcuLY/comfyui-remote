import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getJobEditData, getJobFormOptions } from "@/lib/server-data";
import { JobEditForm } from "./job-edit-form";

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [job, options] = await Promise.all([
    getJobEditData(jobId),
    getJobFormOptions(),
  ]);

  if (!job) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
        <ArrowLeft className="size-4" /> 返回详情
      </Link>

      <SectionCard title="编辑大任务" subtitle="修改参数后保存，不影响已有运行记录。">
        <JobEditForm
          job={job}
          characters={options.characters}
          scenes={options.scenes}
          styles={options.styles}
        />
      </SectionCard>
    </div>
  );
}
