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
import { GripVertical, Layers } from "lucide-react";
import { reorderSections } from "@/lib/actions";
import { PositionRunButton } from "./job-detail-actions";
import { CopySectionButton, DeleteSectionButton } from "./section-actions";

type Section = {
  id: string;
  name: string;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy: string | null;
  latestRunStatus: string | null;
  promptBlockCount: number;
  positiveBlockCount: number;
  negativeBlockCount: number;
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
          <div className="flex items-center gap-2">
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
            {section.seedPolicy ?? "—"} · {section.latestRunStatus ?? "未运行"}
          </div>
        </Link>

        {/* 操作按钮组：运行、复制、删除 */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <PositionRunButton positionId={section.id} defaultBatchSize={section.batchSize} />
          <CopySectionButton sectionId={section.id} />
          <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
        </div>
      </div>
    </div>
  );
}
