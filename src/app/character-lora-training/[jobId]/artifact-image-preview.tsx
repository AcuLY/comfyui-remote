"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export function ArtifactImagePreview({
  jobId,
  relativePath,
  alt,
  thumbnailOptions = { w: 360, q: 72 },
  buttonClassName = "block w-full text-left",
  imageClassName = "w-full rounded-lg border border-white/10 bg-black/30 object-cover",
  emptyClassName = "flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-xs text-zinc-600",
  emptyLabel = "无预览",
}: {
  jobId: string;
  relativePath: string | null | undefined;
  alt: string;
  thumbnailOptions?: { w?: number; q?: number };
  buttonClassName?: string;
  imageClassName?: string;
  emptyClassName?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  if (!relativePath) {
    return <div className={emptyClassName}>{emptyLabel}</div>;
  }

  const fullUrl = buildArtifactImageUrl(jobId, relativePath);
  const thumbnailUrl = buildArtifactImageUrl(jobId, relativePath, thumbnailOptions);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(false);
          setOpen(true);
        }}
        className={buttonClassName}
        title="打开大图预览"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- artifact images are served by the existing route. */}
        <img
          src={thumbnailUrl}
          alt={alt}
          loading="lazy"
          className={imageClassName}
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="候选图大图预览"
        >
          <div className="z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="min-w-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
              <span className="block truncate">{alt}</span>
              <span className="mt-0.5 block max-w-[70vw] truncate font-mono text-[10px] text-zinc-500">{relativePath}</span>
            </div>
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                close();
              }}
              title="关闭"
            >
              <X className="size-5" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4"
            onClick={(event) => event.stopPropagation()}
          >
            {!loaded ? (
              <div className="absolute inset-4 flex items-center justify-center">
                <div className="h-full max-h-[calc(100dvh-7rem)] w-full max-w-6xl animate-pulse rounded-xl bg-white/[0.08]" />
              </div>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- artifact images are served by the existing route. */}
            <img
              src={fullUrl}
              alt={alt}
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={`max-h-[calc(100dvh-7rem)] max-w-full rounded-xl object-contain drop-shadow-2xl transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function buildArtifactImageUrl(jobId: string, relativePath: string, options?: { w?: number; q?: number }) {
  const params = new URLSearchParams({ path: relativePath });
  if (options?.w) params.set("w", String(options.w));
  if (options?.q) params.set("q", String(options.q));
  return `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/artifacts/image?${params.toString()}`;
}
