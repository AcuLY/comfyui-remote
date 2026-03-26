"use client";

import { useState, useTransition, useEffect, useId } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Layers, ImageIcon } from "lucide-react";
import Image from "next/image";
import { reorderSections } from "@/lib/actions";
import { PositionRunButton } from "./job-detail-actions";
import { CopySectionButton, DeleteSectionButton } from "./section-actions";

type Section = {
  id: string;
  name: string;
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
};

type SectionListProps = {
  jobId: string;
  sections: Section[];
};

export function SectionList({ jobId, sections: initialSections }: SectionListProps) {
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const dndId = useId();

  // 当 props 更新时同步 state（例如添加/删除小节后）
  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    const newSections = arrayMove(sections, oldIndex, newIndex);
    setSections(newSections);

    // 服务端更新排序
    startTransition(async () => {
      await reorderSections(
        jobId,
        newSections.map((s) => s.id),
      );
    });
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className={`space-y-3 ${isPending ? "opacity-60" : ""}`}>
          {sections.map((section) => (
            <SortableSectionCard key={section.id} section={section} jobId={jobId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSectionCard({ section, jobId }: { section: Section; jobId: string }) {
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
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""}`}
    >
      {/* 主内容区：拖动手柄 + 信息 */}
      <div className="flex items-start gap-3">
        {/* 拖动手柄 */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        {/* 可点击进入编辑的区域 */}
        <Link
          href={`/jobs/${jobId}/positions/${section.id}/blocks`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {section.name}
            </span>
            {section.promptBlockCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                <Layers className="size-3" />
                正 {section.positiveBlockCount} · 负 {section.negativeBlockCount}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            batch {section.batchSize ?? "—"} · {section.aspectRatio ?? "—"} · seed{" "}
            {section.seedPolicy1 ?? "—"} · {section.latestRunStatus ?? "未运行"}
          </div>
        </Link>

        {/* 桌面端：复制、删除按钮（紧凑） */}
        <div className="hidden items-center gap-2 sm:flex" onClick={(e) => e.stopPropagation()}>
          <CopySectionButton sectionId={section.id} />
          <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
        </div>
      </div>

      {/* 结果预览：缩略图条 */}
      {section.latestImages.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <ImageIcon className="size-3" />
            <span>
              最近结果 · {section.latestImages.length} 张
              {section.latestImages.some((img) => img.status === "pending") && (
                <span className="ml-1 text-amber-400">
                  ({section.latestImages.filter((img) => img.status === "pending").length} 待审)
                </span>
              )}
            </span>
            {section.latestRunId && (
              <Link
                href={`/jobs/${jobId}/positions/${section.id}/results`}
                className="ml-auto text-sky-400 hover:text-sky-300"
                onClick={(e) => e.stopPropagation()}
              >
                查看全部
              </Link>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {section.latestImages.slice(0, 8).map((img) => (
              <Link
                key={img.id}
                href={section.latestRunId ? `/queue/${section.latestRunId}` : "#"}
                onClick={(e) => e.stopPropagation()}
                className={`relative shrink-0 overflow-hidden rounded-lg border transition hover:border-sky-500/40 ${
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
                  width={56}
                  height={80}
                  className="h-[80px] w-[56px] object-cover"
                  unoptimized
                />
                {img.status === "kept" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-px text-center text-[8px] text-white">
                    kept
                  </div>
                )}
              </Link>
            ))}
            {section.latestImages.length > 8 && (
              <div className="flex shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] px-3 text-[10px] text-zinc-500">
                +{section.latestImages.length - 8}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮区：运行控件 + 移动端的复制/删除 */}
      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <PositionRunButton positionId={section.id} defaultBatchSize={section.batchSize} />
        {/* 移动端：复制、删除按钮 */}
        <div className="flex items-center gap-2 sm:hidden">
          <CopySectionButton sectionId={section.id} />
          <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
        </div>
      </div>
    </div>
  );
}
