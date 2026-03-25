"use client";

import { useState, useTransition, useEffect } from "react";
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
  User,
  MapPin,
  Palette,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import {
  addPositionBlock,
  updatePositionBlock,
  deletePositionBlock,
  reorderPositionBlocks,
  type PromptBlockData,
} from "@/lib/actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof User; color: string }
> = {
  character: {
    label: "角色",
    icon: User,
    color: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  scene: {
    label: "场景",
    icon: MapPin,
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  style: {
    label: "风格",
    icon: Palette,
    color: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
  position: {
    label: "Position",
    icon: LayoutGrid,
    color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  custom: {
    label: "自定义",
    icon: Sparkles,
    color: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
};

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const config = BLOCK_TYPE_CONFIG[type] ?? BLOCK_TYPE_CONFIG.custom;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
      <Icon className="size-3" />
      {config.label}
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
}: SortableBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  // Only apply dnd transform styles after client mount to avoid hydration mismatch
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
            <TypeBadge type={block.type} />
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
// BlockColumn — 单栏（正面或负面）
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
  onAdd: () => void;
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
  onAdd,
}: BlockColumnProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only render DndContext after client mount to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Filter blocks with content for this column
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
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
      >
        <Plus className="size-3" />
        添加{column === "positive" ? "正面" : "负面"}提示词块
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddBlockForm (支持自定义输入和从词库导入)
// ---------------------------------------------------------------------------

type LibraryItem = {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string | null;
};

type PromptLibrary = {
  characters: LibraryItem[];
  scenes: LibraryItem[];
  styles: LibraryItem[];
  positions: LibraryItem[];
};

type AddBlockFormProps = {
  polarity: "positive" | "negative";
  onAdd: (input: { type: string; label: string; positive: string; negative?: string | null; sourceId?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
  library?: PromptLibrary;
};

type AddMode = "custom" | "library";
type LibraryCategory = "character" | "scene" | "style" | "position";

const LIBRARY_CATEGORIES: { key: LibraryCategory; label: string; type: string }[] = [
  { key: "character", label: "角色", type: "character" },
  { key: "scene", label: "场景", type: "scene" },
  { key: "style", label: "风格", type: "style" },
  { key: "position", label: "Position", type: "position" },
];

function AddBlockForm({
  polarity,
  onAdd,
  onCancel,
  isPending,
  library,
}: AddBlockFormProps) {
  const [mode, setMode] = useState<AddMode>("custom");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [category, setCategory] = useState<LibraryCategory>("character");
  const [selectedId, setSelectedId] = useState<string>("");

  // 获取当前分类的词库列表
  const libraryItems: LibraryItem[] = library
    ? (category === "character" ? library.characters :
       category === "scene" ? library.scenes :
       category === "style" ? library.styles :
       library.positions)
    : [];

  // 当切换分类时重置选择
  useEffect(() => {
    setSelectedId("");
  }, [category]);

  function handleSubmitCustom() {
    const text = polarity === "positive" ? positive : negative;
    if (!text.trim()) return;
    const label = text.trim().slice(0, 20);
    onAdd({
      type: "custom",
      label,
      positive: polarity === "positive" ? positive.trim() : "",
      negative: polarity === "negative" ? negative.trim() : null,
    });
  }

  function handleSubmitLibrary() {
    if (!selectedId) return;
    const item = libraryItems.find((i) => i.id === selectedId);
    if (!item) return;

    const categoryConfig = LIBRARY_CATEGORIES.find((c) => c.key === category);
    onAdd({
      type: categoryConfig?.type ?? "custom",
      label: item.name,
      positive: item.prompt,
      negative: item.negativePrompt,
      sourceId: item.id,
    });
  }

  const hasLibrary = library && (
    library.characters.length > 0 ||
    library.scenes.length > 0 ||
    library.styles.length > 0 ||
    library.positions.length > 0
  );

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
              从词库导入
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
          {/* 分类选择 */}
          <div className="flex flex-wrap gap-1.5">
            {LIBRARY_CATEGORIES.map((cat) => {
              const items = library
                ? (cat.key === "character" ? library.characters :
                   cat.key === "scene" ? library.scenes :
                   cat.key === "style" ? library.styles :
                   library.positions)
                : [];
              if (items.length === 0) return null;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`rounded-lg px-2 py-1 text-[10px] transition ${
                    category === cat.key
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {cat.label} ({items.length})
                </button>
              );
            })}
          </div>

          {/* 词库列表 */}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {libraryItems.length === 0 ? (
              <div className="text-center text-[11px] text-zinc-600 py-2">该分类暂无词库</div>
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
// PromptBlockEditor — 主组件（正负两栏 + 拖拽）
// ---------------------------------------------------------------------------

export function PromptBlockEditor({
  positionId,
  initialBlocks,
  library,
}: {
  positionId: string;
  initialBlocks: PromptBlockData[];
  library?: PromptLibrary;
}) {
  const [blocks, setBlocks] = useState<PromptBlockData[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColumn, setEditColumn] = useState<"positive" | "negative">("positive");
  const [editValue, setEditValue] = useState("");
  const [addingColumn, setAddingColumn] = useState<"positive" | "negative" | null>(null);
  const [isPending, startTransition] = useTransition();

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
      const updated = await updatePositionBlock(editingId, update);
      setBlocks((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
      setEditingId(null);
      setEditValue("");
    });
  }

  // ---- Delete handler ----

  function handleDelete(blockId: string) {
    if (!confirm("确认删除此提示词块？")) return;
    startTransition(async () => {
      await deletePositionBlock(blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (editingId === blockId) cancelEdit();
    });
  }

  // ---- Add handler ----

  function handleAdd(input: { type: string; label: string; positive: string; negative?: string | null }) {
    startTransition(async () => {
      const newBlock = await addPositionBlock(positionId, input);
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
      const reordered = await reorderPositionBlocks(positionId, nextBlocks.map((b) => b.id));
      setBlocks(reordered);
    });
  }

  // ---- Composed prompt preview ----

  const composedPositive = blocks.map((b) => b.positive).filter(Boolean).join(", ");
  const composedNegative = blocks.map((b) => b.negative).filter((v): v is string => Boolean(v)).join(", ");

  return (
    <div className="space-y-4">
      {/* Composed prompt preview */}
      {blocks.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] p-3 space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">合成提示词预览</div>
          <div className="text-xs text-zinc-300 break-words">
            <span className="text-emerald-500/60">+</span> {composedPositive || "（无）"}
          </div>
          {composedNegative && (
            <div className="text-xs text-zinc-400 break-words">
              <span className="text-rose-500/60">−</span> {composedNegative}
            </div>
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
          onAdd={() => setAddingColumn("positive")}
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
          onAdd={() => setAddingColumn("negative")}
        />
      </div>

      {/* Add block form overlay */}
      {addingColumn && (
        <AddBlockForm
          polarity={addingColumn}
          onAdd={handleAdd}
          onCancel={() => setAddingColumn(null)}
          isPending={isPending}
          library={library}
        />
      )}
    </div>
  );
}
