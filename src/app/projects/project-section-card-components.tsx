"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquare,
  GripVertical,
  ImageIcon,
  Square,
} from "lucide-react";

import { HardNavigationLink } from "@/components/hard-navigation-link";

export type ProjectSectionCardData = {
  id: string;
  name: string;
  folderId: string | null;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  latestRunStatus: string | null;
  latestRunId: string | null;
  promptBlockCount: number;
  positiveBlockCount: number;
  negativeBlockCount: number;
  latestImages: { id: string; src: string; status: string }[];
  latestImageCount: number;
  pendingImageCount: number;
};

type ProjectSectionCardCommonProps = {
  section: ProjectSectionCardData;
  projectId: string;
  index: number;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
};

function statusDotClass(status: string | null): string {
  if (!status || status === "未运行") return "bg-zinc-500";
  if (status === "completed" || status === "成功") return "bg-emerald-400";
  if (status === "running" || status === "运行中") return "bg-amber-400 animate-pulse";
  if (status === "failed" || status === "失败") return "bg-red-400";
  return "bg-zinc-500";
}

export function ProjectSectionCompactCard({
  section,
  projectId,
  index,
  setCardRef,
  isSelected,
  onToggleSelect,
  folderControl,
}: ProjectSectionCardCommonProps & {
  folderControl: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        setCardRef(section.id, el);
      }}
      style={style}
      id={`section-${section.id}`}
      className={`group flex items-center gap-2 w-full rounded-xl border bg-white/[0.03] px-3 py-2.5 md:max-w-[500px] ${
        isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""
      } ${isSelected ? "border-sky-500/40 ring-1 ring-sky-500/20" : "border-white/10"}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleSelect(section.id);
        }}
        className="shrink-0 rounded p-0.5 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-400"
      >
        {isSelected ? (
          <CheckSquare className="size-3.5 text-sky-400" />
        ) : (
          <Square className="size-3.5" />
        )}
      </button>

      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-0.5 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-400 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>

      <HardNavigationLink
        href={`/projects/${projectId}/sections/${section.id}`}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="min-w-0 text-xs font-semibold text-white line-clamp-2">
          {index + 1}. {section.name}
        </span>
      </HardNavigationLink>

      <div className="flex shrink-0 items-center gap-2">
        {folderControl}
        {section.latestImages.length > 0 && (
          <span className="text-[10px] text-zinc-500">
            {section.latestImageCount}张
          </span>
        )}
        <span className={`size-2 rounded-full ${statusDotClass(section.latestRunStatus)}`} />
      </div>
    </div>
  );
}

export function ProjectSectionExpandedCard({
  section,
  projectId,
  index,
  setCardRef,
  isSelected,
  onToggleSelect,
  actionControls,
  footerActions,
}: ProjectSectionCardCommonProps & {
  actionControls: ReactNode;
  footerActions: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        setCardRef(section.id, el);
      }}
      style={style}
      id={`section-${section.id}`}
      className={`w-full rounded-xl border bg-white/[0.03] p-2.5 md:max-w-[500px] ${
        isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""
      } ${isSelected ? "border-sky-500/40 ring-1 ring-sky-500/20" : "border-white/10"}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelect(section.id);
          }}
          className="mt-1 shrink-0 rounded p-1 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-300"
          title={isSelected ? "取消选择" : "选择小节"}
        >
          {isSelected ? (
            <CheckSquare className="size-4 text-sky-400" />
          ) : (
            <Square className="size-4" />
          )}
        </button>

        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        <HardNavigationLink
          href={`/projects/${projectId}/sections/${section.id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <span className="text-xs font-medium text-white line-clamp-2 sm:text-sm">
            {index + 1}. {section.name}
          </span>
        </HardNavigationLink>

        <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          {actionControls}
        </div>
      </div>

      {section.latestImages.length > 0 ? (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <ImageIcon className="size-3" />
            <span>
              最近结果 · {section.latestImageCount} 张
              {section.pendingImageCount > 0 && (
                <span className="ml-1 text-amber-400">
                  ({section.pendingImageCount} 待审)
                </span>
              )}
            </span>
            {section.latestRunId && (
              <HardNavigationLink
                href={`/projects/${projectId}/sections/${section.id}/results`}
                className="ml-auto text-sky-400 hover:text-sky-300"
                onClick={(event) => event.stopPropagation()}
              >
                查看全部
              </HardNavigationLink>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {section.latestImages.slice(0, 8).map((img) => (
              <HardNavigationLink
                key={img.id}
                href={section.latestRunId ? `/queue/${section.latestRunId}` : "#"}
                onClick={(event) => event.stopPropagation()}
                className={`flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--panel-soft)] transition hover:border-sky-500/40 ${
                  img.status === "kept"
                    ? "border-emerald-500/30"
                    : img.status === "trashed"
                      ? "border-rose-500/20 opacity-40"
                      : "border-white/10"
                }`}
              >
                <Image
                  src={img.src}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                  unoptimized
                  className="h-full w-auto object-contain"
                />
                {img.status === "kept" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-px text-center text-[8px] text-white">
                    kept
                  </div>
                )}
              </HardNavigationLink>
            ))}
            {section.latestImageCount > 8 && (
              <div className="flex shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] text-zinc-500">
                +{section.latestImageCount - 8}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01] py-4 text-[11px] text-zinc-600">
            暂无结果
          </div>
        </div>
      )}

      <div
        className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2"
        onClick={(event) => event.stopPropagation()}
      >
        {footerActions}
      </div>
    </div>
  );
}
