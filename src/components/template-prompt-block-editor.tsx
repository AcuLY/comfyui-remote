"use client";

import { useState, useMemo } from "react";
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
  Sparkles,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { ProjectTemplateSectionData } from "@/lib/server-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateBlockData = ProjectTemplateSectionData["promptBlocks"][number];

type CategoryConfig = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

// ---------------------------------------------------------------------------
// Icon / Color resolution (shared with prompt-block-editor)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  BookOpen,
};

function resolveIcon(name: string | null | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || Sparkles;
}

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

function categoryStyle(color: string | null | undefined): React.CSSProperties {
  const h = parseHue(color);
  return {
    borderColor: `hsl(${h} 50% 55% / 0.3)`,
    backgroundColor: `hsl(${h} 50% 55% / 0.1)`,
    color: `hsl(${h} 80% 72%)`,
  };
}

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

function TypeBadge({
  categoryId,
  categoryMap,
  isCustom,
}: {
  categoryId?: string | null;
  categoryMap: Map<string, CategoryConfig>;
  isCustom?: boolean;
}) {
  if (categoryId) {
    const cat = categoryMap.get(categoryId);
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

  if (isCustom) {
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

let blockIdCounter = 0;

function SortableBlockCard({
  blockId,
  block,
  column,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  categoryMap,
}: {
  blockId: string;
  block: TemplateBlockData;
  column: "positive" | "negative";
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  categoryMap: Map<string, CategoryConfig>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: blockId });
  const [mounted, setMounted] = useState(false);
  useState(() => { setMounted(true); });

  const style = mounted
    ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-medium text-zinc-300">{block.label || "未命名"}</span>
            <TypeBadge categoryId={(block as TemplateBlockData & { categoryId?: string }).categoryId} categoryMap={categoryMap} isCustom={!block.label || block.label === "自定义"} />
          </div>
          {!isEditing && (
            <div className="mt-0.5 truncate text-[11px] text-zinc-500">
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
        <div className="space-y-2 border-t border-white/5 p-2">
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30"
            >
              <Save className="size-3" /> 保存
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
// TemplatePromptBlockEditor — main component
// ---------------------------------------------------------------------------

type Props = {
  blocks: TemplateBlockData[];
  onChange: (blocks: TemplateBlockData[]) => void;
  categoryMap: Map<string, CategoryConfig>;
};

export function TemplatePromptBlockEditor({ blocks, onChange, categoryMap }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editColumn, setEditColumn] = useState<"positive" | "negative">("positive");
  const [editValue, setEditValue] = useState("");
  const [addingColumn, setAddingColumn] = useState<"positive" | "negative" | null>(null);
  const [addText, setAddText] = useState("");

  // Stable IDs for DnD (blocks don't have IDs, use index-based)
  const blockIds = blocks.map((_, i) => `block-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [mounted, setMounted] = useState(false);
  useState(() => { setMounted(true); });

  // ---- Edit handlers ----

  function startEdit(index: number, column: "positive" | "negative") {
    setEditingIndex(index);
    setEditColumn(column);
    const block = blocks[index];
    setEditValue(column === "positive" ? block.positive : (block.negative ?? ""));
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue("");
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const block = blocks[editingIndex];
    const updated = editColumn === "positive"
      ? { ...block, positive: editValue.trim() }
      : { ...block, negative: editValue.trim() || null };
    const next = [...blocks];
    next[editingIndex] = updated;
    onChange(next);
    setEditingIndex(null);
    setEditValue("");
  }

  // ---- Delete handler ----

  function handleDelete(index: number) {
    onChange(blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, sortOrder: i })));
    if (editingIndex === index) cancelEdit();
  }

  // ---- Add handler ----

  function handleAdd() {
    if (!addText.trim()) return;
    const newBlock: TemplateBlockData = {
      label: "自定义",
      positive: addingColumn === "positive" ? addText.trim() : "",
      negative: addingColumn === "negative" ? addText.trim() : null,
      sortOrder: blocks.length,
    };
    onChange([...blocks, newBlock]);
    setAddText("");
    setAddingColumn(null);
  }

  // ---- DnD reorder ----

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blockIds.indexOf(active.id as string);
    const newIndex = blockIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({ ...b, sortOrder: i }));
    onChange(next);
  }

  // ---- Column rendering ----

  function renderColumn(column: "positive" | "negative") {
    const title = column === "positive" ? "✅ 正面提示词" : "❌ 负面提示词";
    const titleColor = column === "positive" ? "text-emerald-400" : "text-rose-400";

    const visibleBlocks = blocks
      .map((b, i) => ({ block: b, index: i }))
      .filter(({ block, index }) => {
        const text = column === "positive" ? block.positive : (block.negative ?? "");
        return text.trim() || editingIndex === index;
      });

    const cardList = (
      <div className="space-y-1.5">
        {visibleBlocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/5 px-3 py-4 text-center text-[11px] text-zinc-600">
            暂无
          </div>
        ) : (
          visibleBlocks.map(({ block, index }) => (
            <SortableBlockCard
              key={blockIds[index]}
              blockId={blockIds[index]}
              block={block}
              column={column}
              isEditing={editingIndex === index && editColumn === column}
              editValue={editValue}
              onEditChange={setEditValue}
              onStartEdit={() => startEdit(index, column)}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={() => handleDelete(index)}
              categoryMap={categoryMap}
            />
          ))
        )}
      </div>
    );

    return (
      <div className="min-w-0 flex-1">
        <div className={`mb-2 text-xs font-medium ${titleColor}`}>{title}</div>
        {mounted ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
              {cardList}
            </SortableContext>
          </DndContext>
        ) : (
          cardList
        )}
        {addingColumn === column ? (
          <div className="mt-2 space-y-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3">
            <div className="text-[11px] font-medium text-sky-300">
              添加{column === "positive" ? "正面" : "负面"}提示词块
            </div>
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              rows={2}
              placeholder="提示词内容…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
            />
            <div className="flex gap-1.5">
              <button type="button" disabled={!addText.trim()} onClick={handleAdd}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50">
                <Plus className="size-3" /> 添加
              </button>
              <button type="button" onClick={() => { setAddingColumn(null); setAddText(""); }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]">
                <X className="size-3" /> 取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingColumn(column)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Plus className="size-3" />
            添加{column === "positive" ? "正面" : "负面"}提示词块
          </button>
        )}
      </div>
    );
  }

  // ---- Composed prompt preview ----

  const hasPositive = blocks.some((b) => b.positive?.trim());
  const hasNegative = blocks.some((b) => b.negative?.trim());

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">合成提示词预览</div>
          {blocks.map((b, i) => (
            <div key={i} className="text-xs leading-relaxed break-words">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {renderColumn("positive")}
        {renderColumn("negative")}
      </div>
    </div>
  );
}
