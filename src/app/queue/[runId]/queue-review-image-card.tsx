"use client";

import Image from "next/image";
import { Check, Eye, ImageIcon, Star } from "lucide-react";
import type { ReviewImage } from "@/lib/types";

type QueueReviewImageCardProps = {
  image: ReviewImage;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (index: number) => void;
};

export function QueueReviewImageCard({
  image,
  index,
  isSelected,
  onToggleSelect,
  onOpen,
}: QueueReviewImageCardProps) {
  return (
    <div
      className={`group relative w-fit max-w-full overflow-hidden rounded-2xl border bg-[var(--panel-soft)] transition ${isSelected ? "border-sky-400/50 ring-2 ring-sky-400/30" : "border-white/10"}`}
    >
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleSelect(image.id)}
          className={`flex size-5 items-center justify-center rounded border text-[10px] transition ${isSelected ? "border-sky-400 bg-sky-500 text-white" : "border-white/20 bg-black/30 text-transparent hover:border-white/40"}`}
        >
          <Check className="size-3" />
        </button>
        <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
          {image.label}
        </span>
      </div>

      {(image.featured || image.featured2 || image.cover) && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1">
          {image.featured && (
            <Star className="size-4 fill-amber-400 text-amber-400 drop-shadow" />
          )}
          {image.featured2 && (
            <Eye className="size-4 rounded-full bg-cyan-400/90 p-0.5 text-zinc-950 shadow" />
          )}
          {image.cover && (
            <ImageIcon className="size-4 rounded-full bg-violet-400/90 p-0.5 text-zinc-950 shadow" />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpen(index)}
        className="block h-40 max-w-full bg-[var(--panel-soft)]"
      >
        <Image
          src={image.src}
          alt={image.id}
          width={400}
          height={560}
          loading="lazy"
          className="h-40 w-auto max-w-full object-contain"
          unoptimized
        />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-[10px] text-white">
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
      </div>
    </div>
  );
}
