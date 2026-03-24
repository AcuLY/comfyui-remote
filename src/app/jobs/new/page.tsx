import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getJobFormOptions } from "@/lib/server-data";
import { JobForm } from "./job-form";

export default async function NewJobPage() {
  const options = await getJobFormOptions();

  return (
    <div className="space-y-4">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-zinc-300">
        <ArrowLeft className="size-4" /> 返回大任务
      </Link>

      <SectionCard title="创建大任务" subtitle="选择角色、场景、风格，勾选要启用的 Position。">
        <JobForm
          characters={options.characters}
          scenes={options.scenes}
          styles={options.styles}
          positions={options.positions}
        />
      </SectionCard>
    </div>
  );
}
