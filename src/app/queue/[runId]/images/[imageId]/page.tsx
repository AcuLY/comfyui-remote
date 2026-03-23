import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getReviewGroup } from "@/lib/server-data";
import { ReviewImageActions } from "./review-image-actions";

export default async function ReviewImagePage({ params }: { params: Promise<{ runId: string; imageId: string }> }) {
  const { runId, imageId } = await params;
  const group = await getReviewGroup(runId);
  const imageIndex = group?.images.findIndex((item) => item.id === imageId) ?? -1;
  const image = imageIndex >= 0 ? group?.images[imageIndex] : null;

  if (!group || !image) notFound();

  const prev = imageIndex > 0 ? group.images[imageIndex - 1] : null;
  const next = imageIndex < group.images.length - 1 ? group.images[imageIndex + 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/queue/${runId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回宫格
        </Link>
        <span className="text-right text-xs text-zinc-500">{group.characterName} · {group.positionName}</span>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-3">
        <Image src={image.src} alt={image.label} width={1080} height={1440} className="h-auto w-full rounded-[22px] object-cover" unoptimized />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[var(--panel-soft)] p-4 text-sm text-zinc-300">
        <div className="flex items-center justify-between gap-3">
          <span>图片编号</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white">{image.label}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span>当前状态</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white">{image.status}</span>
        </div>
      </div>

      <ReviewImageActions runId={runId} imageId={image.id} />

      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={`/queue/${runId}/images/${prev.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <ChevronLeft className="size-4" /> 上一张
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/queue/${runId}/images/${next.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            下一张 <ChevronRight className="size-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
