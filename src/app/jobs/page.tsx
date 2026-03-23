import Link from "next/link";
import { Copy, Play, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { jobs } from "@/lib/mock-data";

export default function JobsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="大任务" description="管理 Character、场景、风格与 position 组合。" />
      <SectionCard title="任务列表" subtitle="支持复制任务、运行整组、运行单个 position。">
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{job.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">{job.characterName} · {job.sceneName} · {job.styleName}</div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{job.status}</span>
              </div>
              <div className="mt-3 text-xs text-zinc-500">最近更新：{job.updatedAt} · {job.positionCount} 个 position</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <button className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200">编辑</button>
                <button className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200"><Copy className="size-3.5" /> 复制</button>
                <button className="inline-flex items-center justify-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sky-300"><Play className="size-3.5" /> 运行</button>
              </div>
              <div className="mt-3 flex justify-end">
                <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-xs text-sky-300">查看详情 <Sparkles className="size-3.5" /></Link>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
