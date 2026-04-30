"use client";

import { useEffect, useState, useTransition, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImageIcon,
  CheckSquare,
  Square,
  Trash2,
} from "lucide-react";
import { reorderSections, deleteSections } from "@/lib/actions";
import { toast } from "sonner";
import { SectionRunButton } from "./project-detail-actions";
import { CopySectionButton, DeleteSectionButton } from "./section-actions";

export type Section = {
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
  latestImageCount: number;
  pendingImageCount: number;
};

type SectionCardsProps = {
  projectId: string;
  sections: Section[];
  compact: boolean;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
};

function statusDotClass(status: string | null): string {
  if (!status || status === "未运行") return "bg-zinc-500";
  if (status === "completed" || status === "成功") return "bg-emerald-400";
  if (status === "running" || status === "运行中") return "bg-amber-400 animate-pulse";
  if (status === "failed" || status === "失败") return "bg-red-400";
  return "bg-zinc-500";
}

export function SectionCards({ projectId, sections: initialSections, compact, setCardRef }: SectionCardsProps) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const dndId = useId();

  useEffect(() => {
    setSections(initialSections);
    setSelectedIds((prev) => {
      const visibleIds = new Set(initialSections.map((section) => section.id));
      return new Set([...prev].filter((id) => visibleIds.has(id)));
    });
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

    const oldSections = sections;
    const newSections = arrayMove(sections, oldIndex, newIndex);
    setSections(newSections);

    startTransition(async () => {
      try {
        const result = await reorderSections(
          projectId,
          newSections.map((s) => s.id),
        );
        if (!result.ok) {
          setSections(oldSections);
          toast.error(result.message);
        }
      } catch (err) {
        setSections(oldSections);
        toast.error(err instanceof Error ? err.message : "排序失败");
      }
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(sections.map((s) => s.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个小节吗？此操作不可撤销。`)) return;
    const idsToDelete = [...selectedIds];
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteSections(idsToDelete);
        setSections((prev) => prev.filter((section) => !idsToDelete.includes(section.id)));
        setSelectedIds(new Set());
        router.refresh();
        toast.success(`已删除 ${selectedIds.size} 个小节`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      } finally {
        setIsDeleting(false);
      }
    });
  }

  return (
    <>
      {compact && sections.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectedIds.size === sections.length ? deselectAll : selectAll}
              className="flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
            >
              {selectedIds.size === sections.length ? (
                <CheckSquare className="size-3.5 text-sky-400" />
              ) : (
                <Square className="size-3.5" />
              )}
              {selectedIds.size === sections.length ? "取消全选" : "全选"}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs text-zinc-500">已选 {selectedIds.size} 项</span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              {isDeleting ? "删除中…" : "删除"}
            </button>
          )}
        </div>
      )}

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div
            className={`${
              compact
                ? "grid grid-cols-1 gap-1.5 justify-items-center md:grid-cols-2"
                : "grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2"
            } ${isPending ? "opacity-60" : ""}`}
          >
            {sections.map((section, index) =>
              compact ? (
                <SortableCompactCard
                  key={section.id}
                  section={section}
                  projectId={projectId}
                  index={index}
                  setCardRef={setCardRef}
                  isSelected={selectedIds.has(section.id)}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  projectId={projectId}
                  index={index}
                  setCardRef={setCardRef}
                  onDeleted={(deletedId) =>
                    setSections((prev) => prev.filter((item) => item.id !== deletedId))
                  }
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

// ---------------------------------------------------------------------------
// Compact card
// ---------------------------------------------------------------------------

function SortableCompactCard({
  section,
  projectId,
  index,
  setCardRef,
  isSelected,
  onToggleSelect,
}: {
  section: Section;
  projectId: string;
  index: number;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
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

      <Link
        href={`/projects/${projectId}/sections/${section.id}`}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="min-w-0 text-xs font-semibold text-white line-clamp-2">
          {index + 1}. {section.name}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
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

// ---------------------------------------------------------------------------
// Full expanded card
// ---------------------------------------------------------------------------

function SortableSectionCard({
  section,
  projectId,
  index,
  setCardRef,
  onDeleted,
}: {
  section: Section;
  projectId: string;
  index: number;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
  onDeleted: (sectionId: string) => void;
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
      className={`w-full rounded-xl border border-white/10 bg-white/[0.03] p-2.5 md:max-w-[500px] ${
        isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        <Link
          href={`/projects/${projectId}/sections/${section.id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <span className="text-xs font-medium text-white line-clamp-2 sm:text-sm">
            {index + 1}. {section.name}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <CopySectionButton sectionId={section.id} />
          <DeleteSectionButton
            sectionId={section.id}
            sectionName={section.name}
            onDeleted={onDeleted}
          />
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
              <Link
                href={`/projects/${projectId}/sections/${section.id}/results`}
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
                className={`flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--panel-soft)] transition hover:border-sky-500/40 ${
                  img.status === "kept"
                    ? "border-emerald-500/30"
                    : img.status === "trashed"
                      ? "border-rose-500/20 opacity-40"
                      : "border-white/10"
                }`}
              >
                <img
                  src={img.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-auto object-contain"
                />
                {img.status === "kept" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-px text-center text-[8px] text-white">
                    kept
                  </div>
                )}
              </Link>
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
        onClick={(e) => e.stopPropagation()}
      >
        <SectionRunButton sectionId={section.id} defaultBatchSize={section.batchSize} />
      </div>
    </div>
  );
}
