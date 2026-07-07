"use client";

import { useEffect, useState, useTransition, useId } from "react";
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
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Trash2,
  Square,
  Play,
} from "lucide-react";
import { moveProjectSectionsToFolder } from "@/lib/actions/section-folder";
import { deleteSections, reorderSections } from "@/lib/actions/section";
import { runSections } from "@/lib/actions/run-execution";
import { normalizeBatchRunBatchSize } from "@/lib/section-batch-run";
import { buildGroupedDragOrder, mergeVisibleOrderIntoAllIds } from "@/lib/section-list-ordering";
import { toast } from "sonner";
import { showRunSubmissionToast } from "@/lib/run-submission-toast";
import type { FolderItem } from "@/lib/server-data";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { BatchActionBar, MoveToFolderButton } from "@/app/assets/presets/folder-components";
import {
  ProjectSectionCompactCard,
  ProjectSectionExpandedCard,
  type ProjectSectionCardData,
} from "../project-section-card-components";
import { SectionRunButton } from "./project-detail-actions";
import { CopySectionButton, DeleteSectionButton } from "./section-actions";

export type Section = ProjectSectionCardData;

type SectionCardsProps = {
  projectId: string;
  sections: Section[];
  allSectionIds?: string[];
  folders?: FolderItem[];
  compact: boolean;
  setCardRef: (id: string, el: HTMLDivElement | null) => void;
};

export function SectionCards({
  projectId,
  sections: initialSections,
  allSectionIds,
  folders = [],
  compact,
  setCardRef,
}: SectionCardsProps) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunningSelected, setIsRunningSelected] = useState(false);
  const [batchRunBatchSize, setBatchRunBatchSize] = useState("");
  const dndId = useId();
  const batchRunBatchSizeInputId = `${dndId}-batch-run-batch-size`;
  const batchRunBatchSizeState = normalizeBatchRunBatchSize(batchRunBatchSize);

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

    const visibleIds = sections.map((section) => section.id);
    const nextVisibleIds = buildGroupedDragOrder({
      visibleIds,
      selectedIds,
      activeId: String(active.id),
      overId: String(over.id),
    });
    if (nextVisibleIds.every((id, index) => id === visibleIds[index])) return;

    const oldSections = sections;
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const newSections = nextVisibleIds
      .map((id) => sectionById.get(id))
      .filter((section): section is Section => Boolean(section));
    setSections(newSections);
    const reorderIds =
      allSectionIds && allSectionIds.length > 0
        ? mergeVisibleOrderIntoAllIds({ allIds: allSectionIds, visibleIds: nextVisibleIds })
        : nextVisibleIds;

    startTransition(async () => {
      try {
        const result = await reorderSections(projectId, reorderIds);
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

  function handleBatchRun() {
    if (selectedIds.size === 0) return;
    if (!batchRunBatchSizeState.isValid) return;
    const idsToRun = sections.filter((section) => selectedIds.has(section.id)).map((section) => section.id);
    const overrideBatchSize = batchRunBatchSizeState.overrideBatchSize;
    setIsRunningSelected(true);
    startTransition(async () => {
      try {
        const result = await runSections(idsToRun, overrideBatchSize);
        setSelectedIds(new Set());
        router.refresh();
        showRunSubmissionToast(
          result,
          overrideBatchSize
            ? `已提交 ${idsToRun.length} 个小节运行 (batch ${overrideBatchSize})`
            : `已提交 ${idsToRun.length} 个小节运行`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "批量运行失败");
      } finally {
        setIsRunningSelected(false);
      }
    });
  }

  function handleMoveSections(sectionIds: string[], folderId: string | null) {
    if (sectionIds.length === 0) return;
    startTransition(async () => {
      try {
        await moveProjectSectionsToFolder(projectId, sectionIds, folderId);
        setSelectedIds(new Set());
        router.refresh();
        toast.success(`已移动 ${sectionIds.length} 个小节`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "移动失败");
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
      {sections.length > 0 && selectedIds.size === 0 && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
          >
            <Square className="size-3.5" />
            全选当前列表
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <BatchActionBar
            selectedCount={selectedIds.size}
            totalCount={sections.length}
            folders={folders}
            onMoveToFolder={(folderId) => handleMoveSections([...selectedIds], folderId)}
            onSelectAll={selectAll}
            onClearSelection={deselectAll}
          />
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <label htmlFor={batchRunBatchSizeInputId} className="text-[10px] uppercase text-zinc-500">
              Batch
            </label>
            <input
              id={batchRunBatchSizeInputId}
              type="number"
              min={1}
              inputMode="numeric"
              value={batchRunBatchSize}
              onChange={(event) => setBatchRunBatchSize(event.target.value)}
              disabled={isRunningSelected || isDeleting}
              placeholder="跟随"
              aria-invalid={!batchRunBatchSizeState.isValid}
              className={`input-number w-16 rounded-md border bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none transition disabled:opacity-50 ${
                batchRunBatchSizeState.isValid
                  ? "border-white/10 focus:border-sky-500/30"
                  : "border-rose-500/50 focus:border-rose-400/60"
              }`}
            />
            <BatchSizeQuickFill
              onSelect={(value) => setBatchRunBatchSize(String(value))}
              currentValue={batchRunBatchSizeState.overrideBatchSize}
              disabled={isRunningSelected || isDeleting}
              showClear={batchRunBatchSize !== ""}
              onClear={() => setBatchRunBatchSize("")}
              size="sm"
            />
          </div>
          <button
            type="button"
            disabled={isRunningSelected || isDeleting || !batchRunBatchSizeState.isValid}
            onClick={handleBatchRun}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Play className="size-3.5" />
            {isRunningSelected ? "提交中…" : "批量运行"}
          </button>
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
                <ProjectSectionCompactCard
                  key={section.id}
                  section={section}
                  projectId={projectId}
                  index={index}
                  setCardRef={setCardRef}
                  isSelected={selectedIds.has(section.id)}
                  onToggleSelect={toggleSelect}
                  folderControl={
                    <MoveToFolderButton
                      currentFolderId={section.folderId}
                      folders={folders}
                      onMove={(folderId) => handleMoveSections([section.id], folderId)}
                    />
                  }
                />
              ) : (
                <ProjectSectionExpandedCard
                  key={section.id}
                  section={section}
                  projectId={projectId}
                  index={index}
                  setCardRef={setCardRef}
                  isSelected={selectedIds.has(section.id)}
                  onToggleSelect={toggleSelect}
                  actionControls={
                    <>
                      <MoveToFolderButton
                        currentFolderId={section.folderId}
                        folders={folders}
                        onMove={(folderId) => handleMoveSections([section.id], folderId)}
                      />
                      <CopySectionButton sectionId={section.id} />
                      <DeleteSectionButton
                        sectionId={section.id}
                        sectionName={section.name}
                        onDeleted={(deletedId) =>
                          setSections((prev) => prev.filter((item) => item.id !== deletedId))
                        }
                      />
                    </>
                  }
                  footerActions={
                    <SectionRunButton projectId={projectId} sectionId={section.id} defaultBatchSize={section.batchSize} />
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
