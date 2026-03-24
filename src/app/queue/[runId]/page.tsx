import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";
import { ReviewGrid } from "./review-grid";

export default async function ReviewGroupPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const [group, allIds] = await Promise.all([
    getReviewGroup(runId),
    getReviewGroupIds(),
  ]);

  if (!group) notFound();

  const currentIndex = allIds.indexOf(runId);
  const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
  const nextId = currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

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
        subtitle="多选后批量保留或删除，点图片放大查看。"
      >
        <ReviewGrid runId={group.id} images={group.images} />
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
        {prevId ? (
          <Link href={`/queue/${prevId}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <ChevronLeft className="size-4" /> 上一组
          </Link>
        ) : <div />}
        {nextId ? (
          <Link href={`/queue/${nextId}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            下一组 <ChevronRight className="size-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
