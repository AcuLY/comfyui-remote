import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getJobCreateOptions } from "@/lib/server-data";
import { JobCreateForm } from "./job-create-form";

export default async function NewJobPage() {
  const options = await getJobCreateOptions();

  return (
    <div className="space-y-4">
      <PageHeader title="新建任务" description="先创建一个最小 draft，再进入详情页继续补 prompt 和 position 覆盖。" />
      <SectionCard title="创建草稿任务" subtitle="接真实 POST /api/jobs；需要 Character 和至少一个启用 position。">
        <JobCreateForm options={options} />
      </SectionCard>
    </div>
  );
}
