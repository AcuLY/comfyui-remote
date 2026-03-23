import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Ellipsis, Expand, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { reviewGroups } from "@/lib/mock-data";

export default async function ReviewGroupPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const currentIndex = reviewGroups.findIndex((group) => group.id === runId);
  const group = reviewGroups[currentIndex];

  if (!group) notFound();

  const prev = currentIndex > 0 ? reviewGroups[currentIndex - 1] : null;
  const next = currentIndex < reviewGroups.length - 1 ? reviewGroups[currentIndex + 1] : null;

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
        subtitle="首版先做静态骨架：多选、保留、删除、放大查看。"
        actions={<span className="text-xs text-zinc-500">组内分页待接</span>}
      >
        <div className="grid grid-cols-3 gap-3">
          {group.images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel-soft)]">
              <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                <input type="checkbox" className="size-4 rounded border-white/20 bg-black/30" />
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">{image.label}</span>
              </div>
              <Link href={`/queue/${group.id}/images/${image.id}`}>
                <Image src={image.src} alt={image.id} width={400} height={560} className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" unoptimized />
              </Link>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] text-white">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5">{image.status}</span>
                <Link href={`/queue/${group.id}/images/${image.id}`} className="inline-flex items-center gap-1 text-zinc-200">
                  <Expand className="size-3" /> 查看
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">批量保留</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300"><Trash2 className="size-4" /> 批量删除</button>
        </div>
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
