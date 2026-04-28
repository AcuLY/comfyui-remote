"use client";

import { useState, useEffect, useTransition, useMemo, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Save,
  X,
  GripVertical,
  FolderOpen,
  FolderPlus,
  Folder,
  FolderInput,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  CheckSquare,
  Square,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type {
  PresetCategoryFull,
  PresetGroupItem,
  PresetVariantItem,
  SlotTemplateDef,
  FolderItem,
} from "@/lib/server-data";
import {
  createPresetGroup,
  updatePresetGroup,
  deletePresetGroup,
  addGroupMember,
  removeGroupMember,
  reorderPresetGroups,
  reorderGroupMembers,
  createPresetFolder,
  renamePresetFolder,
  deletePresetFolder,
  moveToFolder,
  reorderPresetFolders,
} from "@/lib/actions";
import { toast } from "sonner";
import { GROUP_HISTORY_TABS } from "./preset-types";
import { PresetChangeHistoryPanel } from "./change-history-panel";
import {
  FolderBreadcrumb,
  BatchActionBar,
  MoveToFolderButton,
  SortableFolderRow,
  countFolderItems,
} from "./folder-components";

// ---------------------------------------------------------------------------
// GroupList — right panel showing groups within a category
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
  const [groups, setGroups] = useState(category.groups);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setGroups(category.groups);
  }, [category.groups]);

  // Reset folder when category changes
  useEffect(() => {
    setCurrentFolderId(null);
    setSelectedGroupIds(new Set());
  }, [category.id]);

  // Filter groups and folders for current folder level
  const visibleGroups = groups.filter((g) => (g.folderId ?? null) === currentFolderId);
  const visibleFolders = category.folders.filter((f) => (f.parentId ?? null) === currentFolderId);

  // Clear selection when navigating folders
  const navigateGroupFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedGroupIds(new Set());
  }, []);

  // Toggle selection
  const toggleGroupSelection = useCallback((id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
  }, [selectedGroupIds, onRefresh, startTransition]);

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
    setGroups([...otherGroups, ...reordered]);
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
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

// ---------------------------------------------------------------------------
// SortableGroupCard
// ---------------------------------------------------------------------------

