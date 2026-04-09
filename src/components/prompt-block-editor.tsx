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
  Unlink,
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

/** V2 dynamic library: categories from DB */
export type PromptLibraryV2 = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
    type?: string; // "preset" | "group"
    positivePromptOrder?: number;
    lora1Order?: number;
    lora2Order?: number;
    folders?: Array<{ id: string; name: string; parentId: string | null; sortOrder: number }>;
    presets: Array<{
      id: string;
      name: string;
      folderId?: string | null;
      variants: Array<{
        id: string;
        name: string;
        prompt: string;
        negativePrompt: string | null;
        lora1: unknown;
        lora2: unknown;
      }>;
    }>;
    groups?: Array<{
      id: string;
      name: string;
      slug: string;
      folderId?: string | null;
      members: Array<{
        id: string;
        presetId: string | null;
        variantId: string | null;
        subGroupId: string | null;
        presetName?: string;
        variantName?: string;
        subGroupName?: string;
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
  onStandaloneDelete?: () => void;
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
  onStandaloneDelete,
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
          {onStandaloneDelete && block.bindingId && (
            <button type="button" onClick={onStandaloneDelete} title="独立删除（仅此块）" className="rounded p-1 text-zinc-500 hover:bg-amber-500/10 hover:text-amber-400">
              <Unlink className="size-3" />
            </button>
          )}
          <button type="button" onClick={onDelete} title="级联删除（含绑定）" className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400">
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
  onStandaloneDelete?: (blockId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  isSaving: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onCancelAdd: () => void;
  onSubmitAdd: (input: { type: string; label: string; positive: string; negative?: string | null }) => void;
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
  onStandaloneDelete,
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
            onStandaloneDelete={onStandaloneDelete ? () => onStandaloneDelete(block.id) : undefined}
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
// AddBlockForm — custom blocks only (preset import moved to SectionEditor)
// ---------------------------------------------------------------------------

type AddBlockFormProps = {
  polarity: "positive" | "negative";
  onAdd: (input: { type: string; label: string; positive: string; negative?: string | null }) => void;
  onCancel: () => void;
  isPending: boolean;
};

function AddBlockForm({ polarity, onAdd, onCancel, isPending }: AddBlockFormProps) {
  const [text, setText] = useState("");

  function handleSubmit() {
    if (!text.trim()) return;
    onAdd({
      type: "custom",
      label: "自定义",
      positive: polarity === "positive" ? text.trim() : "",
      negative: polarity === "negative" ? text.trim() : null,
    });
  }

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-3">
      <div className="text-[11px] font-medium text-sky-300">
        添加{polarity === "positive" ? "正面" : "负面"}提示词块
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="提示词内容…"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
      />
      <div className="flex gap-1.5">
        <button type="button" disabled={isPending || !text.trim()} onClick={handleSubmit}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50">
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} 添加
        </button>
        <button type="button" onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]">
          <X className="size-3" /> 取消
        </button>
      </div>
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
  onDeleteConfirm,
  onBlockDeleted,
  onStandaloneDeleteConfirm,
  onStandaloneBlockDeleted,
}: {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  /** V2 dynamic library from PresetCategory/Preset */
  libraryV2?: PromptLibraryV2;
  /** Return false to cancel delete. Used for binding protection. */
  onDeleteConfirm?: (blockId: string) => boolean;
  /** Called after a block is deleted (for binding cascade). */
  onBlockDeleted?: (blockId: string) => void;
  /** Return false to cancel standalone delete. */
  onStandaloneDeleteConfirm?: (blockId: string) => boolean;
  /** Called after a block is standalone-deleted (no cascade). */
  onStandaloneBlockDeleted?: (blockId: string) => void;
}) {
  const [blocks, setBlocks] = useState<PromptBlockData[]>(initialBlocks);

  // Sync with parent state changes (e.g. after binding delete)
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);
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
    // Check binding protection
    if (onDeleteConfirm && !onDeleteConfirm(blockId)) return;
    if (!onDeleteConfirm && !confirm("确认删除此提示词块？")) return;

    startTransition(async () => {
      await deleteSectionBlock(blockId);
      if (onBlockDeleted) {
        onBlockDeleted(blockId);
      } else {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      }
      if (editingId === blockId) cancelEdit();
    });
  }

  function handleStandaloneDelete(blockId: string) {
    if (onStandaloneDeleteConfirm && !onStandaloneDeleteConfirm(blockId)) return;
    if (!onStandaloneDeleteConfirm && !confirm("独立删除此提示词块？")) return;

    startTransition(async () => {
      await deleteSectionBlock(blockId);
      if (onStandaloneBlockDeleted) {
        onStandaloneBlockDeleted(blockId);
      } else {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      }
      if (editingId === blockId) cancelEdit();
    });
  }

  // ---- Add handler ----

  function handleAdd(
    input: { type: string; label: string; positive: string; negative?: string | null; sourceId?: string; categoryId?: string | null },
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
          onStandaloneDelete={onStandaloneBlockDeleted ? handleStandaloneDelete : undefined}
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
          onStandaloneDelete={onStandaloneBlockDeleted ? handleStandaloneDelete : undefined}
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
