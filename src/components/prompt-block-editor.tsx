"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
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
  GripVertical,
  Plus,
  Pencil,
  Save,
  Trash2,
  X,
  Loader2,
  Sparkles,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import {
  addSectionBlock,
  updateSectionBlock,
  deleteSectionBlock,
  reorderSectionBlocks,
  type PromptBlockData,
} from "@/lib/actions";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LibraryItem = {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string | null;
  lora1?: unknown;
  lora2?: unknown;
};

/** V2 dynamic library: categories from DB */
export type PromptLibraryV2 = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
    presets: Array<{
      id: string;
      name: string;
      variants: Array<{
        id: string;
        name: string;
        prompt: string;
        negativePrompt: string | null;
        lora1: unknown;
        lora2: unknown;
      }>;
    }>;
  }>;
};

/** Category config for dynamic badge rendering */
type CategoryConfig = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

// ---------------------------------------------------------------------------
// Icon / Color resolution
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  BookOpen,
};

function resolveIcon(name: string | null | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || Sparkles;
}

/** Parse HSL color string "H S% L%" → hue number. Supports legacy tailwind names. */
function parseHue(color: string | null | undefined): number {
  if (!color) return 0;
  const match = color.match(/^(\d+)\s/);
  if (match) return parseInt(match[1], 10);
  const LEGACY: Record<string, number> = {
    sky: 200, emerald: 160, violet: 270, amber: 38, rose: 350,
    cyan: 185, pink: 330, orange: 25,
  };
  return LEGACY[color] ?? 0;
}

/** Build inline style object for category-colored elements */
function categoryStyle(color: string | null | undefined): React.CSSProperties {
  const h = parseHue(color);
  return {
    borderColor: `hsl(${h} 50% 55% / 0.3)`,
    backgroundColor: `hsl(${h} 50% 55% / 0.1)`,
    color: `hsl(${h} 80% 72%)`,
  };
}

// ---------------------------------------------------------------------------
// TypeBadge — dynamic, uses categoryId
// ---------------------------------------------------------------------------

function TypeBadge({
  block,
  categoryMap,
}: {
  block: PromptBlockData;
  categoryMap: Map<string, CategoryConfig>;
}) {
  // Try category-based lookup first
  if (block.categoryId) {
    const cat = categoryMap.get(block.categoryId);
    if (cat) {
      const Icon = resolveIcon(cat.icon);
      return (
        <span
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium"
          style={categoryStyle(cat.color)}
        >
          <Icon className="size-3" />
          {cat.name}
        </span>
      );
    }
  }

  // Custom fallback
  if (block.type === "custom") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
        <Sparkles className="size-3" />
        自定义
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
      <Sparkles className="size-3" />
      预设
    </span>
  );
}

// ---------------------------------------------------------------------------
// SortableBlockCard
// ---------------------------------------------------------------------------

type SortableBlockCardProps = {
  block: PromptBlockData;
  column: "positive" | "negative";
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  isSaving: boolean;
  categoryMap: Map<string, CategoryConfig>;
};

