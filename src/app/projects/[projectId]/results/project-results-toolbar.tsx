"use client";

import {
  Eye,
  ImageIcon,
  Shield,
  Star,
  Trash2,
} from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  PROJECT_RESULT_FILTER_OPTIONS,
  type ProjectResultFilter,
  type ProjectResultFilterCounts,
} from "./use-project-results-filter-state";

function ProjectResultFilterIcon({ filter }: { filter: ProjectResultFilter }) {
  if (filter === "featured") {
    return <Star className="size-3.5" />;
  }
  if (filter === "featured2") {
    return <Eye className="size-3.5" />;
  }
  return <ImageIcon className="size-3.5" />;
}

function ProjectResultFilterControl({
  value,
  onChange,
  counts,
}: {
  value: ProjectResultFilter;
  onChange: (value: ProjectResultFilter) => void;
  counts: ProjectResultFilterCounts;
}) {
  return (
    <div
      className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.035] p-1 sm:order-none sm:w-auto"
      role="group"
      aria-label="筛选展示图片类型"
    >
      {PROJECT_RESULT_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-result-filter={option.value}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition ${
              active
                ? "bg-sky-500/20 text-sky-100"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            }`}
          >
            <ProjectResultFilterIcon filter={option.value} />
            <span>{option.label}</span>
            <span className="min-w-4 rounded bg-black/20 px-1 text-center text-[10px] text-zinc-300">
              {counts[option.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ProjectResultsToolbar({
  projectTitle,
  sectionCount,
  totalImages,
  totalKept,
  totalPending,
  totalFeatured,
  totalFeatured2,
  hasCover,
  resultFilter,
  onResultFilterChange,
  resultFilterCounts,
  showCensoredMode,
  onToggleCensoredMode,
  isTrashingAll,
  onTrashAllImages,
}: {
  projectTitle: string;
  sectionCount: number;
  totalImages: number;
  totalKept: number;
  totalPending: number;
  totalFeatured: number;
  totalFeatured2: number;
  hasCover: boolean;
  resultFilter: ProjectResultFilter;
  onResultFilterChange: (value: ProjectResultFilter) => void;
  resultFilterCounts: ProjectResultFilterCounts;
  showCensoredMode: boolean;
  onToggleCensoredMode: () => void;
  isTrashingAll: boolean;
  onTrashAllImages: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[var(--bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <div className="min-w-[10rem] flex-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <ImageIcon className="size-3.5" />
          <span>项目结果</span>
        </div>
        <h1 className="truncate text-sm font-semibold text-white">
          {projectTitle}
        </h1>
      </div>
      <div className="hidden shrink-0 items-center gap-2 text-[11px] text-zinc-500 sm:flex">
        <span>{sectionCount} 小节</span>
        <span className="text-emerald-300">{totalKept} 保留</span>
        <span className={totalPending > 0 ? "text-amber-400" : undefined}>
          {totalPending} 待审
        </span>
        <span>{totalFeatured} p站</span>
        <span>{totalFeatured2} 预览</span>
        {hasCover && <span>已设封面</span>}
      </div>
      <ProjectResultFilterControl
        value={resultFilter}
        onChange={onResultFilterChange}
        counts={resultFilterCounts}
      />
      <button
        type="button"
        onClick={onToggleCensoredMode}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          showCensoredMode
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
        }`}
      >
        <Shield className="size-3.5" />
        {showCensoredMode ? "显示打码版" : "显示原图"}
      </button>
      <button
        type="button"
        disabled={isTrashingAll || totalImages === 0}
        onClick={onTrashAllImages}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40 sm:px-3 sm:text-xs"
        title="删除全部图片"
      >
        <Trash2 className="size-3.5" />
        {isTrashingAll ? "删除中" : "删除全部"}
      </button>
    </div>
  );
}
