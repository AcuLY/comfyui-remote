import Link from "next/link";
import { ChevronRight, Clock3, Eye, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { queueRuns } from "@/lib/mock-data";

export default function QueuePage() {
  const pendingTotal = queueRuns.reduce((sum, run) => sum + run.pendingCount, 0);
  const runTotal = queueRuns.length;

  return (
    <div className="space-y-4">
      <PageHeader title="待审核队列" description="默认按最新 Position Run 倒序显示，先处理最新的一组。" />
      <SectionCard title="队列概览" subtitle="审核通过后会从待审核列表中消失。">
        <div className="grid grid-cols-2 gap-3">
          <StatChip label="待审核图片" value={pendingTotal} tone="accent" />
          <StatChip label="待处理组数" value={runTotal} tone="warn" />
        </div>
      </SectionCard>

      <SectionCard title="最新结果组" subtitle="点进某一组后，用宫格勾选批量保留/删除。">
        <div className="space-y-3">
          {queueRuns.map((run) => (
            <Link
              key={run.id}
              href={`/queue/${run.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{run.jobTitle}</div>
                  <div className="mt-1 text-xs text-zinc-400">{run.characterName} · {run.positionName}</div>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">{run.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <Clock3 className="mb-1 size-3.5" />
                  {run.createdAt}
                </div>
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <Eye className="mb-1 size-3.5" />
                  待审核 {run.pendingCount}
                </div>
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <Sparkles className="mb-1 size-3.5" />
                  共 {run.totalCount} 张
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end text-xs text-sky-300">
                打开宫格 <ChevronRight className="ml-1 size-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
