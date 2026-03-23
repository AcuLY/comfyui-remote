import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

export default async function JobPositionEditPage({ params }: { params: Promise<{ jobId: string; positionId: string }> }) {
  const { jobId, positionId } = await params;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/jobs/${jobId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回任务详情
        </Link>
        <button className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          <Save className="size-4" /> 保存本节参数
        </button>
      </div>

      <PageHeader title={`编辑 Position：${positionId}`} description="用于调整当前大任务里的这一节覆盖参数。" />

      <SectionCard title="Prompt 覆盖" subtitle="首版先提供常用字段，后续再补更细粒度参数。">
        <div className="space-y-3">
          <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" defaultValue="1girl, standing, outdoor, detailed pose..." />
          <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" defaultValue="lowres, blurry, extra fingers..." />
        </div>
      </SectionCard>

      <SectionCard title="运行参数" subtitle="这里的修改只针对这次大任务。">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <input defaultValue="3:4" className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" />
          <input type="number" defaultValue={8} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" />
          <input defaultValue="random-per-run" className="col-span-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none" />
        </div>
      </SectionCard>
    </div>
  );
}
