"use client";

import { useState, useEffect, useTransition, useCallback, useMemo, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Settings2,
  CheckSquare,
  Square,
  GripVertical,
  Folder,
  FolderPlus,
  Save,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import type {
  PresetCategoryFull,
  PresetFull,
  FolderItem,
} from "@/lib/server-data";
import {
  createPreset,
  updatePreset,
  createPresetVariant,
  updatePresetVariant,
  upsertPresetVariantBySlug,
  getPresetUsage,
  deletePresetCascade,
  syncPresetToSections,
  reorderPresetCategories,
  reorderPresets,
  moveToFolder,
  reorderPresetFolders,
  deletePresetCategory,
  createPresetFolder,
  renamePresetFolder,
  deletePresetFolder,
  createPresetCategory,
  updatePresetCategory,
} from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";
import { toast } from "sonner";
import type { PresetQueryPatch, VariantDraft } from "./preset-types";
export { GROUP_HISTORY_TABS } from "./preset-types";
export { AddGroupMemberForm } from "./add-group-member-form";
export { PresetChangeHistoryPanel } from "./change-history-panel";
import { SortableCategoryItem, CategoryForm, CategoryBadge } from "./category-components";
import { FolderBreadcrumb, BatchActionBar, MoveToFolderButton, SortableFolderRow, countFolderItems } from "./folder-components";
import { PresetForm } from "./preset-form";
import { GroupList } from "./group-components";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findPresetCategory(
  categories: PresetCategoryFull[],
  presetId: string | null,
) {
  if (!presetId) {
    return null;
  }

  return categories.find((cat) => cat.presets.some((preset) => preset.id === presetId)) ?? null;
}

function resolveQueryCategoryId(
  categories: PresetCategoryFull[],
  categoryId: string | null,
  presetId: string | null,
) {
  if (categoryId && categories.some((cat) => cat.id === categoryId)) {
    return categoryId;
  }

  return findPresetCategory(categories, presetId)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PresetManager({
  initialCategories,
}: {
  initialCategories: PresetCategoryFull[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const queryCategoryId = searchParams.get("category");
  const queryFolderId = searchParams.get("folder");
  const queryPresetId = searchParams.get("preset");
  const queryVariantId = searchParams.get("variant");
  const initialSelectedCatId =
    resolveQueryCategoryId(initialCategories, queryCategoryId, queryPresetId) ??
    initialCategories[0]?.id ??
    null;
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialSelectedCatId,
  );

  // Sync with server data after router.refresh()
  useEffect(() => {
    setCategories(initialCategories);
    // Keep selection if the category still exists, otherwise select first
    setSelectedCatId((prev) => {
      const querySelection = resolveQueryCategoryId(
        initialCategories,
        queryCategoryId,
        queryPresetId,
      );

      if (querySelection) {
        return querySelection;
      }

      return initialCategories.some((c) => c.id === prev)
        ? prev
        : initialCategories[0]?.id ?? null;
    });
  }, [initialCategories, queryCategoryId, queryPresetId]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Handle URL hash navigation (e.g., #preset-{presetId})
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#preset-")) {
      const presetId = hash.slice(8); // Remove "#preset-" prefix
      for (const cat of initialCategories) {
        if (cat.presets.some((p) => p.id === presetId)) {
          router.replace(`/assets/presets/${presetId}`);
          break;
        }
      }
    }
  }, [initialCategories, router]);

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  const catDndId = useId();
  const catSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  const replacePresetQuery = useCallback((patch: PresetQueryPatch) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        continue;
      }

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const query = params.toString();
    const url = `/assets/presets${query ? `?${query}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [searchParams]);

  function handleCatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    startTransition(async () => {
      await reorderPresetCategories(reordered.map((c) => c.id));
    });
  }

  return (
    <div className="max-w-5xl space-y-4">
      <SectionCard title="预制管理" subtitle="管理预制分类和预制项。每个分类下可创建多个预制或预制组。">
        <div className="flex gap-4">
          {/* Left panel: sortable categories */}
          <div className="w-36 shrink-0 space-y-2 sticky top-3 self-start sm:w-60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                分类
              </span>
              <div className="flex gap-1">
                <Link
                  href="/assets/presets/sort-rules"
                  className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
                  title="排序规则"
                >
                  <Settings2 className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowCatForm(true);
                    setEditingCatId(null);
                  }}
                  className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Sortable category list */}
            <DndContext
              id={catDndId}
              sensors={catSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCatDragEnd}
            >
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {categories.map((cat) => {
                  const isEditing = showCatForm && editingCatId === cat.id;
                  return (
                  <SortableCategoryItem
                    key={cat.id}
                    cat={cat}
                    isSelected={selectedCatId === cat.id}
                    isExpanded={isEditing}
                    onSelect={() => {
                      setSelectedCatId(cat.id);
                      if (!isEditing) setShowCatForm(false);
                      replacePresetQuery({
                        category: cat.id,
                        folder: null,
                        preset: null,
                        variant: null,
                      });
                    }}
                    onEdit={() => {
                      setSelectedCatId(cat.id);
                      setEditingCatId(isEditing ? null : cat.id);
                      setShowCatForm(!isEditing);
                    }}
                    onDelete={() => {
                      if (!confirm("确认删除此分类？")) return;
                      startTransition(async () => {
                        try {
                          await deletePresetCategory(cat.id);
                          toast.success("分类已删除");
                          if (selectedCatId === cat.id) {
                            setSelectedCatId(categories.find((candidate) => candidate.id !== cat.id)?.id ?? null);
                          }
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "删除失败");
                        }
                        if (editingCatId === cat.id) {
                          setShowCatForm(false);
                          setEditingCatId(null);
                        }
                        refresh();
                      });
                    }}
                  >
                    {isEditing && (
                      <CategoryForm
                        category={cat}
                        allCategories={categories}
                        onSave={(data) => {
                          startTransition(async () => {
                            await updatePresetCategory(cat.id, data);
                            toast.success("分类已保存");
                            refresh();
                          });
                        }}
                        isPending={isPending}
                      />
                    )}
                  </SortableCategoryItem>
                  );
                })}
              </SortableContext>
            </DndContext>

            {/* Category create/edit form */}
            {showCatForm && !editingCatId && (
              <CategoryForm
                category={null}
                allCategories={categories}
                onSave={(data) => {
                  startTransition(async () => {
                    const cat = await createPresetCategory(data);
                    setSelectedCatId(cat.id);
                    toast.success("分类已创建");
                    setShowCatForm(false);
                    setEditingCatId(null);
                    refresh();
                  });
                }}
                isPending={isPending}
              />
            )}

          </div>

          {/* Right panel: presets or groups based on category type */}
          <div className="flex-1 min-w-0">
            {selectedCat ? (
              selectedCat.type === "group" ? (
                <GroupList
                  category={selectedCat}
                  allCategories={categories}
                  onRefresh={refresh}
                />
              ) : (
                <PresetList
                  category={selectedCat}
                  onRefresh={refresh}
                  allCategories={categories}
                  queryFolderId={queryFolderId}
                  queryPresetId={queryPresetId}
                  queryVariantId={queryVariantId}
                  onViewChange={(patch) => replacePresetQuery({ category: selectedCat.id, ...patch })}
                />
              )
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
                选择或创建一个分类
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetList — right panel showing presets within a category
// ---------------------------------------------------------------------------

function PresetList({
  category,
  onRefresh,
  allCategories,
  queryFolderId,
  queryPresetId,
  queryVariantId,
  onViewChange,
}: {
  category: PresetCategoryFull;
  onRefresh: () => void;
  allCategories: PresetCategoryFull[];
  queryFolderId: string | null;
  queryPresetId: string | null;
  queryVariantId: string | null;
  onViewChange: (patch: Omit<PresetQueryPatch, "category">) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [presets, setPresets] = useState(category.presets);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const queryPreset = useMemo(
    () => category.presets.find((preset) => preset.id === queryPresetId) ?? null,
    [category.presets, queryPresetId],
  );
  const resolvedQueryFolderId = useMemo(() => {
    if (queryPreset) {
      return queryPreset.folderId ?? null;
    }

    return queryFolderId && category.folders.some((folder) => folder.id === queryFolderId)
      ? queryFolderId
      : null;
  }, [category.folders, queryFolderId, queryPreset]);

  // Sync presets when category changes
  useEffect(() => {
    setPresets(category.presets);
  }, [category.presets]);

  // Restore folder from URL query state.
  useEffect(() => {
    setCurrentFolderId(resolvedQueryFolderId);
    setSelectedIds(new Set());
  }, [category.id, resolvedQueryFolderId]);

  // Filter presets and folders for current folder level
  const visiblePresets = presets.filter((p) => (p.folderId ?? null) === currentFolderId);
  const visibleFolders = category.folders.filter((f) => (f.parentId ?? null) === currentFolderId);

  // Clear selection when navigating folders
  const navigateFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    onViewChange({ folder: folderId, preset: null, variant: null });
  }, [onViewChange]);

  // Toggle selection
  const togglePresetSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Batch move handler
  const handleBatchMove = useCallback((folderId: string | null) => {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        for (const id of ids) {
          await moveToFolder("preset", id, folderId);
        }
        setSelectedIds(new Set());
        toast.success(`已移动 ${ids.length} 个预制`);
        onRefresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "移动失败");
      }
    });
  }, [selectedIds, onRefresh, startTransition]);

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

  function handlePresetDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = visiblePresets;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    // Update the full presets array
    const otherPresets = presets.filter((p) => (p.folderId ?? null) !== currentFolderId);
    setPresets([...otherPresets, ...reordered]);
    startTransition(async () => {
      await reorderPresets(category.id, reordered.map((p) => p.id));
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge color={category.color} />
          <span className="text-sm font-medium text-zinc-200">
            {category.name}
          </span>
          <span className="text-[10px] text-zinc-500">
            {presets.length} 个预制
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCreatingFolder(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.08]"
            title="新建文件夹"
          >
            <FolderPlus className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              onViewChange({ folder: currentFolderId, preset: null, variant: null });
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20"
          >
            <Plus className="size-3" /> 新建预制
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <FolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateFolder} />

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        totalCount={visiblePresets.length}
        folders={category.folders}
        onMoveToFolder={handleBatchMove}
        onSelectAll={() => setSelectedIds(new Set(visiblePresets.map((p) => p.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
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
              itemCount={countFolderItems(folder.id, category.folders, presets)}
              onEnter={() => navigateFolder(folder.id)}
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

      {/* Create form */}
      {isCreating && (
        <PresetForm
          categoryId={category.id}
          folderId={currentFolderId}
          preset={null}
          allCategories={allCategories}
          onSave={(data, variantDrafts) => {
            startTransition(async () => {
              try {
                const newPreset = await createPreset(data);
                // Save all variant drafts from the form
                for (const v of variantDrafts) {
                  await createPresetVariant({
                    presetId: newPreset.id,
                    name: v.name.trim(),
                    slug: v.slug.trim(),
                    prompt: v.prompt.trim(),
                    negativePrompt: v.negativePrompt.trim() || null,
                    lora1: serializeLoraBindings(v.lora1),
                    lora2: serializeLoraBindings(v.lora2),
                    linkedVariants: v.linkedVariants.length > 0 ? v.linkedVariants : null,
                  });
                }
                toast.success("预制已创建");
                setIsCreating(false);
                onRefresh();
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "创建失败");
              }
            });
          }}
          onCancel={() => setIsCreating(false)}
          isPending={isPending}
        />
      )}

      {/* Sortable preset cards */}
      {visiblePresets.length === 0 && visibleFolders.length === 0 && !isCreating ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/5 text-xs text-zinc-600">
          {currentFolderId ? "此文件夹为空" : "暂无预制，点击「新建预制」开始"}
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handlePresetDragEnd}
        >
          <SortableContext
            items={visiblePresets.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visiblePresets.map((preset) => (
              <SortablePresetCard
                key={preset.id}
                preset={preset}
                folders={category.folders}
                onMoveToFolder={(folderId) => {
                  startTransition(async () => {
                    try {
                      await moveToFolder("preset", preset.id, folderId);
                      toast.success("已移至目标文件夹");
                      onRefresh();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "移动失败");
                    }
                  });
                }}
                isSelected={selectedIds.has(preset.id)}
                onToggleSelect={() => togglePresetSelection(preset.id)}
                isEditing={editingId === preset.id}
                onDelete={() => {
                  startTransition(async () => {
                    try {
                      const usage = await getPresetUsage(preset.id);
                      let msg = "确认删除此预制？";
                      if (usage.sections.length > 0) {
                        const lines = usage.sections.map(
                          (s) => `  · ${s.projectTitle} / ${s.sectionName} (${s.blockCount} 个提示词块)`,
                        );
                        msg = `以下小节使用了该预制：\n${lines.join("\n")}\n\n确认删除将同时移除这些小节中的相关提示词块和 LoRA。`;
                      }
                      if (!confirm(msg)) return;
                      await deletePresetCascade(preset.id);
                      toast.success("预制已删除");
                      setEditingId(null);
                      onViewChange({ folder: currentFolderId, preset: null, variant: null });
                      onRefresh();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "删除失败");
                    }
                  });
                }}
                presetFormProps={{
                  categoryId: category.id,
                  allCategories,
                  onSave: (data, variantDrafts) => {
                    startTransition(async () => {
                      try {
                        await updatePreset(preset.id, data);
                        // Save all variant drafts
                        for (const v of variantDrafts) {
                          const variantData = {
                            presetId: preset.id,
                            name: v.name.trim(),
                            slug: v.slug.trim(),
                            prompt: v.prompt.trim(),
                            negativePrompt: v.negativePrompt.trim() || null,
                            lora1: serializeLoraBindings(v.lora1),
                            lora2: serializeLoraBindings(v.lora2),
                            linkedVariants: v.linkedVariants,
                          };
                          if (v.id) {
                            await updatePresetVariant(v.id, variantData);
                          } else {
                            await upsertPresetVariantBySlug(variantData);
                          }
                        }
                        // Sync updated content (including linked variants) to all sections
                        await syncPresetToSections(preset.id);
                        toast.success("预制已保存");
                        setEditingId(null);
                        onViewChange({ folder: currentFolderId, preset: null, variant: null });
                        onRefresh();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "保存失败");
                      }
                    });
                  },
                  onCancel: () => {
                    setEditingId(null);
                    onViewChange({ folder: currentFolderId, preset: null, variant: null });
                  },
                  isPending,
                  activeVariantId: queryPresetId === preset.id ? queryVariantId : null,
                  onVariantChange: (variantId) => {
                    onViewChange({
                      folder: preset.folderId ?? null,
                      preset: preset.id,
                      variant: variantId,
                    });
                  },
                }}
              />
            ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortablePresetCard — draggable preset card
// ---------------------------------------------------------------------------

function SortablePresetCard({
  preset,
  folders,
  onMoveToFolder,
  isSelected,
  onToggleSelect,
  isEditing,
  presetFormProps,
  onDelete,
}: {
  preset: PresetFull;
  folders: FolderItem[];
  onMoveToFolder: (folderId: string | null) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  isEditing: boolean;
  presetFormProps?: {
    categoryId: string;
    allCategories: PresetCategoryFull[];
    onSave: (data: {
      categoryId: string;
      folderId?: string | null;
      name: string;
      slug: string;
      notes?: string | null;
      isActive?: boolean;
    }, variantDrafts: VariantDraft[]) => void;
    onCancel: () => void;
    isPending: boolean;
    activeVariantId?: string | null;
    onVariantChange?: (variantId: string | null) => void;
  };
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const variantCount = preset.variantCount;
  const lora1 = preset.variants[0] ? parseLoraBindings(preset.variants[0].lora1) : [];
  const lora2 = preset.variants[0] ? parseLoraBindings(preset.variants[0].lora2) : [];
  const loraCount = lora1.length + lora2.length;

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-white/5 bg-white/[0.02]">
      <Link
        href={`/assets/presets/${preset.id}`}
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
          <div className="text-xs font-medium text-zinc-200">{preset.name}</div>
          <div className="text-[10px] text-zinc-500">
            {variantCount > 0 ? `${variantCount} 变体` : "暂无变体"}
            {loraCount > 0 && <span> · {loraCount} LoRA</span>}
          </div>
        </div>
        <span onClick={(e) => e.preventDefault()}>
          <MoveToFolderButton
            currentFolderId={preset.folderId}
            folders={folders}
            onMove={onMoveToFolder}
          />
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="shrink-0 rounded p-1 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
            title="删除预制"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </Link>
    </div>
  );
}
