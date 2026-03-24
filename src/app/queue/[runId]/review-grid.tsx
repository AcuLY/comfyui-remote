"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Expand, Trash2, Check } from "lucide-react";
import { keepImages, trashImages } from "@/lib/actions";
import type { ReviewImage } from "@/lib/types";

export function ReviewGrid({
  runId,
  images,
}: {
  runId: string;
  images: ReviewImage[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === images.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(images.map((img) => img.id)));
    }
  }

  function handleKeep() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await keepImages(ids);
      setSelected(new Set());
    });
  }

  function handleTrash() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await trashImages(ids);
      setSelected(new Set());
    });
  }

  const pendingImages = images.filter((img) => img.status === "pending");
  const selectedCount = selected.size;

  return (
    <div>
      {/* 全选 / 只选 pending */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          onClick={selectAll}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
        >
          {selected.size === images.length ? "取消全选" : "全选"}
        </button>
        <button
          onClick={() =>
            setSelected(new Set(pendingImages.map((img) => img.id)))
          }
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
        >
          选中待审核 ({pendingImages.length})
        </button>
        {selectedCount > 0 && (
          <span className="ml-auto text-sky-300">已选 {selectedCount} 张</span>
        )}
      </div>

      {/* 宫格 */}
      <div className="grid grid-cols-3 gap-3">
        {images.map((image) => {
          const isSelected = selected.has(image.id);
          return (
            <div
              key={image.id}
              className={`group relative overflow-hidden rounded-2xl border bg-[var(--panel-soft)] transition ${isSelected ? "border-sky-400/50 ring-2 ring-sky-400/30" : "border-white/10"}`}
            >
              <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                <button
                  onClick={() => toggleSelect(image.id)}
                  className={`flex size-5 items-center justify-center rounded border text-[10px] transition ${isSelected ? "border-sky-400 bg-sky-500 text-white" : "border-white/20 bg-black/30 text-transparent hover:border-white/40"}`}
                >
                  <Check className="size-3" />
                </button>
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
                  {image.label}
                </span>
              </div>
              <button
                onClick={() => toggleSelect(image.id)}
                className="block w-full"
              >
                <Image
                  src={image.src}
                  alt={image.id}
                  width={400}
                  height={560}
                  className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]"
                  unoptimized
                />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] text-white">
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    image.status === "kept"
                      ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                      : image.status === "trashed"
                        ? "border-rose-500/30 bg-rose-500/20 text-rose-300"
                        : "border-white/10 bg-black/30"
                  }`}
                >
                  {image.status}
                </span>
                <Link
                  href={`/queue/${runId}/images/${image.id}`}
                  className="inline-flex items-center gap-1 text-zinc-200 hover:text-white"
                >
                  <Expand className="size-3" /> 查看
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleKeep}
          disabled={isPending || selectedCount === 0}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {isPending ? "处理中…" : `批量保留${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
        <button
          onClick={handleTrash}
          disabled={isPending || selectedCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
          {isPending ? "处理中…" : `批量删除${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
      </div>
    </div>
  );
}