function SortableGroupCard({
  group,
  categories,
  groups,
  folders,
  isEditing,
  onEdit,
  onRefresh,
  onGroupDeleted,
  onMoveToFolder,
  isPending,
  startTransition,
  isSelected,
  onToggleSelect,
  onNavigateToPreset,
}: {
  group: PresetGroupItem;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  folders: FolderItem[];
  isEditing: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  onGroupDeleted: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  isSelected: boolean;
  onToggleSelect: () => void;
  onNavigateToPreset: (presetId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition: dndTransition, isDragging } = useSortable({ id: group.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: dndTransition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [members, setMembers] = useState(group.members);
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const memberDndId = useId();

  // Build variant lookup from all categories
  const variantMap = useMemo(() => {
    const map = new Map<string, PresetVariantItem>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        for (const v of preset.variants) {
          map.set(v.id, v);
        }
      }
    }
    return map;
  }, [categories]);

  const presetVariantsMap = useMemo(() => {
    const map = new Map<string, PresetVariantItem[]>();
    for (const cat of categories) {
      for (const preset of cat.presets) {
        if (preset.variants.length > 0) map.set(preset.id, preset.variants);
      }
    }
    return map;
  }, [categories]);

  // Resolve a member's variant data
  function getMemberVariant(member: GroupMemberDisplay): PresetVariantItem | null {
    if (member.subGroupId) return null;
    if (member.variantId) return variantMap.get(member.variantId) ?? null;
    const variants = member.presetId ? presetVariantsMap.get(member.presetId) : null;
    return variants?.[0] ?? null;
  }

  function togglePreview(id: string) {
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const memberSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setMembers(group.members);
  }, [group.members]);

  function handleMemberDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = members.findIndex((m) => m.id === active.id);
    const newIndex = members.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(members, oldIndex, newIndex);
    setMembers(reordered);
    startTransition(async () => {
      await reorderGroupMembers(group.id, reordered.map((m) => m.id));
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-white/5 bg-white/[0.02]">
      <Link
        href={`/assets/preset-groups/${group.id}`}
        className="flex items-center gap-2 px-3 py-2.5 transition hover:bg-white/[0.03]"
      >
        <button
          type="button"
          className="shrink-0 text-zinc-600 hover:text-sky-400"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
        >
          {isSelected ? <CheckSquare className="size-3.5 text-sky-400" /> : <Square className="size-3.5" />}
        </button>
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          onClick={(e) => e.preventDefault()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-200">{group.name}</div>
          <div className="text-[10px] text-zinc-500">
            {members.length} 个成员 · {group.slug}
          </div>
        </div>
        <span onClick={(e) => e.preventDefault()}>
          <MoveToFolderButton
            currentFolderId={group.folderId}
            folders={folders}
            onMove={onMoveToFolder}
          />
        </span>
      </Link>

      {isEditing && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          <GroupInlineEditor
            group={group}
            onSave={(data) => {
              startTransition(async () => {
                try {
                  await updatePresetGroup(group.id, data);
                  toast.success("预制组已保存");
                  onRefresh();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "保存失败");
                }
              });
            }}
            onDelete={() => {
              if (!confirm(`确认删除预制组「${group.name}」？`)) return;
              startTransition(async () => {
                try {
                  await deletePresetGroup(group.id);
                  toast.success("预制组已删除");
                  onGroupDeleted();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "删除失败");
                }
              });
            }}
            isPending={isPending}
          />

          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">成员</span>
            {members.length === 0 && (
              <div className="text-[10px] text-zinc-600 py-1">暂无成员</div>
            )}
            <DndContext
              id={memberDndId}
              sensors={memberSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMemberDragEnd}
            >
              <SortableContext
                items={members.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {members.map((m) => {
                  const variant = m.subGroupId ? null : getMemberVariant(m);
                  const isExpanded = expandedPreviewIds.has(m.id);
                  return (
                    <SortableGroupMemberItem
                      key={m.id}
                      member={m}
                      variant={variant}
                      isExpanded={isExpanded}
                      onToggle={() => togglePreview(m.id)}
                      isPending={isPending}
                      onRemove={() => {
                        startTransition(async () => {
                          try {
                            await removeGroupMember(m.id);
                            toast.success("成员已移除");
                            onRefresh();
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "移除成员失败");
                          }
                        });
                      }}
                      onNavigate={() => {
                        if (m.presetId) onNavigateToPreset(m.presetId);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          <AddGroupMemberForm
            groupId={group.id}
            categories={categories}
            groups={groups.filter((g) => g.id !== group.id)}
            onAdd={(input) => {
              startTransition(async () => {
                try {
                  await addGroupMember(input);
                  toast.success("成员已添加");
                  onRefresh();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "添加成员失败");
                }
              });
            }}
            isPending={isPending}
          />

          <PresetChangeHistoryPanel
            history={group.changeHistory}
            tabs={GROUP_HISTORY_TABS}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableGroupMemberItem
// ---------------------------------------------------------------------------

type GroupMemberDisplay = PresetGroupItem["members"][number];

function SortableGroupMemberItem({
  member,
  variant,
  isExpanded,
  onToggle,
  isPending,
  onRemove,
  onNavigate,
}: {
  member: GroupMemberDisplay;
  variant: PresetVariantItem | null;
  isExpanded: boolean;
  onToggle: () => void;
  isPending: boolean;
  onRemove: () => void;
  onNavigate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const loras = variant
    ? [...(variant.lora1 as Array<{ path: string; weight: number; enabled: boolean }> ?? []), ...(variant.lora2 as Array<{ path: string; weight: number; enabled: boolean }> ?? [])].filter((l) => l.enabled)
    : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-white/5 bg-white/[0.02] ${isExpanded ? "border-white/10" : ""}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <ChevronRight className={`size-3 shrink-0 text-zinc-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          <div className="min-w-0 text-xs">
            {member.subGroupId ? (
              <span className="text-amber-400/80">
                {member.subGroupName ?? member.subGroupId}
              </span>
            ) : (
              <>
                <span className="text-zinc-300">{member.presetName ?? "?"}</span>
                {member.variantName && (
                  <span className="text-zinc-500"> / {member.variantName}</span>
                )}
              </>
            )}
          </div>
          {loras.length > 0 && !member.subGroupId && (
            <span className="shrink-0 text-[10px] text-zinc-600">{loras.length} LoRA</span>
          )}
          {onNavigate && !member.subGroupId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              className="shrink-0 rounded p-0.5 text-zinc-600 hover:text-sky-400"
              title="跳转到预制编辑"
            >
              <ChevronRight className="size-3" />
            </button>
          )}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="rounded p-0.5 text-zinc-600 hover:text-red-400 disabled:opacity-50"
        >
          <X className="size-3" />
        </button>
      </div>
      {isExpanded && variant && (
        <div className="border-t border-white/5 px-2.5 py-2 space-y-2 text-[11px]">
          {variant.prompt && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">正面提示词</div>
              <pre className="whitespace-pre-wrap break-words text-zinc-400">{variant.prompt}</pre>
            </div>
          )}
          {variant.negativePrompt && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">负面提示词</div>
              <pre className="whitespace-pre-wrap break-words text-zinc-400">{variant.negativePrompt}</pre>
            </div>
          )}
          {loras.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-medium text-zinc-500">LoRA</div>
              <div className="space-y-0.5 text-zinc-500">
                {loras.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="truncate">{l.path.split(/[/\\]/).pop()}</span>
                    <span className="shrink-0 text-zinc-600">{l.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupCreateForm
// ---------------------------------------------------------------------------

function GroupCreateForm({
  categoryId,
  folderId,
  slotTemplate,
  onSave,
  onCancel,
  isPending,
  allCategories,
  allGroups,
}: {
  categoryId: string;
  folderId?: string | null;
  slotTemplate: SlotTemplateDef[];
  onSave: (data: { categoryId: string; folderId?: string | null; name: string; slug: string }, members: Array<{ presetId?: string; variantId?: string; subGroupId?: string; slotCategoryId?: string }>) => void;
  onCancel: () => void;
  isPending: boolean;
  allCategories: PresetCategoryFull[];
  allGroups: PresetGroupItem[];
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // Inline member drafts (not yet persisted)
  type MemberDraft = { presetId?: string; variantId?: string; subGroupId?: string; slotCategoryId?: string; displayName: string };
  // Initialize from slot template: each slot becomes an empty member with locked category
  const presetCategories = allCategories.filter((c) => c.type === "preset");
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    slotTemplate.map((slot) => {
      const cat = allCategories.find((c) => c.id === slot.categoryId);
      return {
        slotCategoryId: slot.categoryId,
        displayName: slot.label ?? cat?.name ?? "未选择",
      };
    }),
  );

  // Member add form state
  const [mode, setMode] = useState<"preset" | "group">("preset");
  const [pickerValue, setPickerValue] = useState<{ presetId: string; variantId: string } | null>(null);
  const [selGroupId, setSelGroupId] = useState<string>("");

  function addMember() {
    if (mode === "group" && selGroupId) {
      const g = allGroups.find((g) => g.id === selGroupId);
      setMembers([...members, { subGroupId: selGroupId, displayName: g?.name ?? selGroupId }]);
      setSelGroupId("");
    } else if (pickerValue) {
      // Resolve names from categories
      let presetName = pickerValue.presetId;
      let variantName = "";
      for (const cat of allCategories) {
        const p = cat.presets.find((px) => px.id === pickerValue.presetId);
        if (p) {
          presetName = p.name;
          const v = p.variants.find((vx) => vx.id === pickerValue.variantId);
          variantName = v?.name ?? "";
          if (p.variants.length > 1 && variantName) presetName = `${p.name} / ${variantName}`;
          break;
        }
      }
      setMembers([...members, {
        presetId: pickerValue.presetId,
        variantId: pickerValue.variantId || undefined,
        displayName: presetName,
      }]);
      setPickerValue(null);
    }
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  function applyMemberNames() {
    const slugParts = members.map((m) => toSlug(m.displayName));
    const joined = slugParts.join("-");
    setName(joined);
    setSlug(joined);
  }

  const canAddMember = mode === "group" ? !!selGroupId : !!pickerValue;
  // Allow creating with just slot members (even if no preset selected yet) or with manually added members
  const hasAnyMember = members.length > 0;
  const canCreate = !!name.trim() && !!slug.trim() && hasAnyMember;

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={onCancel}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <FolderOpen className="size-4 shrink-0 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200">新建预制组</div>
          <div className="text-[10px] text-zinc-500">
            {members.length} 个成员 · {slug || "slug"}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-zinc-500" style={{ transform: "rotate(180deg)" }} />
      </button>

      <div className="border-t border-white/5 px-3 py-3 space-y-3">

      {/* Name + Slug */}
      <div className="flex gap-2 items-end">
        <label className="flex-1 space-y-1">
          <span className="text-[10px] text-zinc-500">组名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === toSlug(name)) setSlug(toSlug(e.target.value));
            }}
            placeholder="如：基础组合"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        <label className="flex-1 space-y-1">
          <span className="text-[10px] text-zinc-500">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="basic-combo"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        {members.length > 0 && (
          <button
            type="button"
            onClick={applyMemberNames}
            title="用成员名拼接为组名"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <ClipboardCopy className="size-3.5" />
          </button>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">成员 ({members.length})</span>
          {members.map((m, i) => {
            // Slot member: show category badge + PresetCascadePicker locked to category
            if (m.slotCategoryId) {
              const slotCat = presetCategories.find((c) => c.id === m.slotCategoryId);
              return (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-amber-500/10 bg-amber-500/[0.02] px-2 py-1.5">
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                    style={slotCat?.color ? {
                      backgroundColor: `hsl(${slotCat.color} / 0.15)`,
                      color: `hsl(${slotCat.color})`,
                    } : { backgroundColor: "rgba(255,255,255,0.06)", color: "#a1a1aa" }}
                  >
                    {slotCat?.name ?? "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <PresetCascadePicker
                      categories={allCategories}
                      value={m.presetId && m.variantId ? { presetId: m.presetId, variantId: m.variantId } : null}
                      onChange={(val) => {
                        const updated = [...members];
                        updated[i] = {
                          ...m,
                          presetId: val?.presetId,
                          variantId: val?.variantId,
                          displayName: val?.presetName ?? m.displayName,
                        };
                        setMembers(updated);
                      }}
                      lockedCategoryId={m.slotCategoryId}
                      placeholder="选择预制…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            }
            // Regular member
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                <div className="flex-1 min-w-0 text-xs text-zinc-300">
                  {m.subGroupId ? (
                    <span className="text-amber-400/80">
                      <FolderOpen className="mr-1 inline size-3" />
                      {m.displayName}
                    </span>
                  ) : m.displayName}
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add member inline */}
      <div className="space-y-2 rounded-lg border border-dashed border-white/10 p-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">添加成员:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`rounded px-2 py-0.5 text-[10px] ${mode === "preset" ? "bg-sky-500/20 text-sky-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              预制
            </button>
            {allGroups.length > 0 && (
              <button
                type="button"
                onClick={() => setMode("group")}
                className={`rounded px-2 py-0.5 text-[10px] ${mode === "group" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                子组
              </button>
            )}
          </div>
        </div>

        {mode === "preset" ? (
          <PresetCascadePicker
            categories={allCategories}
            value={pickerValue}
            onChange={(val) => setPickerValue(val ? { presetId: val.presetId, variantId: val.variantId } : null)}
            placeholder="选择预制…"
            presetCategoriesOnly
          />
        ) : (
          <div className="relative">
            <select value={selGroupId} onChange={(e) => setSelGroupId(e.target.value)} className={selectClass}>
              <option value="">选择子组...</option>
              {allGroups.map((g) => (
                <option key={g.id} value={g.id} className="bg-zinc-900">{g.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          </div>
        )}

        <button
          type="button"
          disabled={!canAddMember}
          onClick={addMember}
          className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.1] disabled:opacity-40"
        >
          <Plus className="size-3" /> 添加
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !canCreate}
          onClick={() => onSave(
            { categoryId, folderId, name: name.trim(), slug: slug.trim() },
            members.map((m) => ({ presetId: m.presetId, variantId: m.variantId, subGroupId: m.subGroupId, slotCategoryId: m.slotCategoryId })),
          )}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3" /> 创建
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupInlineEditor
// ---------------------------------------------------------------------------

function GroupInlineEditor({
  group,
  onSave,
  onDelete,
  isPending,
}: {
  group: PresetGroupItem;
  onSave: (data: { name: string; slug: string }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(group.name);
  const [slug, setSlug] = useState(group.slug);
  const dirty = name !== group.name || slug !== group.slug;

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">组名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">Slug</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      {dirty && (
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim() })}
          className="rounded-lg bg-sky-500/20 p-1.5 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// toSlug
// ---------------------------------------------------------------------------

/** Simple slug generator */
function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// AddGroupMemberForm
// ---------------------------------------------------------------------------

export function AddGroupMemberForm({
  groupId,
  categories,
  groups,
  onAdd,
  isPending,
}: {
  groupId: string;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  onAdd: (input: { groupId: string; presetId?: string; variantId?: string; subGroupId?: string }) => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<"preset" | "group">("preset");
  const [pickerValue, setPickerValue] = useState<{ presetId: string; variantId: string } | null>(null);
  const [selGroupId, setSelGroupId] = useState<string>("");

  const canAdd = mode === "group" ? !!selGroupId : !!pickerValue;

  function handleAdd() {
    if (mode === "group" && selGroupId) {
      onAdd({ groupId, subGroupId: selGroupId });
      setSelGroupId("");
    } else if (pickerValue) {
      onAdd({
        groupId,
        presetId: pickerValue.presetId,
        variantId: pickerValue.variantId,
      });
      setPickerValue(null);
    }
  }

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-white/10 p-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500">添加成员:</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={`rounded px-2 py-0.5 text-[10px] ${mode === "preset" ? "bg-sky-500/20 text-sky-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            预制
          </button>
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setMode("group")}
              className={`rounded px-2 py-0.5 text-[10px] ${mode === "group" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              子组
            </button>
          )}
        </div>
      </div>

      {mode === "preset" ? (
        <PresetCascadePicker
          categories={categories}
          value={pickerValue}
          onChange={(val) => setPickerValue(val ? { presetId: val.presetId, variantId: val.variantId } : null)}
          placeholder="选择预制…"
          presetCategoriesOnly
        />
      ) : (
        <div className="relative">
          <select value={selGroupId} onChange={(e) => setSelGroupId(e.target.value)} className={selectClass}>
            <option value="">选择子组...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-zinc-900">{g.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
        </div>
      )}

      <button
        type="button"
        disabled={isPending || !canAdd}
        onClick={handleAdd}
        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.1] disabled:opacity-40"
      >
        <Plus className="size-3" /> 添加
      </button>
    </div>
  );
}
