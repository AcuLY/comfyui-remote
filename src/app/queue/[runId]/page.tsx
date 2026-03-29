import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";
import { ReviewGrid } from "./review-grid";

function ExecutionMetaDisplay({ meta }: { meta: Record<string, unknown> }) {
  const ks1Seed = meta.ks1Seed as number | null | undefined;
  const ks2Seed = meta.ks2Seed as number | null | undefined;
  const ks1Steps = meta.ks1Steps as number | null | undefined;
  const ks1Cfg = meta.ks1Cfg as number | null | undefined;
  const ks1Sampler = meta.ks1Sampler as string | null | undefined;
  const ks1Denoise = meta.ks1Denoise as number | null | undefined;
  const ks2Steps = meta.ks2Steps as number | null | undefined;
  const ks2Cfg = meta.ks2Cfg as number | null | undefined;
  const ks2Sampler = meta.ks2Sampler as string | null | undefined;
  const ks2Denoise = meta.ks2Denoise as number | null | undefined;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
      {/* KSampler1 */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-1">
        <div className="text-[10px] font-medium text-zinc-500">KSampler1</div>
        {ks1Seed != null && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Seed</span>
            <span className="font-mono text-zinc-300">{ks1Seed}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
          {ks1Steps != null && <span>steps {ks1Steps}</span>}
          {ks1Cfg != null && <span>cfg {ks1Cfg}</span>}
          {ks1Sampler && <span>{ks1Sampler}</span>}
          {ks1Denoise != null && <span>denoise {ks1Denoise}</span>}
        </div>
      </div>
      {/* KSampler2 */}
      {ks2Seed != null ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-1">
          <div className="text-[10px] font-medium text-zinc-500">KSampler2</div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Seed</span>
            <span className="font-mono text-zinc-300">{ks2Seed}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
            {ks2Steps != null && <span>steps {ks2Steps}</span>}
            {ks2Cfg != null && <span>cfg {ks2Cfg}</span>}
            {ks2Sampler && <span>{ks2Sampler}</span>}
            {ks2Denoise != null && <span>denoise {ks2Denoise}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
          <div className="text-[10px] font-medium text-zinc-600">KSampler2</div>
          <div className="text-zinc-600">跳过（1× 无高清修复）</div>
        </div>
      )}
    </div>
  );
}

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

      <SectionCard title={group.title} subtitle={`${group.presetNames.join(" · ") || group.sectionName} · ${group.createdAt}`}>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">待审核<br /><span className="text-base font-semibold text-white">{group.pendingCount}</span></div>
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">总张数<br /><span className="text-base font-semibold text-white">{group.totalCount}</span></div>
          <div className="rounded-2xl bg-white/[0.03] px-3 py-3 text-zinc-400">单页上限<br /><span className="text-base font-semibold text-white">9</span></div>
        </div>
        {group.executionMeta && (
          <ExecutionMetaDisplay meta={group.executionMeta} />
        )}
      </SectionCard>

      <SectionCard
        title="宫格审核"
        subtitle="多选后批量保留或删除，点图片放大查看。"
      >
        <ReviewGrid runId={group.id} images={group.images} nextRunId={nextId} />
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
