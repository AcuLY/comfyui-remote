import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { ReviewGrid } from "./review-grid";
import { SectionCard } from "@/components/section-card";
import { reviewGroups } from "@/lib/mock-data";
import { getQueueRuns, getReviewGroup } from "@/lib/server-data";

export default async function ReviewGroupPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [group, runs] = await Promise.all([getReviewGroup(runId), getQueueRuns()]);

  if (!group) notFound();

  const currentIndex = runs.findIndex((run) => run.id === runId);
  const runNeighbors = currentIndex >= 0
    ? {
        prev: currentIndex > 0 ? runs[currentIndex - 1] : null,
        next: currentIndex < runs.length - 1 ? runs[currentIndex + 1] : null,
      }
    : null;
  const fallbackIndex = reviewGroups.findIndex((item) => item.id === runId);
  const fallbackNeighbors = fallbackIndex >= 0
    ? {
        prev: fallbackIndex > 0 ? reviewGroups[fallbackIndex - 1] : null,
        next: fallbackIndex < reviewGroups.length - 1 ? reviewGroups[fallbackIndex + 1] : null,
      }
    : { prev: null, next: null };

  const prev = runNeighbors?.prev ?? fallbackNeighbors.prev;
  const next = runNeighbors?.next ?? fallbackNeighbors.next;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/queue" className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回队列
        </Link>
        <button className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300">
          <Ellipsis className="size-4" /> 参数编辑
        </button>
      </div>

      <SectionCard title={group.title} subtitle={`${group.characterName} · ${group.positionName} · ${group.createdAt}`}>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">待审核<br /><span className="text-base font-semibold text-white">{group.pendingCount}</span></div>
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">总张数<br /><span className="text-base font-semibold text-white">{group.totalCount}</span></div>
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">单页上限<br /><span className="text-base font-semibold text-white">9</span></div>
        </div>
      </SectionCard>

      <SectionCard
        title="宫格审核"
        subtitle="多选后可直接提交真实 keep / trash 审图动作。"
        actions={<span className="text-xs text-zinc-500">组内分页待接</span>}
      >
        <ReviewGrid group={group} />
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={`/queue/${prev.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <ChevronLeft className="size-4" /> 上一组
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/queue/${next.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            下一组 <ChevronRight className="size-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
