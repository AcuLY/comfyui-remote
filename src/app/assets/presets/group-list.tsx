"use client";

import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Folder, FolderPlus, Plus, Save, X } from "lucide-react";
import type { FolderItem, PresetCategoryFull } from "@/lib/server-data";
import {
  addGroupMember,
  createPresetFolder,
  createPresetGroup,
  deletePresetFolder,
  moveToFolder,
  renamePresetFolder,
  reorderPresetFolders,
  reorderPresetGroups,
} from "@/lib/actions";
import { toast } from "sonner";
import {
  BatchActionBar,
  countFolderItems,
  FolderBreadcrumb,
  SortableFolderRow,
} from "./folder-components";
import { GroupCreateForm } from "./group-create-form";
import { SortableGroupCard } from "./sortable-group-card";

const EMPTY_SELECTED_GROUP_IDS = new Set<string>();

// ---------------------------------------------------------------------------
// GroupList - right panel showing groups within a category
// ---------------------------------------------------------------------------

export function GroupList({
  category,
  allCategories,
  onRefresh,
}: {
  category: PresetCategoryFull;
  allCategories: PresetCategoryFull[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [localGroups, setLocalGroups] = useState<{
    categoryId: string;
    sourceGroups: PresetCategoryFull["groups"];
    groups: PresetCategoryFull["groups"];
  } | null>(null);
  const [folderState, setFolderState] = useState<{
    categoryId: string;
    currentFolderId: string | null;
    selectedGroupIds: Set<string>;
  }>(() => ({
    categoryId: category.id,
    currentFolderId: null,
    selectedGroupIds: new Set(),
  }));
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups =
    localGroups?.categoryId === category.id && localGroups.sourceGroups === category.groups
      ? localGroups.groups
      : category.groups;
  const currentFolderId = folderState.categoryId === category.id ? folderState.currentFolderId : null;
  const selectedGroupIds =
    folderState.categoryId === category.id ? folderState.selectedGroupIds : EMPTY_SELECTED_GROUP_IDS;

  const setCurrentFolderId = useCallback((folderId: string | null) => {
    setFolderState({
      categoryId: category.id,
      currentFolderId: folderId,
      selectedGroupIds: new Set(),
    });
  }, [category.id]);

  const setSelectedGroupIds = useCallback((value: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setFolderState((prev) => {
      const base =
        prev.categoryId === category.id
          ? prev
          : { categoryId: category.id, currentFolderId: null, selectedGroupIds: new Set<string>() };
      const nextSelectedGroupIds =
        typeof value === "function" ? value(base.selectedGroupIds) : value;

      return { ...base, selectedGroupIds: nextSelectedGroupIds };
    });
  }, [category.id]);

  // Filter groups and folders for current folder level
  const visibleGroups = groups.filter((g) => (g.folderId ?? null) === currentFolderId);
  const visibleFolders = category.folders.filter((f) => (f.parentId ?? null) === currentFolderId);

  // Clear selection when navigating folders
  const navigateGroupFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
  }, [setCurrentFolderId]);

  // Toggle selection
  const toggleGroupSelection = useCallback((id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedGroupIds]);

  // Batch move handler
  const handleGroupBatchMove = useCallback((folderId: string | null) => {
    const ids = Array.from(selectedGroupIds);
    startTransition(async () => {
      try {
        for (const id of ids) {
          await moveToFolder("group", id, folderId);
        }
        setSelectedGroupIds(new Set());
        toast.success(`已移动 ${ids.length} 个预制组`);
        onRefresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "移动失败");
      }
    });
  }, [selectedGroupIds, setSelectedGroupIds, onRefresh, startTransition]);

  // Breadcrumb path
  const breadcrumb = useMemo(() => {
    const path: FolderItem[] = [];
    let fid = currentFolderId;
    while (fid) {
      const folder = category.folders.find((f) => f.id === fid);
      if (!folder) break;
      path.unshift(folder);
      fid = folder.parentId;
    }
    return path;
  }, [currentFolderId, category.folders]);

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = visibleGroups;
    const oldIndex = items.findIndex((g) => g.id === active.id);
    const newIndex = items.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    const otherGroups = groups.filter((g) => (g.folderId ?? null) !== currentFolderId);
    setLocalGroups({
      categoryId: category.id,
      sourceGroups: category.groups,
      groups: [...otherGroups, ...reordered],
    });
    startTransition(async () => {
      await reorderPresetGroups(reordered.map((g) => g.id));
    });
  }

  const folderDndId = useId();
  const folderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleFolderDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = visibleFolders;
    const oldIndex = items.findIndex((f) => f.id === active.id);
    const newIndex = items.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    startTransition(async () => {
      await reorderPresetFolders(category.id, currentFolderId, reordered.map((f) => f.id));
      onRefresh();
    });
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    startTransition(async () => {
      try {
        await createPresetFolder(category.id, currentFolderId, newFolderName.trim());
        toast.success("文件夹已创建");
        setNewFolderName("");
        setIsCreatingFolder(false);
        onRefresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "创建文件夹失败");
      }
    });
  }

  // Collect all groups across all "group" categories for sub-group selection
  const allGroups = allCategories.flatMap((c) => c.groups);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">
          {category.name}
          <span className="ml-1.5 text-zinc-500">· {groups.length} 个预制组</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCreatingFolder(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.08]"
            title="新建文件夹"
          >
            <FolderPlus className="size-3" />
          </button>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20"
            >
              <Plus className="size-3" /> 新建预制组
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <FolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateGroupFolder} />

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedGroupIds.size}
        totalCount={visibleGroups.length}
        folders={category.folders}
        onMoveToFolder={handleGroupBatchMove}
        onSelectAll={() => setSelectedGroupIds(new Set(visibleGroups.map((g) => g.id)))}
        onClearSelection={() => setSelectedGroupIds(new Set())}
      />

      {/* Create folder inline */}
      {isCreatingFolder && (
        <div className="flex items-center gap-2">
          <Folder className="size-3.5 text-amber-400/60" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="文件夹名称"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); } }}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            autoFocus
          />
          <button type="button" onClick={handleCreateFolder} disabled={isPending || !newFolderName.trim()} className="rounded-lg bg-sky-500/20 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50">
            <Save className="size-3" />
          </button>
          <button type="button" onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/[0.06]">
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Folder items */}
      <DndContext
        id={folderDndId}
        sensors={folderSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleFolderDragEnd}
      >
        <SortableContext
          items={visibleFolders.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleFolders.map((folder) => (
            <SortableFolderRow
              key={folder.id}
              folder={folder}
              itemCount={countFolderItems(folder.id, category.folders, [], groups)}
              onEnter={() => navigateGroupFolder(folder.id)}
              onRename={(newName) => {
                startTransition(async () => {
                  try {
                    await renamePresetFolder(folder.id, newName);
                    toast.success("文件夹已重命名");
                    onRefresh();
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "重命名失败");
                  }
                });
              }}
              onDelete={() => {
                if (!confirm(`确认删除文件夹「${folder.name}」？`)) return;
                startTransition(async () => {
                  try {
                    await deletePresetFolder(folder.id);
                    toast.success("文件夹已删除");
                    onRefresh();
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "删除失败");
                  }
                });
              }}
              isPending={isPending}
            />
          ))}
          </div>
        </SortableContext>
      </DndContext>

      {visibleGroups.length === 0 && visibleFolders.length === 0 && !showCreateForm && (
        <div className="flex h-20 items-center justify-center text-xs text-zinc-500">
          {currentFolderId ? "此文件夹为空" : "暂无预制组"}
        </div>
      )}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupDragEnd}
      >
        <SortableContext
          items={visibleGroups.map((g) => g.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleGroups.map((group) => (
            <SortableGroupCard
              key={group.id}
              group={group}
              categories={allCategories}
              groups={allGroups}
              folders={category.folders}
              isEditing={editingGroupId === group.id}
              onEdit={() => setEditingGroupId(editingGroupId === group.id ? null : group.id)}
              onRefresh={onRefresh}
              onGroupDeleted={() => {
                setEditingGroupId(null);
                onRefresh();
              }}
              onMoveToFolder={(folderId) => {
                startTransition(async () => {
                  try {
                    await moveToFolder("group", group.id, folderId);
                    toast.success("已移至目标文件夹");
                    onRefresh();
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "移动失败");
                  }
                });
              }}
              isPending={isPending}
              startTransition={startTransition}
              isSelected={selectedGroupIds.has(group.id)}
              onToggleSelect={() => toggleGroupSelection(group.id)}
              onNavigateToPreset={(presetId) => router.push(`/assets/presets/${presetId}`)}
            />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showCreateForm && (
        <GroupCreateForm
          categoryId={category.id}
          folderId={currentFolderId}
          slotTemplate={category.slotTemplate}
          allCategories={allCategories}
          allGroups={groups}
          onSave={(data, members) => {
            startTransition(async () => {
              try {
                const group = await createPresetGroup(data);
                for (const m of members) {
                  await addGroupMember({ groupId: group.id, ...m });
                }
                toast.success("预制组已创建");
                setShowCreateForm(false);
                onRefresh();
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "创建失败");
              }
            });
          }}
          onCancel={() => setShowCreateForm(false)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
