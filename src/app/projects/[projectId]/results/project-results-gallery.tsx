"use client";

import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  ImageIcon,
  Star,
} from "lucide-react";

import { HardNavigationLink } from "@/components/hard-navigation-link";
import type {
  ProjectResultsImageWithRun,
  ProjectResultsSection,
} from "./use-project-results-filter-state";

function ResultImageCard({
  image,
  onOpen,
  onToggleFeatured,
  onToggleFeatured2,
  onSetCover,
  disabled,
  showCensoredMode,
}: {
  image: ProjectResultsImageWithRun;
  onOpen: (imageId: string) => void;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  onToggleFeatured2: (imageId: string, featured2: boolean) => void;
  onSetCover: (imageId: string) => void;
  disabled: boolean;
  showCensoredMode?: boolean;
}) {
  const aspectRatio =
    image.width && image.height && image.width > 0 && image.height > 0
      ? `${image.width} / ${image.height}`
      : "1 / 1";

  return (
    <div
      style={{ aspectRatio }}
      className={`group relative flex w-full items-center justify-center overflow-hidden rounded-lg border bg-white/[0.03] transition hover:border-sky-500/40 ${
        image.status === "kept"
          ? "border-emerald-500/30"
          : image.status === "pending"
            ? "border-amber-500/20"
            : "border-white/10"
      }`}
    >
      <button
        type="button"
        className="flex size-full items-center justify-center"
        title="放大预览"
        onClick={() => onOpen(image.id)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={showCensoredMode && image.censoredSrc ? image.censoredSrc : image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain"
        />
        {showCensoredMode && !image.censoredSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-[10px] text-zinc-400">暂未打码</span>
          </div>
        )}
      </button>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || image.cover}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSetCover(image.id);
          }}
          className={`inline-flex size-7 items-center justify-center rounded-full border backdrop-blur transition disabled:opacity-50 ${
            image.cover
              ? "border-violet-300/40 bg-violet-400/25 text-violet-100"
              : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-violet-200"
          }`}
          title={image.cover ? "当前封面" : "设为封面"}
        >
          <ImageIcon className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFeatured2(image.id, !image.featured2);
          }}
          className={`inline-flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold backdrop-blur transition disabled:opacity-50 ${
            image.featured2
              ? "border-cyan-300/40 bg-cyan-400/25 text-cyan-100"
              : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-cyan-200"
          }`}
          title={image.featured2 ? "取消预览" : "标记为预览"}
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFeatured(image.id, !image.featured);
          }}
          className={`inline-flex size-7 items-center justify-center rounded-full border backdrop-blur transition disabled:opacity-50 ${
            image.featured
              ? "border-amber-300/40 bg-amber-400/25 text-amber-200"
              : "border-white/15 bg-black/40 text-white/70 hover:bg-white/15 hover:text-amber-200"
          }`}
          title={image.featured ? "取消p站" : "标记为p站"}
        >
          <Star
            className="size-3.5"
            fill={image.featured ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-1 text-[10px] text-zinc-200 opacity-90">
        <span>Run #{image.runIndex}</span>
        <span className="flex items-center gap-1">
          {image.featured && <span className="text-amber-200">p站</span>}
          {image.featured2 && <span className="text-cyan-200">预览</span>}
          {image.cover && <span className="text-violet-200">封面</span>}
        </span>
      </div>
    </div>
  );
}

function SectionResultsBlock({
  projectId,
  section,
  onToggleFeatured,
  onToggleFeatured2,
  onSetCover,
  onOpenImage,
  togglingImageId,
  isExpanded,
  onToggleExpanded,
  collapsedImageCount,
  showCensoredMode,
}: {
  projectId: string;
  section: ProjectResultsSection;
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  onToggleFeatured2: (imageId: string, featured2: boolean) => void;
  onSetCover: (imageId: string) => void;
  onOpenImage: (imageId: string) => void;
  togglingImageId: string | null;
  isExpanded: boolean;
  onToggleExpanded: (sectionId: string) => void;
  collapsedImageCount: number;
  showCensoredMode?: boolean;
}) {
  const images = section.runs.flatMap((run) =>
    run.images.map((image) => ({
      ...image,
      runIndex: run.runIndex,
    })),
  );
  const shouldCollapse = images.length > collapsedImageCount;
  const visibleImages =
    shouldCollapse && !isExpanded
      ? images.slice(0, collapsedImageCount)
      : images;
  const hasCover = images.some((image) => image.cover);

  return (
    <section
      id={`section-${section.id}`}
      className="scroll-mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-semibold text-white">
            {section.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{section.runCount} 次运行</span>
            <span className="text-emerald-300">{section.keptCount} 保留</span>
            <span className={section.pendingCount > 0 ? "text-amber-400" : undefined}>
              {section.pendingCount} 待审
            </span>
            {section.featuredCount > 0 && (
              <span className="text-amber-300">
                {section.featuredCount} p站
              </span>
            )}
            {section.featured2Count > 0 && (
              <span className="text-cyan-300">
                {section.featured2Count} 预览
              </span>
            )}
            {hasCover && (
              <span className="text-violet-300">
                封面
              </span>
            )}
          </div>
        </div>
        <HardNavigationLink
          href={`/projects/${projectId}/sections/${section.id}/results`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/20"
        >
          <ClipboardCheck className="size-3.5" />
          小节审核
        </HardNavigationLink>
      </div>

      {section.imageCount === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01] py-8 text-xs text-zinc-600">
          暂无结果
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] items-start gap-2">
            {visibleImages.map((image) => (
              <ResultImageCard
                key={image.id}
                image={image}
                onOpen={onOpenImage}
                onToggleFeatured={onToggleFeatured}
                onToggleFeatured2={onToggleFeatured2}
                onSetCover={onSetCover}
                disabled={togglingImageId === image.id}
                showCensoredMode={showCensoredMode}
              />
            ))}
          </div>
          {shouldCollapse && (
            <button
              type="button"
              onClick={() => onToggleExpanded(section.id)}
              className="mx-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  显示全部（剩余 {images.length - collapsedImageCount} 张）
                </>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function ProjectResultsGallery({
  projectId,
  sections,
  onToggleFeatured,
  onToggleFeatured2,
  onSetCover,
  onOpenImage,
  togglingImageId,
  expandedSectionIds,
  onToggleExpanded,
  collapsedImageCount,
  showCensoredMode,
}: {
  projectId: string;
  sections: ProjectResultsSection[];
  onToggleFeatured: (imageId: string, featured: boolean) => void;
  onToggleFeatured2: (imageId: string, featured2: boolean) => void;
  onSetCover: (imageId: string) => void;
  onOpenImage: (imageId: string) => void;
  togglingImageId: string | null;
  expandedSectionIds: Set<string>;
  onToggleExpanded: (sectionId: string) => void;
  collapsedImageCount: number;
  showCensoredMode?: boolean;
}) {
  return (
    <>
      {sections.map((section) => (
        <SectionResultsBlock
          key={section.id}
          projectId={projectId}
          section={section}
          onToggleFeatured={onToggleFeatured}
          onToggleFeatured2={onToggleFeatured2}
          onSetCover={onSetCover}
          onOpenImage={onOpenImage}
          togglingImageId={togglingImageId}
          isExpanded={expandedSectionIds.has(section.id)}
          onToggleExpanded={onToggleExpanded}
          collapsedImageCount={collapsedImageCount}
          showCensoredMode={showCensoredMode}
        />
      ))}
    </>
  );
}
