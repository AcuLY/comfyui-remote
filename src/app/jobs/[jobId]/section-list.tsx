"use client";

import { useState, useTransition, useRef, useEffect, useId } from "react";
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
import { GripVertical, Layers, Pencil, Check, X } from "lucide-react";
import { reorderSections, renameSection } from "@/lib/actions";
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
      className={`rounded-2xl border border-white/10 bg-white/[0.03] ${isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""}`}
    >
      <div className="flex items-start gap-3 p-4">
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white transition group-hover:text-sky-300">
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
            </div>
          </div>
        </Link>

        {/* 运行按钮（不触发点击跳转） */}
        <div onClick={(e) => e.stopPropagation()}>
          <PositionRunButton positionId={section.id} defaultBatchSize={section.batchSize} />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2">
        <SectionNameEditor sectionId={section.id} initialName={section.name} />
        <div className="flex-1" />
        <CopySectionButton sectionId={section.id} />
        <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
      </div>
    </div>
  );
}

function SectionNameEditor({
  sectionId,
  initialName,
}: {
  sectionId: string;
  initialName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleSave() {
    if (name.trim() === initialName) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      await renameSection(sectionId, name.trim());
      setIsEditing(false);
    });
  }

  function handleCancel() {
    setName(initialName);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isPending}
          className="w-32 rounded-lg border border-sky-500/30 bg-black/30 px-2 py-1 text-xs text-white outline-none"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded p-0.5 text-emerald-400 transition hover:bg-emerald-500/20"
        >
          <Check className="size-3.5" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="rounded p-0.5 text-zinc-400 transition hover:bg-white/10"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
    >
      <Pencil className="size-3" />
      重命名
    </button>
  );
}
