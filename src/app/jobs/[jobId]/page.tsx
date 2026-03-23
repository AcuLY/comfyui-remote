import { Copy, Play, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { jobs } from "@/lib/mock-data";

const positions = [
  { id: "standing", name: "Standing", batch: 8, ratio: "3:4", status: "latest done" },
  { id: "watching", name: "Watching", batch: 8, ratio: "3:4", status: "latest done" },
  { id: "bench-sit", name: "Bench sit", batch: 6, ratio: "3:4", status: "draft" },
];

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobs.find((item) => item.id === jobId);
  if (!job) notFound();

  return (
    <div className="space-y-4">
      <SectionCard title={job.title} subtitle={`${job.characterName} · ${job.sceneName} · ${job.styleName}`}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300"><Play className="size-4" /> 运行整组</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-200"><Copy className="size-4" /> 复制任务</button>
        </div>
      </SectionCard>

      <SectionCard title="参数概览" subtitle="结果侧与任务侧都默认编辑当前大任务配置。">
        <div className="space-y-3 text-sm text-zinc-300">
          <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Character prompt</div><div className="mt-1">miku, long hair, calm expression...</div></div>
          <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Scene prompt</div><div className="mt-1">park bench, spring afternoon, outdoor...</div></div>
          <div className="rounded-2xl bg-white/[0.03] p-3"><div className="text-xs text-zinc-500">Style prompt</div><div className="mt-1">soft daylight, anime cinematic, detailed shading...</div></div>
          <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200"><SlidersHorizontal className="size-4" /> 编辑当前大任务参数</button>
        </div>
      </SectionCard>

      <SectionCard title="Position 列表" subtitle="支持只运行某一节，不必先改参数。">
        <div className="space-y-3">
          {positions.map((position) => (
            <div key={position.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{position.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">batch {position.batch} · {position.ratio} · {position.status}</div>
                </div>
                <button className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300"><Play className="size-3.5" /> 运行本节</button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
