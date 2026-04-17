"use client";

import { useState, useEffect, useTransition, useCallback, useMemo, useId } from "react";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Save,
  X,
  GripVertical,
  Pencil,
  Settings2,
  Loader2,
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
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import type { PresetCategoryFull, PresetFull, PresetVariantItem, PresetGroupItem, SlotTemplateDef, FolderItem } from "@/lib/server-data";
import {
  createPresetCategory,
  updatePresetCategory,
  deletePresetCategory,
  createPreset,
  updatePreset,
  deletePreset,
  createPresetVariant,
  updatePresetVariant,
  deletePresetVariant,
  getPresetUsage,
  deletePresetCascade,
  syncPresetToSections,
  reorderPresetCategories,
  reorderPresets,
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
  reorderPresetVariants,
} from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptManager({
  initialCategories,
}: {
  initialCategories: PresetCategoryFull[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );

  // Sync with server data after router.refresh()
  useEffect(() => {
    setCategories(initialCategories);
    // Keep selection if the category still exists, otherwise select first
    setSelectedCatId((prev) =>
      initialCategories.some((c) => c.id === prev)
        ? prev
        : initialCategories[0]?.id ?? null,
    );
  }, [initialCategories]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [autoEditPresetId, setAutoEditPresetId] = useState<string | null>(null);

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  const catDndId = useId();
  const catSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

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
    <div className="space-y-4">
      <SectionCard title="预制管理" subtitle="管理预制分类和预制项。每个分类下可创建多个预制或预制组。">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Left panel: sortable categories */}
          <div className="w-full shrink-0 space-y-2 md:w-56">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                分类
              </span>
              <div className="flex gap-1">
                <Link
                  href="/assets/prompts/sort-rules"
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
                {categories.map((cat) => (
                  <SortableCategoryItem
                    key={cat.id}
                    cat={cat}
                    isSelected={selectedCatId === cat.id}
                    onSelect={() => {
                      setSelectedCatId(cat.id);
                      setShowCatForm(false);
                    }}
                    onEdit={() => {
                      setEditingCatId(cat.id);
                      setShowCatForm(true);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Category create/edit form */}
            {showCatForm && (
              <CategoryForm
                category={
                  editingCatId
                    ? categories.find((c) => c.id === editingCatId) ?? null
                    : null
                }
                allCategories={categories}
                onSave={(data) => {
                  startTransition(async () => {
                    if (editingCatId) {
                      await updatePresetCategory(editingCatId, data);
                    } else {
                      const cat = await createPresetCategory(data);
                      setSelectedCatId(cat.id);
                    }
                    setShowCatForm(false);
                    setEditingCatId(null);
                    refresh();
                  });
                }}
                onDelete={
                  editingCatId
                    ? () => {
                        if (!confirm("确认删除此分类？")) return;
                        startTransition(async () => {
                          try {
                            await deletePresetCategory(editingCatId);
                            if (selectedCatId === editingCatId) {
                              setSelectedCatId(categories[0]?.id ?? null);
                            }
                          } catch (e: unknown) {
                            alert(e instanceof Error ? e.message : "删除失败");
                          }
                          setShowCatForm(false);
                          setEditingCatId(null);
                          refresh();
                        });
                      }
                    : undefined
                }
                onCancel={() => {
                  setShowCatForm(false);
                  setEditingCatId(null);
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
                  onNavigateToPreset={(presetId) => {
                    // Find the preset's category and switch to it
                    for (const cat of categories) {
                      if (cat.presets.some((p) => p.id === presetId)) {
                        setSelectedCatId(cat.id);
                        setAutoEditPresetId(presetId);
                        break;
                      }
                    }
                  }}
                />
              ) : (
                <PresetList
                  category={selectedCat}
                  onRefresh={refresh}
                  allCategories={categories}
                  autoEditPresetId={autoEditPresetId}
                  onAutoEditConsumed={() => setAutoEditPresetId(null)}
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
// SortableCategoryItem
// ---------------------------------------------------------------------------

function SortableCategoryItem({
  cat,
  isSelected,
  onSelect,
  onEdit,
}: {
  cat: PresetCategoryFull;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`flex w-full items-center gap-1.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${
        isSelected
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <CategoryBadge color={cat.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200 truncate">
          {cat.name}
          {cat.type === "group" && (
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-300/80">组</span>
          )}
        </div>
        <div className="text-[10px] text-zinc-500">
          {cat.type === "group" ? `${cat.groupCount} 个预制组` : `${cat.presetCount} 个预制`}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="rounded p-1 text-zinc-600 hover:text-zinc-300"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryBadge
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Color helpers — HSL-based
// ---------------------------------------------------------------------------

/** Parse "H S% L%" string into hue number. Falls back to 210 for legacy tailwind names. */
function parseHue(color: string | null): number {
  if (!color) return 210;
  const match = color.match(/^(\d+)\s/);
  if (match) return parseInt(match[1], 10);
  // Legacy tailwind color name fallback
  const LEGACY: Record<string, number> = {
    sky: 200, emerald: 160, violet: 270, amber: 38, rose: 350,
    cyan: 185, lime: 85, orange: 25, pink: 330, teal: 170,
  };
  return LEGACY[color] ?? 210;
}

function hslString(hue: number): string {
  return `${hue} 50% 55%`;
}

function CategoryBadge({ color }: { color: string | null }) {
  const hue = parseHue(color);
  return (
    <div
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: `hsl(${hue} 50% 55%)` }}
    />
  );
}

// ---------------------------------------------------------------------------
// HueSlider — simple hue picker
// ---------------------------------------------------------------------------

function HueSlider({ value, onChange }: { value: number; onChange: (hue: number) => void }) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseInt(e.target.value, 10)),
    [onChange],
  );
  return (
    <div className="flex items-center gap-2">
      <div
        className="size-6 shrink-0 rounded-lg"
        style={{ backgroundColor: `hsl(${value} 50% 55%)` }}
      />
      <input
        type="range"
        min={0}
        max={359}
        value={value}
        onChange={handleChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, ${Array.from({ length: 12 }, (_, i) => `hsl(${i * 30} 50% 55%)`).join(", ")})`,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryForm — create/edit category
// ---------------------------------------------------------------------------

function CategoryForm({
  category,
  allCategories,
  onSave,
  onDelete,
  onCancel,
  isPending,
}: {
  category: PresetCategoryFull | null;
  allCategories: PresetCategoryFull[];
  onSave: (data: { name: string; slug: string; icon?: string; color?: string; type?: string; slotTemplate?: SlotTemplateDef[] | null }) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [catType, setCatType] = useState<string>(category?.type ?? "preset");
  const [hue, setHue] = useState(() =>
    category ? parseHue(category.color) : Math.floor(Math.random() * 360),
  );
  const [slots, setSlots] = useState<SlotTemplateDef[]>(category?.slotTemplate ?? []);

  // Preset-type categories available as slot sources
  const presetCategories = allCategories.filter((c) => c.type === "preset");

  function handleNameChange(value: string) {
    setName(value);
    if (!category) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[\s]+/g, "-")
          .replace(/[^a-z0-9\u4e00-\u9fff-]/g, ""),
      );
    }
  }

  function addSlot() {
    if (presetCategories.length === 0) return;
    // Default to first preset category not yet used
    const unused = presetCategories.find((c) => !slots.some((s) => s.categoryId === c.id));
    const catId = unused?.id ?? presetCategories[0].id;
    setSlots([...slots, { categoryId: catId }]);
  }

  function removeSlot(idx: number) {
    setSlots(slots.filter((_, i) => i !== idx));
  }

  function updateSlotCategory(idx: number, categoryId: string) {
    const updated = [...slots];
    const cat = presetCategories.find((c) => c.id === categoryId);
    updated[idx] = { categoryId, label: cat?.name };
    setSlots(updated);
  }

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2">
      <div className="text-[11px] font-medium text-sky-300">
        {category ? "编辑分类" : "新建分类"}
      </div>

      {/* Type toggle — only editable for new categories */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-500 mr-1">类型:</span>
        {(["preset", "group"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!category} // Can't change type of existing category
            onClick={() => setCatType(t)}
            className={`rounded px-2 py-0.5 text-[10px] transition ${
              catType === t
                ? t === "group"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-sky-500/20 text-sky-300"
                : "text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
            }`}
          >
            {t === "preset" ? "预制" : "预制组"}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder="分类名称"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <HueSlider value={hue} onChange={setHue} />

      {/* Slot template editor — only for group-type categories */}
      {catType === "group" && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/10 bg-amber-500/[0.02] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-amber-400/80">默认槽位</span>
            <button
              type="button"
              onClick={addSlot}
              disabled={presetCategories.length === 0}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-amber-400 hover:bg-amber-500/10 disabled:opacity-40"
            >
              <Plus className="size-2.5" /> 添加
            </button>
          </div>
          {slots.length === 0 && (
            <div className="text-[10px] text-zinc-600 py-0.5">无默认槽位，新建预制组时成员列表为空</div>
          )}
          {slots.map((slot, idx) => {
            const slotCat = presetCategories.find((c) => c.id === slot.categoryId);
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 w-4 shrink-0 text-right">{idx + 1}</span>
                <CategoryBadge color={slotCat?.color ?? null} />
                <div className="relative flex-1">
                  <select
                    value={slot.categoryId}
                    onChange={(e) => updateSlotCategory(idx, e.target.value)}
                    className={selectClass}
                  >
                    {presetCategories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
                </div>
                <input
                  type="text"
                  value={slot.label ?? ""}
                  onChange={(e) => {
                    const updated = [...slots];
                    updated[idx] = { ...slot, label: e.target.value || undefined };
                    setSlots(updated);
                  }}
                  placeholder={slotCat?.name ?? "标签"}
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-sky-500/30 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({
            name: name.trim(),
            slug: slug.trim(),
            color: hslString(hue),
            type: category ? undefined : catType,
            slotTemplate: catType === "group" ? slots : undefined,
          })}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="size-3" /> 删除
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Shared folder UI helpers
// ---------------------------------------------------------------------------

function FolderBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: FolderItem[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-zinc-500 flex-wrap">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        disabled={breadcrumb.length === 0}
        className={breadcrumb.length === 0 ? "text-zinc-400" : "text-sky-400 hover:underline"}
      >
        根目录
      </button>
      {breadcrumb.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <ChevronRight className="size-3 text-zinc-600" />
          <button
            type="button"
            onClick={() => onNavigate(f.id)}
            className={f.id === breadcrumb[breadcrumb.length - 1]?.id ? "text-zinc-400" : "text-sky-400 hover:underline"}
            disabled={f.id === breadcrumb[breadcrumb.length - 1]?.id}
          >
            {f.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function FolderRow({
  folder,
  itemCount,
  onEnter,
  onRename,
  onDelete,
  isPending,
}: {
  folder: FolderItem;
  itemCount: number;
  onEnter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(folder.name);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/15">
      <button type="button" onClick={onEnter} className="flex flex-1 items-center gap-2 min-w-0 text-left">
        <Folder className="size-4 shrink-0 text-amber-400/70" />
        {isRenaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onRename(name.trim()); setIsRenaming(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(name.trim()); setIsRenaming(false); }
              if (e.key === "Escape") { setName(folder.name); setIsRenaming(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-xs text-zinc-200 outline-none border-b border-sky-500/40"
          />
        ) : (
          <span className="text-xs text-zinc-200">{folder.name}</span>
        )}
        <span className="text-[10px] text-zinc-500 shrink-0">{itemCount} 项</span>
      </button>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
          className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          title="重命名"
        >
          <Pencil className="size-3" />
        </button>
        {itemCount === 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isPending}
            className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            title="删除空文件夹"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableFolderRow — draggable wrapper for FolderRow
// ---------------------------------------------------------------------------

function SortableFolderRow(props: {
  folder: FolderItem;
  itemCount: number;
  onEnter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.folder.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-zinc-600 hover:text-zinc-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <div className="flex-1 min-w-0">
        <FolderRow {...props} />
      </div>
    </div>
  );
}

/** Flatten folders into indented options for a move-to-folder dropdown */
function buildFolderOptions(folders: FolderItem[], parentId: string | null = null, depth = 0): Array<{ id: string | null; label: string }> {
  const opts: Array<{ id: string | null; label: string }> = [];
  if (depth === 0) opts.push({ id: null, label: "根目录" });
  const children = folders.filter((f) => (f.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of children) {
    opts.push({ id: child.id, label: "\u00A0\u00A0".repeat(depth + 1) + child.name });
    opts.push(...buildFolderOptions(folders, child.id, depth + 1));
  }
  return opts;
}

function MoveToFolderButton({
  currentFolderId,
  folders,
  onMove,
}: {
  currentFolderId: string | null;
  folders: FolderItem[];
  onMove: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildFolderOptions(folders), [folders]);

  if (folders.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
        title="移动到文件夹"
      >
        <FolderInput className="size-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-48 w-44 overflow-auto rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.id ?? "__root"}
              type="button"
              disabled={opt.id === currentFolderId}
              onClick={(e) => { e.stopPropagation(); onMove(opt.id); setOpen(false); }}
              className={`block w-full px-3 py-1 text-left text-[11px] hover:bg-white/[0.06] ${opt.id === currentFolderId ? "text-zinc-600" : "text-zinc-300"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Count items inside a folder (direct children: presets/groups + subfolders) */
function countFolderItems(
  folderId: string,
  folders: FolderItem[],
  presets: { folderId: string | null }[],
  groups?: { folderId: string | null }[],
): number {
  const subFolders = folders.filter((f) => f.parentId === folderId).length;
  const p = presets.filter((x) => x.folderId === folderId).length;
  const g = groups ? groups.filter((x) => x.folderId === folderId).length : 0;
  return subFolders + p + g;
}

// ---------------------------------------------------------------------------
// BatchActionBar — floating bar for multi-select batch actions
// ---------------------------------------------------------------------------

function BatchActionBar({
  selectedCount,
  totalCount,
  folders,
  onMoveToFolder,
  onSelectAll,
  onClearSelection,
}: {
  selectedCount: number;
  totalCount: number;
  folders: FolderItem[];
  onMoveToFolder: (folderId: string | null) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildFolderOptions(folders), [folders]);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1.5">
      <span className="text-[11px] text-sky-300 font-medium">已选 {selectedCount} 项</span>
      {folders.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/30"
          >
            <FolderInput className="size-3" /> 移至文件夹
          </button>
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-44 overflow-auto rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
              {options.map((opt) => (
                <button
                  key={opt.id ?? "__root"}
                  type="button"
                  onClick={() => { onMoveToFolder(opt.id); setOpen(false); }}
                  className="block w-full px-3 py-1 text-left text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={selectedCount === totalCount ? onClearSelection : onSelectAll}
        className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-300"
      >
        {selectedCount === totalCount ? "取消选择" : "全选"}
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
        title="取消选择"
      >
        <X className="size-3" />
      </button>
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
  autoEditPresetId,
  onAutoEditConsumed,
}: {
  category: PresetCategoryFull;
  onRefresh: () => void;
  allCategories: PresetCategoryFull[];
  autoEditPresetId: string | null;
  onAutoEditConsumed: () => void;
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

  // Sync presets when category changes
  useEffect(() => {
    setPresets(category.presets);
  }, [category.presets]);

  // Auto-expand preset when navigating from group
  useEffect(() => {
    if (autoEditPresetId && category.presets.some((p) => p.id === autoEditPresetId)) {
      setEditingId(autoEditPresetId);
      onAutoEditConsumed();
    }
  }, [autoEditPresetId, category.presets, onAutoEditConsumed]);

  // Reset folder when category changes
  useEffect(() => {
    setCurrentFolderId(null);
    setSelectedIds(new Set());
  }, [category.id]);

  // Filter presets and folders for current folder level
  const visiblePresets = presets.filter((p) => (p.folderId ?? null) === currentFolderId);
  const visibleFolders = category.folders.filter((f) => (f.parentId ?? null) === currentFolderId);

  // Clear selection when navigating folders
  const navigateFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
  }, []);

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
      for (const id of ids) {
        await moveToFolder("preset", id, folderId);
      }
      setSelectedIds(new Set());
      onRefresh();
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
      await createPresetFolder(category.id, currentFolderId, newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
      onRefresh();
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
              setEditingId(null);
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
          {visibleFolders.map((folder) => (
            <SortableFolderRow
              key={folder.id}
              folder={folder}
              itemCount={countFolderItems(folder.id, category.folders, presets)}
              onEnter={() => setCurrentFolderId(folder.id)}
              onRename={(newName) => {
                startTransition(async () => {
                  await renamePresetFolder(folder.id, newName);
                  onRefresh();
                });
              }}
              onDelete={() => {
                if (!confirm(`确认删除文件夹「${folder.name}」？`)) return;
                startTransition(async () => {
                  try {
                    await deletePresetFolder(folder.id);
                    onRefresh();
                  } catch (e: unknown) {
                    alert(e instanceof Error ? e.message : "删除失败");
                  }
                });
              }}
              isPending={isPending}
            />
          ))}
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
              setIsCreating(false);
              onRefresh();
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
            strategy={verticalListSortingStrategy}
          >
            {visiblePresets.map((preset) =>
              editingId === preset.id ? (
                <PresetForm
                  key={preset.id}
                  categoryId={category.id}
                  preset={preset}
                  allCategories={allCategories}
                  onSave={(data, variantDrafts) => {
                    startTransition(async () => {
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
                          await createPresetVariant(variantData);
                        }
                      }
                      // Sync updated content (including linked variants) to all sections
                      await syncPresetToSections(preset.id);
                      setEditingId(null);
                      onRefresh();
                    });
                  }}
                  onDelete={() => {
                    startTransition(async () => {
                      // Check usage before deleting
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
                      setEditingId(null);
                      onRefresh();
                    });
                  }}
                  onCancel={() => setEditingId(null)}
                  isPending={isPending}
                />
              ) : (
                <SortablePresetCard
                  key={preset.id}
                  preset={preset}
                  folders={category.folders}
                  onEdit={() => setEditingId(preset.id)}
                  onMoveToFolder={(folderId) => {
                    startTransition(async () => {
                      await moveToFolder("preset", preset.id, folderId);
                      onRefresh();
                    });
                  }}
                  isSelected={selectedIds.has(preset.id)}
                  onToggleSelect={() => togglePresetSelection(preset.id)}
                />
              ),
            )}
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
  onEdit,
  onMoveToFolder,
  isSelected,
  onToggleSelect,
}: {
  preset: PresetFull;
  folders: FolderItem[];
  onEdit: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const variantCount = preset.variantCount;
  const firstVariant = preset.variants[0];
  const lora1 = firstVariant ? parseLoraBindings(firstVariant.lora1) : [];
  const lora2 = firstVariant ? parseLoraBindings(firstVariant.lora2) : [];
  const loraCount = lora1.length + lora2.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/15 cursor-pointer"
    >
      <button
        type="button"
        className="shrink-0 text-zinc-600 hover:text-sky-400"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
      >
        {isSelected ? <CheckSquare className="size-3.5 text-sky-400" /> : <Square className="size-3.5" />}
      </button>
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200">
            {preset.name}
          </span>
          {variantCount > 0 && (
            <span className="text-[9px] text-sky-400/60">
              {variantCount} 变体
            </span>
          )}
          {loraCount > 0 && (
            <span className="text-[9px] text-amber-400/60">
              {loraCount} LoRA
            </span>
          )}
        </div>
        {firstVariant && (
          <div className="mt-1 text-[11px] text-zinc-500 line-clamp-1">
            {firstVariant.prompt.slice(0, 100)}
            {firstVariant.prompt.length > 100 ? "..." : ""}
          </div>
        )}
        {!firstVariant && (
          <div className="mt-1 text-[11px] text-zinc-600">暂无变体</div>
        )}
      </div>
      <MoveToFolderButton
        currentFolderId={preset.folderId}
        folders={folders}
        onMove={onMoveToFolder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedVariantsEditor — select linked variants from other presets
// ---------------------------------------------------------------------------

type LinkedVariantRef = { presetId: string; variantId: string };

function LinkedVariantsEditor({
  linkedVariants,
  onChange,
  currentPresetId,
  allCategories,
}: {
  linkedVariants: LinkedVariantRef[];
  onChange: (lv: LinkedVariantRef[]) => void;
  currentPresetId?: string;
  allCategories: PresetCategoryFull[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build filtered categories excluding current preset
  const categoriesFiltered = useMemo(() => {
    return allCategories
      .map((cat) => ({
        ...cat,
        presets: cat.presets.filter((p) => p.id !== currentPresetId),
      }))
      .filter((cat) => cat.presets.length > 0);
  }, [allCategories, currentPresetId]);

  // Flat list with full variant data for display name + content resolution
  const allItems = useMemo(() => {
    const items: Array<{
      presetId: string;
      presetName: string;
      variantId: string;
      variantName: string;
      categoryName: string;
      displayName: string;
      prompt: string;
      negativePrompt: string | null;
      lora1: ReturnType<typeof parseLoraBindings>;
      lora2: ReturnType<typeof parseLoraBindings>;
    }> = [];
    for (const cat of categoriesFiltered) {
      for (const preset of cat.presets) {
        for (const v of preset.variants) {
          items.push({
            presetId: preset.id,
            variantId: v.id,
            presetName: preset.name,
            variantName: v.name,
            categoryName: cat.name,
            displayName: preset.variants.length === 1
              ? `${cat.name} / ${preset.name}`
              : `${cat.name} / ${preset.name} / ${v.name}`,
            prompt: v.prompt ?? "",
            negativePrompt: v.negativePrompt,
            lora1: parseLoraBindings(v.lora1),
            lora2: parseLoraBindings(v.lora2),
          });
        }
      }
    }
    return items;
  }, [categoriesFiltered]);

  // Resolve display + content for current linked variants
  const linkedDisplay = linkedVariants.map((ref) => {
    const item = allItems.find((a) => a.variantId === ref.variantId);
    return {
      ...ref,
      displayName: item?.displayName ?? `未知变体 (${ref.variantId.slice(0, 8)}...)`,
      prompt: item?.prompt ?? "",
      negativePrompt: item?.negativePrompt,
      lora1: item?.lora1 ?? [],
      lora2: item?.lora2 ?? [],
    };
  });

  function handleAdd(val: { presetId: string; variantId: string }) {
    if (linkedVariants.some((lv) => lv.variantId === val.variantId)) return;
    onChange([...linkedVariants, { presetId: val.presetId, variantId: val.variantId }]);
  }

  function handleRemove(variantId: string) {
    onChange(linkedVariants.filter((lv) => lv.variantId !== variantId));
  }

  // Filter out already-linked variants from picker categories
  const pickerCategories = useMemo(() => {
    return categoriesFiltered.map((cat) => ({
      ...cat,
      presets: cat.presets.map((p) => ({
        ...p,
        variants: p.variants.filter((v) => !linkedVariants.some((lv) => lv.variantId === v.id)),
      })).filter((p) => p.variants.length > 0),
    })).filter((cat) => cat.presets.length > 0);
  }, [categoriesFiltered, linkedVariants]);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-zinc-500">关联变体</span>

      {/* Current linked variants */}
      {linkedDisplay.length > 0 && (
        <div className="space-y-1">
          {linkedDisplay.map((item) => {
            const isExpanded = expandedId === item.variantId;
            const hasContent = item.prompt || item.negativePrompt || item.lora1.length > 0 || item.lora2.length > 0;
            return (
              <div
                key={item.variantId}
                className="rounded-lg border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.variantId)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  >
                    {hasContent && (
                      <ChevronDown className={`size-3 shrink-0 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    )}
                    <span className="text-xs text-zinc-300 truncate">{item.displayName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.variantId)}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                {/* Expanded preview: prompt + LoRA */}
                {isExpanded && hasContent && (
                  <div className="space-y-1.5 border-t border-white/5 px-2.5 py-2">
                    {item.prompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">正面提示词</span>
                        <div className="mt-0.5 rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {item.prompt}
                        </div>
                      </div>
                    )}
                    {item.negativePrompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">负面提示词</span>
                        <div className="mt-0.5 rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {item.negativePrompt}
                        </div>
                      </div>
                    )}
                    {item.lora1.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 1</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora1.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
                              <span className="shrink-0 text-zinc-600">{l.weight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.lora2.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 2</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora2.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
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
          })}
        </div>
      )}

      {linkedVariants.length === 0 && !showPicker && (
        <div className="text-xs text-zinc-600">无关联变体</div>
      )}

      {/* Full-width add button / picker */}
      {showPicker ? (
        <PresetCascadePicker
          categories={pickerCategories}
          value={null}
          onChange={(val) => {
            if (val) handleAdd({ presetId: val.presetId, variantId: val.variantId });
          }}
          placeholder="选择关联变体…"
          presetCategoriesOnly
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition"
        >
          <Plus className="size-3 inline-block mr-1 -mt-0.5" />添加关联变体
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableVariantBar — draggable bar for a single variant in PresetForm
// ---------------------------------------------------------------------------

function SortableVariantBar({
  sortId,
  name,
  isSelected,
  onSelect,
}: {
  sortId: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`flex items-center gap-1.5 rounded-lg border p-2 cursor-pointer transition ${
        isSelected
          ? "border-sky-500/30 bg-sky-500/10"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <div className="flex-1 min-w-0 truncate text-xs text-zinc-300">{name || "未命名变体"}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetForm — create/edit form for a preset with inline variant editing
// ---------------------------------------------------------------------------

type VariantDraft = {
  id?: string; // undefined = new variant
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string;
  lora1: import("@/lib/lora-types").LoraBinding[];
  lora2: import("@/lib/lora-types").LoraBinding[];
  linkedVariants: LinkedVariantRef[];
};

function PresetForm({
  categoryId,
  folderId,
  preset,
  onSave,
  onDelete,
  onCancel,
  isPending,
  allCategories,
}: {
  categoryId: string;
  folderId?: string | null;
  preset: PresetFull | null;
  onSave: (data: {
    categoryId: string;
    folderId?: string | null;
    name: string;
    slug: string;
    notes?: string | null;
    isActive?: boolean;
  }, variantDrafts: VariantDraft[]) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isPending: boolean;
  allCategories: PresetCategoryFull[];
}) {
  const router = useRouter();
  const [, startVariantTransition] = useTransition();

  // Preset-level fields
  const [name, setName] = useState(preset?.name ?? "");
  const [slug, setSlug] = useState(preset?.slug ?? "");
  const [notes, setNotes] = useState(preset?.notes ?? "");

  // Variant state
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (preset && preset.variants.length > 0) {
      return preset.variants.map((v) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt ?? "",
        lora1: parseLoraBindings(v.lora1),
        lora2: parseLoraBindings(v.lora2),
        linkedVariants: v.linkedVariants ?? [],
      }));
    }
    // New preset: start with one empty variant
    return [{ name: "默认", slug: "default", prompt: "", negativePrompt: "", lora1: [], lora2: [], linkedVariants: [] }];
  });
  const [currentIdx, setCurrentIdx] = useState(0);

  // DnD for variant reordering
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const variantIds = useMemo(() => variants.map((_, i) => `variant-sort-${i}`), [variants]);
  const current = variants[currentIdx];
  const totalVariants = variants.length;

  function handleNameChange(value: string) {
    setName(value);
    if (!preset) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[\s]+/g, "-")
          .replace(/[^a-z0-9\u4e00-\u9fff-]/g, ""),
      );
    }
  }

  function handleVariantNameChange(value: string) {
    const updated = [...variants];
    updated[currentIdx] = { ...current, name: value };
    // Auto-slug for variant
    if (!current.id) {
      updated[currentIdx].slug = value
        .toLowerCase()
        .replace(/[\s]+/g, "-")
        .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "") || "variant";
    }
    setVariants(updated);
  }

  function updateCurrentVariant(patch: Partial<VariantDraft>) {
    const updated = [...variants];
    updated[currentIdx] = { ...current, ...patch };
    setVariants(updated);
  }

  function addVariant() {
    const newIdx = variants.length;
    const prev = variants[variants.length - 1];
    setVariants([...variants, {
      name: `变体 ${newIdx + 1}`,
      slug: `variant-${newIdx + 1}`,
      prompt: prev?.prompt ?? "",
      negativePrompt: prev?.negativePrompt ?? "",
      lora1: prev?.lora1 ? [...prev.lora1] : [],
      lora2: prev?.lora2 ? [...prev.lora2] : [],
      linkedVariants: prev?.linkedVariants ? [...prev.linkedVariants] : [],
    }]);
    setCurrentIdx(newIdx);
  }

  function removeCurrentVariant() {
    if (totalVariants <= 1) return;
    if (!confirm(`确认删除变体「${current.name}」？`)) return;

    // If existing variant, call server delete
    if (current.id) {
      startVariantTransition(async () => {
        await deletePresetVariant(current.id!);
      });
    }

    const updated = variants.filter((_, i) => i !== currentIdx);
    setVariants(updated);
    setCurrentIdx(Math.min(currentIdx, updated.length - 1));
  }

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = variantIds.indexOf(active.id as string);
    const newIdx = variantIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(variants, oldIdx, newIdx);
    setVariants(reordered);

    // Follow the selected variant if it moved
    if (oldIdx === currentIdx) {
      setCurrentIdx(newIdx);
    } else if (oldIdx < currentIdx && newIdx >= currentIdx) {
      setCurrentIdx(currentIdx - 1);
    } else if (oldIdx > currentIdx && newIdx <= currentIdx) {
      setCurrentIdx(currentIdx + 1);
    }

    // Persist order for existing variants with real DB ids
    if (preset) {
      const idsWithOrder = reordered
        .filter((v) => v.id)
        .map((v) => v.id!);
      if (idsWithOrder.length > 0) {
        startVariantTransition(async () => {
          await reorderPresetVariants(preset.id, idsWithOrder);
        });
      }
    }
  }

  async function handleSubmit() {
    // Pass preset data + variant drafts to parent for saving
    onSave({
      categoryId,
      folderId,
      name: name.trim(),
      slug: slug.trim(),
      notes: notes.trim() || null,
      isActive: true,
    }, variants);
  }

  // For new presets, variants are saved after the preset is created
  // We need a post-save callback — handled by the parent's onSave flow

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-3">
      <div className="text-[11px] font-medium text-sky-300">
        {preset ? "编辑预制" : "新建预制"}
      </div>

      {/* Preset-level: name + slug */}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">预制名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="预制名称"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500">备注</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="可选备注..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      {/* Linked variants (preset-level, below notes, above variant list) */}
      <LinkedVariantsEditor
        linkedVariants={current.linkedVariants}
        onChange={(lv) => updateCurrentVariant({ linkedVariants: lv })}
        currentPresetId={preset?.id}
        allCategories={allCategories}
      />

      {/* ── Variant section ── */}
      <div className="border-t border-white/5 pt-3 space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-500">变体列表</span>
      </div>
      <div className="space-y-2">
        {/* Sortable variant list */}
        <div className="space-y-1">
          {mounted ? (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleVariantDragEnd}
            >
              <SortableContext items={variantIds} strategy={verticalListSortingStrategy}>
                {variants.map((v, i) => (
                  <SortableVariantBar
                    key={variantIds[i]}
                    sortId={variantIds[i]}
                    name={v.name}
                    isSelected={i === currentIdx}
                    onSelect={() => setCurrentIdx(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            variants.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-2"
              >
                <GripVertical className="size-3 text-zinc-600" />
                <div className="flex-1 min-w-0 truncate text-xs text-zinc-300">{v.name || "未命名变体"}</div>
              </div>
            ))
          )}
        </div>

        {/* Add / Delete buttons */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={addVariant}
            className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition"
          >
            <Plus className="size-3 inline-block mr-1 -mt-0.5" />添加变体
          </button>
          {totalVariants > 1 && (
            <button
              type="button"
              onClick={removeCurrentVariant}
              className="w-full rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition"
            >
              <Trash2 className="size-3 inline-block mr-1 -mt-0.5" />删除变体
            </button>
          )}
        </div>


        {/* Variant name + slug */}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">变体名称</span>
            <input
              type="text"
              value={current.name}
              onChange={(e) => handleVariantNameChange(e.target.value)}
              placeholder="变体名称"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">变体 Slug</span>
            <input
              type="text"
              value={current.slug}
              onChange={(e) => updateCurrentVariant({ slug: e.target.value })}
              placeholder="variant-slug"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
        </div>

        {/* Variant prompt fields */}
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">正面提示词</span>
          <textarea
            value={current.prompt}
            onChange={(e) => updateCurrentVariant({ prompt: e.target.value })}
            rows={3}
            placeholder="positive prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">负面提示词</span>
          <textarea
            value={current.negativePrompt}
            onChange={(e) => updateCurrentVariant({ negativePrompt: e.target.value })}
            rows={2}
            placeholder="negative prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">LoRA 1（第一阶段）</span>
          <LoraBindingEditor bindings={current.lora1} onChange={(v) => updateCurrentVariant({ lora1: v })} />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">LoRA 2（高清修复）</span>
          <LoraBindingEditor bindings={current.lora2} onChange={(v) => updateCurrentVariant({ lora2: v })} />
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-1.5 border-t border-white/5 pt-3">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="size-3" /> 删除预制
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupManager — 预制组管理
// ---------------------------------------------------------------------------

function GroupList({
  category,
  allCategories,
  onRefresh,
  onNavigateToPreset,
}: {
  category: PresetCategoryFull;
  allCategories: PresetCategoryFull[];
  onRefresh: () => void;
  onNavigateToPreset: (presetId: string) => void;
}) {
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
      for (const id of ids) {
        await moveToFolder("group", id, folderId);
      }
      setSelectedGroupIds(new Set());
      onRefresh();
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
      await createPresetFolder(category.id, currentFolderId, newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
      onRefresh();
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
        <button
          type="button"
          onClick={() => setIsCreatingFolder(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.08]"
          title="新建文件夹"
        >
          <FolderPlus className="size-3" />
        </button>
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
                  await renamePresetFolder(folder.id, newName);
                  onRefresh();
                });
              }}
              onDelete={() => {
                if (!confirm(`确认删除文件夹「${folder.name}」？`)) return;
                startTransition(async () => {
                  try {
                    await deletePresetFolder(folder.id);
                    onRefresh();
                  } catch (e: unknown) {
                    alert(e instanceof Error ? e.message : "删除失败");
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
          strategy={verticalListSortingStrategy}
        >
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
                  await moveToFolder("group", group.id, folderId);
                  onRefresh();
                });
              }}
              isPending={isPending}
              startTransition={startTransition}
              isSelected={selectedGroupIds.has(group.id)}
              onToggleSelect={() => toggleGroupSelection(group.id)}
              onNavigateToPreset={onNavigateToPreset}
            />
          ))}
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
              const group = await createPresetGroup(data);
              for (const m of members) {
                await addGroupMember({ groupId: group.id, ...m });
              }
              setShowCreateForm(false);
              onRefresh();
            });
          }}
          onCancel={() => setShowCreateForm(false)}
          isPending={isPending}
        />
      )}

      {!showCreateForm && (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-400 hover:border-white/20 hover:text-zinc-200"
        >
          <Plus className="size-3.5" /> 新建预制组
        </button>
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
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}
        className="flex cursor-pointer items-center gap-2 px-3 py-2.5 transition hover:bg-white/[0.03]"
      >
        <button
          type="button"
          className="shrink-0 text-zinc-600 hover:text-sky-400"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          {isSelected ? <CheckSquare className="size-3.5 text-sky-400" /> : <Square className="size-3.5" />}
        </button>
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <FolderOpen className="size-4 shrink-0 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200">{group.name}</div>
          <div className="text-[10px] text-zinc-500">
            {members.length} 个成员 · {group.slug}
          </div>
        </div>
        <MoveToFolderButton
          currentFolderId={group.folderId}
          folders={folders}
          onMove={onMoveToFolder}
        />
        <ChevronDown className={`size-3.5 text-zinc-500 transition ${isEditing ? "rotate-180" : ""}`} />
      </div>

      {isEditing && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          <GroupInlineEditor
            group={group}
            onSave={(data) => {
              startTransition(async () => {
                await updatePresetGroup(group.id, data);
                onRefresh();
              });
            }}
            onDelete={() => {
              if (!confirm(`确认删除预制组「${group.name}」？`)) return;
              startTransition(async () => {
                await deletePresetGroup(group.id);
                onGroupDeleted();
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
                          await removeGroupMember(m.id);
                          onRefresh();
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
                await addGroupMember(input);
                onRefresh();
              });
            }}
            isPending={isPending}
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
                <FolderOpen className="mr-1 inline size-3" />
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
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 space-y-3">
      <div className="text-[11px] font-medium text-sky-300">新建预制组</div>

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
  );
}

/** Simple slug generator */
function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
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
// AddGroupMemberForm
// ---------------------------------------------------------------------------

function AddGroupMemberForm({
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