function SortableBlockCard({
  block,
  column,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSaving,
  categoryMap,
}: SortableBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const style = mounted
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const text = column === "positive" ? block.positive : (block.negative ?? "");
  const isEmpty = !text.trim();

  if (isEmpty && !isEditing) return null;

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-1.5 p-2">
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400"
          {...(mounted ? attributes : {})}
          {...(mounted ? listeners : {})}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-300 truncate">{block.label}</span>
            <TypeBadge block={block} categoryMap={categoryMap} />
          </div>
          {!isEditing && (
            <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
              {text.slice(0, 60)}{text.length > 60 ? "..." : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {!isEditing && (
            <button type="button" onClick={onStartEdit} className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white">
              <Pencil className="size-3" />
            </button>
          )}
          <button type="button" onClick={onDelete} className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-white/5 p-2 space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveEdit}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
            >
              <X className="size-3" /> 取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockColumn
// ---------------------------------------------------------------------------

type BlockColumnProps = {
  title: string;
  titleColor: string;
  column: "positive" | "negative";
  blocks: PromptBlockData[];
  editingId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onStartEdit: (block: PromptBlockData) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (blockId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  isSaving: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onCancelAdd: () => void;
  onSubmitAdd: (input: { type: string; label: string; positive: string; negative?: string | null; sourceId?: string; categoryId?: string | null }, item?: LibraryItem) => void;
  libraryV2?: PromptLibraryV2;
  categoryMap: Map<string, CategoryConfig>;
};

function BlockColumn({
  title,
  titleColor,
  column,
  blocks,
  editingId,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onDragEnd,
  isSaving,
  isAdding,
  onAdd,
  onCancelAdd,
  onSubmitAdd,
  libraryV2,
  categoryMap,
}: BlockColumnProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleBlocks = blocks.filter((b) => {
    const text = column === "positive" ? b.positive : (b.negative ?? "");
    return text.trim() || editingId === b.id;
  });

  const blockItems = blocks.map((b) => b.id);

  const cardList = (
    <div className="space-y-1.5">
      {visibleBlocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/5 px-3 py-4 text-center text-[11px] text-zinc-600">
          暂无
        </div>
      ) : (
        visibleBlocks.map((block) => (
          <SortableBlockCard
            key={block.id}
            block={block}
            column={column}
            isEditing={editingId === block.id}
            editValue={editValue}
            onEditChange={onEditChange}
            onStartEdit={() => onStartEdit(block)}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onDelete={() => onDelete(block.id)}
            isSaving={isSaving}
            categoryMap={categoryMap}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="flex-1 min-w-0">
      <div className={`mb-2 text-xs font-medium ${titleColor}`}>{title}</div>
      {mounted ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blockItems} strategy={verticalListSortingStrategy}>
            {cardList}
          </SortableContext>
        </DndContext>
      ) : (
        cardList
      )}
      {isAdding ? (
        <div className="mt-2">
          <AddBlockForm
            polarity={column}
            onAdd={onSubmitAdd}
            onCancel={onCancelAdd}
            isPending={isSaving}
            libraryV2={libraryV2}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <Plus className="size-3" />
          添加{column === "positive" ? "正面" : "负面"}提示词块
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddBlockForm — dynamic categories from PromptLibraryV2
// ---------------------------------------------------------------------------

type AddBlockFormProps = {
  polarity: "positive" | "negative";
  onAdd: (input: { type: string; label: string; positive: string; negative?: string | null; sourceId?: string; categoryId?: string | null }, item?: LibraryItem) => void;
  onCancel: () => void;
  isPending: boolean;
  libraryV2?: PromptLibraryV2;
};

type AddMode = "custom" | "library";

function AddBlockForm({
  polarity,
  onAdd,
  onCancel,
  isPending,
  libraryV2,
}: AddBlockFormProps) {
  const [mode, setMode] = useState<AddMode>("custom");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");

  // Get categories that have presets with variants
  const categoriesWithPresets = useMemo(
    () => (libraryV2?.categories ?? []).filter((c) => c.presets.some((p) => p.variants.length > 0)),
    [libraryV2],
  );

  // Auto-select first category
  useEffect(() => {
    if (categoriesWithPresets.length > 0 && !selectedCatId) {
      setSelectedCatId(categoriesWithPresets[0].id);
    }
  }, [categoriesWithPresets, selectedCatId]);

  const selectedCategory = categoriesWithPresets.find((c) => c.id === selectedCatId);
  const libraryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.presets.flatMap((preset) =>
      preset.variants.map((v) => ({
        id: v.id,
        name: preset.variants.length === 1 ? preset.name : `${preset.name} / ${v.name}`,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt,
        lora1: v.lora1,
        lora2: v.lora2,
      })),
    );
  }, [selectedCategory]);

  // Reset selection when switching category
  useEffect(() => {
    setSelectedId("");
  }, [selectedCatId]);

  function handleSubmitCustom() {
    const text = polarity === "positive" ? positive : negative;
    if (!text.trim()) return;
    onAdd({
      type: "custom",
      label: "自定义",
      positive: polarity === "positive" ? positive.trim() : "",
      negative: polarity === "negative" ? negative.trim() : null,
    });
  }

  function handleSubmitLibrary() {
    if (!selectedId || !selectedCategory) return;
    const item = libraryItems.find((i) => i.id === selectedId);
    if (!item) return;

    onAdd(
      {
        type: "preset",
        label: item.name,
        positive: item.prompt,
        negative: item.negativePrompt,
        sourceId: item.id,
        categoryId: selectedCategory.id,
      },
      {
        id: item.id,
        name: item.name,
        prompt: item.prompt,
        negativePrompt: item.negativePrompt,
        lora1: item.lora1,
        lora2: item.lora2,
      },
    );
  }

  const hasLibrary = categoriesWithPresets.length > 0;

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-sky-300">
          添加{polarity === "positive" ? "正面" : "负面"}提示词块
        </div>
        {hasLibrary && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-lg px-2 py-1 text-[10px] transition ${
                mode === "custom"
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              自定义
            </button>
            <button
              type="button"
              onClick={() => setMode("library")}
              className={`rounded-lg px-2 py-1 text-[10px] transition ${
                mode === "library"
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              从预制库导入
            </button>
          </div>
        )}
      </div>

      {mode === "custom" ? (
        <>
          <textarea
            value={polarity === "positive" ? positive : negative}
            onChange={(e) => polarity === "positive" ? setPositive(e.target.value) : setNegative(e.target.value)}
            rows={2}
            placeholder="提示词内容…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending || !(polarity === "positive" ? positive : negative).trim()}
              onClick={handleSubmitCustom}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              添加
            </button>
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]">
              <X className="size-3" /> 取消
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Dynamic category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {categoriesWithPresets.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCatId(cat.id)}
                className={`rounded-lg px-2 py-1 text-[10px] transition ${
                  selectedCatId === cat.id
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {cat.name} ({cat.presets.reduce((n, p) => n + p.variants.length, 0)})
              </button>
            ))}
          </div>

          {/* Preset list */}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {libraryItems.length === 0 ? (
              <div className="text-center text-[11px] text-zinc-600 py-2">该分类暂无预制</div>
            ) : (
              libraryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-lg border p-2 text-left transition ${
                    selectedId === item.id
                      ? "border-sky-500/30 bg-sky-500/10"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10"
                  }`}
                >
                  <div className="text-[11px] font-medium text-zinc-200">{item.name}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-500 truncate">
                    {item.prompt.slice(0, 50)}{item.prompt.length > 50 ? "..." : ""}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending || !selectedId}
              onClick={handleSubmitLibrary}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              导入
            </button>
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]">
              <X className="size-3" /> 取消
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptBlockEditor — main component
// ---------------------------------------------------------------------------

export function PromptBlockEditor({
  sectionId,
  initialBlocks,
  libraryV2,
  onBlockImport,
}: {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  /** V2 dynamic library from PresetCategory/Preset */
  libraryV2?: PromptLibraryV2;
  onBlockImport?: (
    sourceType: string,
    sourceId: string,
    sourceName: string,
    lora1Bindings?: unknown,
    lora2Bindings?: unknown,
    categoryName?: string,
    categoryColor?: string | null,
  ) => void;
}) {
  const [blocks, setBlocks] = useState<PromptBlockData[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColumn, setEditColumn] = useState<"positive" | "negative">("positive");
  const [editValue, setEditValue] = useState("");
  const [addingColumn, setAddingColumn] = useState<"positive" | "negative" | null>(null);
  const [isPending, startTransition] = useTransition();

  // Build category map for TypeBadge
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryConfig>();
    for (const cat of libraryV2?.categories ?? []) {
      map.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon });
    }
    return map;
  }, [libraryV2]);

  // ---- Edit handlers ----

  function startEdit(block: PromptBlockData, column: "positive" | "negative") {
    setEditingId(block.id);
    setEditColumn(column);
    setEditValue(column === "positive" ? block.positive : (block.negative ?? ""));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function saveEdit() {
    if (!editingId) return;
    const block = blocks.find((b) => b.id === editingId);
    if (!block) return;

    const update = editColumn === "positive"
      ? { positive: editValue.trim() }
      : { negative: editValue.trim() || null };

    startTransition(async () => {
      const updated = await updateSectionBlock(editingId, update);
      setBlocks((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
      setEditingId(null);
      setEditValue("");
    });
  }

  // ---- Delete handler ----

  function handleDelete(blockId: string) {
    if (!confirm("确认删除此提示词块？")) return;
    startTransition(async () => {
      await deleteSectionBlock(blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (editingId === blockId) cancelEdit();
    });
  }

  // ---- Add handler ----

  function handleAdd(
    input: { type: string; label: string; positive: string; negative?: string | null; sourceId?: string; categoryId?: string | null },
    libraryItem?: LibraryItem,
  ) {
    startTransition(async () => {
      const newBlock = await addSectionBlock(sectionId, {
        type: input.type,
        label: input.label,
        positive: input.positive,
        negative: input.negative,
        sourceId: input.sourceId,
        categoryId: input.categoryId,
      });
      setBlocks((prev) => [...prev, newBlock]);
      setAddingColumn(null);

      // Notify parent about imported LoRA if applicable
      if (onBlockImport && libraryItem && input.sourceId) {
        // Find the category info for this preset
        const cat = libraryV2?.categories.find((c) =>
          c.presets.some((p) => p.id === input.sourceId),
        );
        onBlockImport(
          input.type === "preset" ? (input.categoryId ?? "preset") : input.type,
          input.sourceId,
          input.label,
          libraryItem.lora1,
          libraryItem.lora2,
          cat?.name,
          cat?.color,
        );
      }
    });
  }

  // ---- DnD reorder ----

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(nextBlocks);

    startTransition(async () => {
      const reordered = await reorderSectionBlocks(sectionId, nextBlocks.map((b) => b.id));
      setBlocks(reordered);
    });
  }

  // ---- Composed prompt preview ----

  const hasPositive = blocks.some((b) => b.positive?.trim());
  const hasNegative = blocks.some((b) => b.negative?.trim());

  return (
    <div className="space-y-4">
      {/* Composed prompt preview */}
      {blocks.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] p-3 space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">合成提示词预览</div>
          {blocks.map((b) => (
            <div key={b.id} className="text-xs break-words leading-relaxed">
              {b.positive?.trim() && (
                <div className="text-zinc-300">
                  <span className="text-emerald-500/60">+</span>{" "}
                  <span className="text-zinc-500">[{b.label}]</span> {b.positive.trim()}
                </div>
              )}
              {b.negative?.trim() && (
                <div className="text-zinc-400">
                  <span className="text-rose-500/60">−</span>{" "}
                  <span className="text-zinc-500">[{b.label}]</span> {b.negative.trim()}
                </div>
              )}
            </div>
          ))}
          {!hasPositive && !hasNegative && (
            <div className="text-xs text-zinc-500">（无）</div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BlockColumn
          title="✅ 正面提示词"
          titleColor="text-emerald-400"
          column="positive"
          blocks={blocks}
          editingId={editColumn === "positive" ? editingId : null}
          editValue={editColumn === "positive" ? editValue : ""}
          onEditChange={setEditValue}
          onStartEdit={(block) => startEdit(block, "positive")}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onDelete={handleDelete}
          onDragEnd={handleDragEnd}
          isSaving={isPending}
          isAdding={addingColumn === "positive"}
          onAdd={() => setAddingColumn("positive")}
          onCancelAdd={() => setAddingColumn(null)}
          onSubmitAdd={handleAdd}
          libraryV2={libraryV2}
          categoryMap={categoryMap}
        />
        <BlockColumn
          title="❌ 负面提示词"
          titleColor="text-rose-400"
          column="negative"
          blocks={blocks}
          editingId={editColumn === "negative" ? editingId : null}
          editValue={editColumn === "negative" ? editValue : ""}
          onEditChange={setEditValue}
          onStartEdit={(block) => startEdit(block, "negative")}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onDelete={handleDelete}
          onDragEnd={handleDragEnd}
          isSaving={isPending}
          isAdding={addingColumn === "negative"}
          onAdd={() => setAddingColumn("negative")}
          onCancelAdd={() => setAddingColumn(null)}
          onSubmitAdd={handleAdd}
          libraryV2={libraryV2}
          categoryMap={categoryMap}
        />
      </div>
    </div>
  );
}
