import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";
import { ImageActions } from "./image-actions";

export default async function ReviewImagePage({ params }: { params: Promise<{ runId: string; imageId: string }> }) {
  const { runId, imageId } = await params;
  const [group, allIds] = await Promise.all([
    getReviewGroup(runId),
    getReviewGroupIds(),
  ]);

  if (!group) notFound();

  const imageIndex = group.images.findIndex((item) => item.id === imageId);
  const image = imageIndex >= 0 ? group.images[imageIndex] : null;

  if (!image) notFound();

  const prev = imageIndex > 0 ? group.images[imageIndex - 1] : null;
  const next = imageIndex < group.images.length - 1 ? group.images[imageIndex + 1] : null;

  const currentGroupIndex = allIds.indexOf(runId);
  const nextRunId = currentGroupIndex < allIds.length - 1 ? allIds[currentGroupIndex + 1] : null;
  const pendingImageIds = group.images
    .filter((img) => img.status === "pending")
    .map((img) => img.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/queue/${runId}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回宫格
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              image.status === "kept"
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : image.status === "trashed"
                  ? "border-rose-500/30 bg-rose-500/20 text-rose-300"
                  : "border-white/10 bg-white/5 text-zinc-400"
            }`}
          >
            {image.status}
          </span>
          <span className="text-xs text-zinc-500">{group.characterName} · {group.sectionName}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] p-3">
        <Image src={image.src} alt={image.id} width={1080} height={1440} className="h-auto w-full rounded-[22px] object-cover" unoptimized />
      </div>

      <ImageActions
        imageId={imageId}
        runId={runId}
        pendingImageIds={pendingImageIds}
        nextRunId={nextRunId}
      />

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
