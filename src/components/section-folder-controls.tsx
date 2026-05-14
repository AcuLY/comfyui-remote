"use client";

import { useId, useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Folder, FolderPlus, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  countFolderItems,
  FolderBreadcrumb,
  SortableFolderRow,
} from "@/app/assets/presets/folder-components";
import type { FolderItem } from "@/lib/server-data";

export type SectionFolderItem = FolderItem & {
  sectionCount?: number;
  childCount?: number;
};

export function SectionFolderControls({
  folders,
  items,
  currentFolderId,
  onNavigate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderFolders,
  onChanged,
}: {
  folders: SectionFolderItem[];
  items: Array<{ folderId: string | null }>;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => Promise<unknown>;
  onRenameFolder: (folderId: string, name: string) => Promise<unknown>;
  onDeleteFolder: (folderId: string) => Promise<unknown>;
  onReorderFolders: (parentId: string | null, ids: string[]) => Promise<unknown>;
  onChanged?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleFolders = useMemo(
    () => folders.filter((folder) => (folder.parentId ?? null) === currentFolderId),
    [folders, currentFolderId],
  );
  const breadcrumb = useMemo(() => {
    const path: SectionFolderItem[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }
    return path;
  }, [currentFolderId, folders]);

  function refresh() {
    onChanged?.();
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await onCreateFolder(currentFolderId, name);
        toast.success("文件夹已创建");
        setNewFolderName("");
        setIsCreatingFolder(false);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "创建文件夹失败");
      }
    });
  }

  function handleFolderDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleFolders.findIndex((folder) => folder.id === active.id);
    const newIndex = visibleFolders.findIndex((folder) => folder.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(visibleFolders, oldIndex, newIndex);
    startTransition(async () => {
      try {
        await onReorderFolders(currentFolderId, reordered.map((folder) => folder.id));
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "排序失败");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FolderBreadcrumb breadcrumb={breadcrumb} onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => setIsCreatingFolder(true)}
          className="inline-flex w-fit items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.08]"
        >
          <FolderPlus className="size-3" />
          新建文件夹
        </button>
      </div>

      {isCreatingFolder && (
        <div className="flex items-center gap-2">
          <Folder className="size-3.5 text-amber-400/60" />
          <input
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="文件夹名称"
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreateFolder();
              if (event.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={isPending || !newFolderName.trim()}
            className="rounded-lg bg-sky-500/20 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Save className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(false);
              setNewFolderName("");
            }}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/[0.06]"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleFolderDragEnd}
      >
        <SortableContext items={visibleFolders.map((folder) => folder.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleFolders.map((folder) => (
              <SortableFolderRow
                key={folder.id}
                folder={folder}
                itemCount={countFolderItems(folder.id, folders, items)}
                onEnter={() => onNavigate(folder.id)}
                onRename={(name) => {
                  startTransition(async () => {
                    try {
                      await onRenameFolder(folder.id, name);
                      toast.success("文件夹已重命名");
                      refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "重命名失败");
                    }
                  });
                }}
                onDelete={() => {
                  if (!confirm(`确认删除文件夹「${folder.name}」？`)) return;
                  startTransition(async () => {
                    try {
                      await onDeleteFolder(folder.id);
                      toast.success("文件夹已删除");
                      refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "删除失败");
                    }
                  });
                }}
                isPending={isPending}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
