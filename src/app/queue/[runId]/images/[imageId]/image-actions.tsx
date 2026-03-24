"use client";

import { useTransition } from "react";
import { keepImages, trashImages } from "@/lib/actions";

export function ImageActions({ imageId }: { imageId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => keepImages([imageId]))}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
      >
        {isPending ? "处理中…" : "保留"}
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => trashImages([imageId]))}
        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
      >
        {isPending ? "处理中…" : "删除"}
      </button>
    </div>
  );
}
