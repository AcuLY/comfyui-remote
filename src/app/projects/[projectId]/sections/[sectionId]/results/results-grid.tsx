"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { ResultsGalleryProvider } from "./results-gallery";

const RUN_STATUS_BADGE: Record<string, string> = {
  done: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  running: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  queued: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  failed: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

type RunData = {
  id: string;
  runIndex: number;
  status: string;
  createdAt: string;
  images: {
    id: string;
    src: string;
    full: string;
    status: string;
    featured: boolean;
  }[];
};

export function ResultsGrid({ runs }: { runs: RunData[] }) {
  // Flatten all images for the lightbox
  const allImages = runs.flatMap((run) =>
    run.images.map((img) => ({
      ...img,
      runIndex: run.runIndex,
    }))
  );

  return (
    <ResultsGalleryProvider allImages={allImages}>
      {({ openLightbox, isFeatured }) => (
        <div className="space-y-6">
          {runs.map((run) => (
            <div key={run.id}>
              {/* Run header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  Run #{run.runIndex}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {run.createdAt}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.queued
                  }`}
                >
                  {run.status}
                </span>
              </div>

              {/* Image grid */}
              {run.images.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-zinc-600">
                  无图片
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                  {run.images.map((img) => {
                    const globalIndex = allImages.findIndex(
                      (a) => a.id === img.id
                    );
                    const featured = isFeatured(img.id);
                    return (
                      <div
                        key={img.id}
                        className={`group relative cursor-pointer overflow-hidden rounded-xl border transition hover:border-sky-500/40 ${
                          img.status === "kept"
                            ? "border-emerald-500/30"
                            : "border-white/10"
                        }`}
                        onClick={() => openLightbox(globalIndex)}
                      >
                        <Image
                          src={img.src}
                          alt=""
                          width={200}
                          height={280}
                          className="aspect-[3/4] w-full object-cover"
                          unoptimized
                        />
                        {featured && (
                          <div className="absolute left-1 top-1">
                            <Star className="size-3.5 fill-amber-400 text-amber-400 drop-shadow" />
                          </div>
                        )}
                        {img.status === "pending" && (
                          <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 py-0.5 text-center text-[8px] font-medium text-white">
                            待审
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ResultsGalleryProvider>
  );
}
