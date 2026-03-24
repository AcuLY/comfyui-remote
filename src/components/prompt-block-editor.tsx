"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
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
  listPositionBlocks,
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

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_CONFIG);

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const config = BLOCK_TYPE_CONFIG[type] ?? BLOCK_TYPE_CONFIG.custom;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium ${config.color}`}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BlockItem — 单个 PromptBlock
// ---------------------------------------------------------------------------

type BlockItemProps = {
  block: PromptBlockData;
  isEditing: boolean;
  editData: { label: string; positive: string; negative: string };
  onEditChange: (field: string, value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  isSaving: boolean;
};

function BlockItem({
  block,
  isEditing,
  editData,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSaving,
}: BlockItemProps) {
  const Chevron = isEditing ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <div className="flex items-center text-zinc-600">
          <GripVertical className="size-4" />
        </div>

        <button
          type="button"
          onClick={isEditing ? onCancelEdit : onStartEdit}
          className="flex items-center gap-1 text-zinc-500 transition hover:text-zinc-300"
        >
          <Chevron className="size-3.5 shrink-0" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200 truncate">
              {block.label}
            </span>
            <TypeBadge type={block.type} />
          </div>
          {!isEditing && (
            <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
              {block.positive.slice(0, 80)}
              {block.positive.length > 80 ? "..." : ""}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Edit form (expanded) */}
      {isEditing && (
        <div className="border-t border-white/5 p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500">标签</label>
            <input
              type="text"
              value={editData.label}
              onChange={(e) => onEditChange("label", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500">Positive Prompt</label>
            <textarea
              value={editData.positive}
              onChange={(e) => onEditChange("positive", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500">Negative Prompt（可选）</label>
            <textarea
              value={editData.negative}
              onChange={(e) => onEditChange("negative", e.target.value)}
              rows={2}
              placeholder="留空则不添加负面提示词"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveEdit}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/[0.06]"
            >
              <X className="size-3" />
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddBlockForm — 新增块表单
// ---------------------------------------------------------------------------

type AddBlockFormProps = {
  onAdd: (input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
  }) => void;
  isPending: boolean;
};

function AddBlockForm({ onAdd, isPending }: AddBlockFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("custom");
  const [label, setLabel] = useState("");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
      >
        <Plus className="size-4" />
        添加提示词块
      </button>
    );
  }

  function handleSubmit() {
    if (!label.trim() || !positive.trim()) return;
    onAdd({
      type,
      label: label.trim(),
      positive: positive.trim(),
      negative: negative.trim() || null,
    });
    setLabel("");
    setPositive("");
    setNegative("");
    setIsOpen(false);
  }

  function handleCancel() {
    setIsOpen(false);
    setLabel("");
    setPositive("");
    setNegative("");
  }

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 space-y-3">
      <div className="text-sm font-medium text-sky-300">新增提示词块</div>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">类型</label>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((t) => {
            const config = BLOCK_TYPE_CONFIG[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                  type === t
                    ? config.color
                    : "border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">标签</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例：角色描述"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">Positive Prompt</label>
        <textarea
          value={positive}
          onChange={(e) => setPositive(e.target.value)}
          rows={2}
          placeholder="提示词内容…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">Negative Prompt（可选）</label>
        <textarea
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
          rows={2}
          placeholder="留空则不添加"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || !label.trim() || !positive.trim()}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          添加
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/[0.06]"
        >
          <X className="size-3" />
          取消
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptBlockEditor — 主组件
// ---------------------------------------------------------------------------

export function PromptBlockEditor({
  positionId,
  initialBlocks,
}: {
  positionId: string;
  initialBlocks: PromptBlockData[];
}) {
  const [blocks, setBlocks] = useState<PromptBlockData[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    label: "",
    positive: "",
    negative: "",
  });
  const [isPending, startTransition] = useTransition();

  // ---- Edit handlers ----

  function startEdit(block: PromptBlockData) {
    setEditingId(block.id);
    setEditData({
      label: block.label,
      positive: block.positive,
      negative: block.negative ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({ label: "", positive: "", negative: "" });
  }

  function handleEditChange(field: string, value: string) {
    setEditData((prev) => ({ ...prev, [field]: value }));
  }

  function saveEdit(blockId: string) {
    if (!editData.label.trim() || !editData.positive.trim()) return;

    startTransition(async () => {
      const updated = await updatePositionBlock(blockId, {
        label: editData.label.trim(),
        positive: editData.positive.trim(),
        negative: editData.negative.trim() || null,
      });
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? updated : b)));
      setEditingId(null);
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

  function handleAdd(input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
  }) {
    startTransition(async () => {
      const newBlock = await addPositionBlock(positionId, input);
      setBlocks((prev) => [...prev, newBlock]);
    });
  }

  // ---- Move up/down (simple reorder without drag) ----

  function moveBlock(blockId: string, direction: "up" | "down") {
    const index = blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === blocks.length - 1) return;

    const nextBlocks = [...blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [nextBlocks[index], nextBlocks[swapIndex]] = [
      nextBlocks[swapIndex],
      nextBlocks[index],
    ];

    setBlocks(nextBlocks);

    startTransition(async () => {
      const reordered = await reorderPositionBlocks(
        positionId,
        nextBlocks.map((b) => b.id),
      );
      setBlocks(reordered);
    });
  }

  // ---- Composed prompt preview ----

  const composedPositive = blocks
    .map((b) => b.positive)
    .filter(Boolean)
    .join(", ");
  const composedNegative = blocks
    .map((b) => b.negative)
    .filter((v): v is string => Boolean(v))
    .join(", ");

  return (
    <div className="space-y-3">
      {/* Composed prompt preview */}
      {blocks.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] p-3 space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            合成提示词预览
          </div>
          <div className="text-xs text-zinc-300 break-words">
            <span className="text-zinc-500">+</span> {composedPositive}
          </div>
          {composedNegative && (
            <div className="text-xs text-zinc-400 break-words">
              <span className="text-zinc-500">-</span> {composedNegative}
            </div>
          )}
        </div>
      )}

      {/* Block list */}
      {blocks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
          暂无提示词块。点击下方按钮添加。
        </div>
      )}

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div key={block.id} className="relative">
            <BlockItem
              block={block}
              isEditing={editingId === block.id}
              editData={editData}
              onEditChange={handleEditChange}
              onStartEdit={() => startEdit(block)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(block.id)}
              onDelete={() => handleDelete(block.id)}
              isSaving={isPending}
            />

            {/* Move buttons */}
            {editingId !== block.id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                  disabled={index === 0 || isPending}
                  className="rounded p-0.5 text-[10px] text-zinc-600 transition hover:bg-white/[0.06] hover:text-zinc-300 disabled:invisible"
                  title="上移"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={index === blocks.length - 1 || isPending}
                  className="rounded p-0.5 text-[10px] text-zinc-600 transition hover:bg-white/[0.06] hover:text-zinc-300 disabled:invisible"
                  title="下移"
                >
                  &#9660;
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      <AddBlockForm onAdd={handleAdd} isPending={isPending} />
    </div>
  );
}
