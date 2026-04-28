"use client";

import { useState, useTransition, useEffect, useId, useRef, useCallback } from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImageIcon,
  LayoutList,
  LayoutGrid,
  CheckSquare,
  Square,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { reorderSections, deleteSections } from "@/lib/actions";
import { toast } from "sonner";
import { SectionRunButton } from "./project-detail-actions";
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
  projectId: string;
  sections: Section[];
};

const MAIN_SCROLL_ID = "app-main-scroll";
const PROJECT_SECTION_ANCHOR_PREFIX = "comfyui-manager:project-section-anchor:";

type StoredSectionAnchor = {
  sectionId: string;
  offsetTop: number;
};

// ---------------------------------------------------------------------------
// Status dot color helper
// ---------------------------------------------------------------------------

function statusDotClass(status: string | null): string {
  if (!status || status === "未运行") return "bg-zinc-500";
  if (status === "completed" || status === "成功") return "bg-emerald-400";
  if (status === "running" || status === "运行中") return "bg-amber-400 animate-pulse";
  if (status === "failed" || status === "失败") return "bg-red-400";
  return "bg-zinc-500";
}

// ---------------------------------------------------------------------------
// Main list
// ---------------------------------------------------------------------------

export function SectionList({ projectId, sections: initialSections }: SectionListProps) {
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [compact, setCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [anchorNavCollapsed, setAnchorNavCollapsed] = useState(false);

  // Scroll to section card when arriving via hash fragment (e.g. from back navigation)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  }, []);

  // Preserve the top visible section on project detail pages. This is more
  // stable than raw scrollTop when thumbnails or card heights change.
  useEffect(() => {
    if (window.location.hash) {
      return;
    }

    const scrollElement = document.getElementById(MAIN_SCROLL_ID);
    if (!scrollElement) {
      return;
    }

    const storageKey = `${PROJECT_SECTION_ANCHOR_PREFIX}${projectId}`;

    const saveAnchor = () => {
      const containerRect = scrollElement.getBoundingClientRect();
      let bestAnchor: StoredSectionAnchor | null = null;

      for (const [sectionId, element] of cardRefs.current) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;

        if (!isVisible) {
          continue;
        }

        if (!bestAnchor || rect.top < containerRect.top + bestAnchor.offsetTop) {
          bestAnchor = {
            sectionId,
            offsetTop: rect.top - containerRect.top,
          };
        }
      }

      if (bestAnchor) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(bestAnchor));
      }
    };

    const restoreAnchor = () => {
      const rawAnchor = window.sessionStorage.getItem(storageKey);
      if (!rawAnchor) {
        return;
      }

      let anchor: StoredSectionAnchor | null = null;
      try {
        anchor = JSON.parse(rawAnchor) as StoredSectionAnchor;
      } catch {
        window.sessionStorage.removeItem(storageKey);
        return;
      }

      const element = cardRefs.current.get(anchor.sectionId);
      if (!element) {
        return;
      }

      const containerRect = scrollElement.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      scrollElement.scrollTop += elementRect.top - containerRect.top - anchor.offsetTop;
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(restoreAnchor);
    });

    scrollElement.addEventListener("scroll", saveAnchor, { passive: true });

    return () => {
      saveAnchor();
      scrollElement.removeEventListener("scroll", saveAnchor);
    };
  }, [projectId, sections]);

  const dndId = useId();

  // Ref map: section id → DOM node, for scroll anchoring
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  function scrollToSection(id: string) {
    const element = cardRefs.current.get(id) ?? document.getElementById(`section-${id}`);
    if (!element) return;
    element.scrollIntoView({ block: "start", behavior: "smooth" });
    window.history.replaceState(null, "", `#section-${id}`);
  }

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

  // -----------------------------------------------------------------------
  // Toggle with scroll anchoring
  // -----------------------------------------------------------------------

  function findAnchorId(): string | null {
    const viewportCenter = window.innerHeight / 2;
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const [id, el] of cardRefs.current) {
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      const dist = Math.abs(cardCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    }
    return bestId;
  }

  function handleToggle() {
    const anchorId = findAnchorId();
    setSelectedIds(new Set());
    setCompact((prev) => !prev);

    // After React re-renders, scroll the anchor card into view
    if (anchorId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = cardRefs.current.get(anchorId);
          if (el) {
            el.scrollIntoView({ block: "center", behavior: "instant" });
          }
        });
      });
    }
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
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteSections([...selectedIds]);
        setSelectedIds(new Set());
        toast.success(`已删除 ${selectedIds.size} 个小节`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      } finally {
        setIsDeleting(false);
      }
    });
  }

  return (
    <div
      className={
        anchorNavCollapsed
          ? "grid grid-cols-[2rem_minmax(0,1fr)] gap-1.5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-2"
          : "grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] lg:grid-cols-[9.5rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)]"
      }
    >
      {sections.length > 0 && (
        <aside className={`min-w-0 border-r border-white/5 bg-black/10 ${anchorNavCollapsed ? "pr-0" : "pr-1"}`}>
          <div className="sticky top-4 space-y-3">
            <button
              type="button"
              onClick={handleToggle}
              className={`flex w-full items-center gap-2 border-b border-white/10 pb-3 pt-1 text-left text-xs text-zinc-300 transition hover:text-white ${anchorNavCollapsed ? "justify-center px-0" : "px-2"}`}
              title={compact ? "展开视图" : "紧凑视图"}
            >
              {compact ? <LayoutGrid className="size-4 shrink-0" /> : <LayoutList className="size-4 shrink-0" />}
            </button>
            <div className="space-y-2">
              <div className={`flex items-center gap-2 ${anchorNavCollapsed ? "justify-center px-0" : "justify-between px-2"}`}>
                {!anchorNavCollapsed && (
                  <div className="min-w-0 truncate text-xs font-medium text-zinc-200 hidden sm:block">小节导航</div>
                )}
                <button
                  type="button"
                  onClick={() => setAnchorNavCollapsed((prev) => !prev)}
                  className="rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
                  title={anchorNavCollapsed ? "展开小节导航" : "收起小节导航"}
                  aria-label={anchorNavCollapsed ? "展开小节导航" : "收起小节导航"}
                >
                  {anchorNavCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
                </button>
              </div>
              {!anchorNavCollapsed && (
                <div>
                  {sections.map((section, index) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                    className="flex w-full items-start gap-0.5 py-1 pl-0 text-left text-[11px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
                      title={`${index + 1}. ${section.name}`}
                    >
                      <span className="w-3.5 shrink-0 text-right text-zinc-600">{index + 1}</span>
                      <span className="line-clamp-2 min-w-0 flex-1 break-words leading-4">{section.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      <div className="min-w-0">
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={rectSortingStrategy}>
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
            <div className={`${compact ? "grid grid-cols-1 gap-1.5 justify-items-center md:grid-cols-2" : "grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2"} ${isPending ? "opacity-60" : ""}`}>
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
                  />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact card (slim single-line row)
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
      className={`group flex items-center gap-2 w-full rounded-xl border bg-white/[0.03] px-3 py-2.5 md:max-w-[500px] ${isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""} ${isSelected ? "border-sky-500/40 ring-1 ring-sky-500/20" : "border-white/10"}`}
    >
      {/* Selection checkbox */}
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

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-0.5 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-400 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Clickable area → section detail */}
      <Link
        href={`/projects/${projectId}/sections/${section.id}`}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span className="shrink-0 text-xs font-semibold text-white">
          {index + 1}. {section.name}
        </span>
      </Link>

      {/* Status + image count */}
      <div className="flex shrink-0 items-center gap-2">
        {section.latestImages.length > 0 && (
          <span className="text-[10px] text-zinc-500">
            {section.latestImages.length}张
          </span>
        )}
        <span className={`size-2 rounded-full ${statusDotClass(section.latestRunStatus)}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full expanded card (original)
// ---------------------------------------------------------------------------

function SortableSectionCard({
  section,
  projectId,
  index,
  setCardRef,
}: {
  section: Section;
  projectId: string;
  index: number;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
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
      className={`w-full rounded-xl border border-white/10 bg-white/[0.03] p-2.5 md:max-w-[500px] ${isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""}`}
    >
      {/* 主内容区：拖动手柄 + 信息 */}
      <div className="flex items-center gap-3">
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
          href={`/projects/${projectId}/sections/${section.id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <span className="text-xs font-medium text-white line-clamp-2 sm:text-sm">
            {index + 1}. {section.name}
          </span>
        </Link>

        {/* 复制、删除按钮 */}
        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <CopySectionButton sectionId={section.id} />
          <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
        </div>
      </div>

      {/* 结果预览：缩略图条 */}
      {section.latestImages.length > 0 ? (
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
                className={`flex h-[72px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition hover:border-sky-500/40 ${
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
                  height={72}
                  className="h-[72px] w-auto object-contain"
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
      ) : (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01] py-4 text-[11px] text-zinc-600">
            暂无结果
          </div>
        </div>
      )}

      {/* 操作按钮区：运行控件 + 移动端的复制/删除 */}
      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionRunButton sectionId={section.id} defaultBatchSize={section.batchSize} />
      </div>
    </div>
  );
}
