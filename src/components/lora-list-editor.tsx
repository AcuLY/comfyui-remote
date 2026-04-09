"use client";

import { useMemo, useCallback, useId, useState } from "react";
import { Plus, Trash2, Unlink, GripVertical, Zap } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LoraCascadePicker } from "@/components/lora-cascade-picker";
import type { LoraEntry, LoraSource } from "@/lib/lora-types";

const SOURCE_LABELS: Record<LoraSource, { label: string; color: string }> = {
  preset: { label: "预制", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  manual: { label: "自定义", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
};

type LoraListEditorProps = {
  entries: LoraEntry[];
  onChange: (entries: LoraEntry[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Preset binding info for delete protection */
  presetBindings?: Array<{ bindingId: string; presetName: string; blockCount: number; loraCount: number }>;
  /** Show standalone delete (Unlink) button alongside cascade delete */
  enableStandaloneDelete?: boolean;
};

// ---------------------------------------------------------------------------
// TriggerWordHint — shows trigger words on hover/click
// ---------------------------------------------------------------------------

function TriggerWordHint({ loraPath }: { loraPath: string }) {
  const [triggerWords, setTriggerWords] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function fetchTriggerWords() {
    if (triggerWords !== null || loading) {
      setShow(!show);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/loras/notes?paths=${encodeURIComponent(loraPath)}`);
      const json = await res.json();
      const data = json.data?.[loraPath];
      setTriggerWords(data?.triggerWords || "");
      setShow(true);
    } catch {
      setTriggerWords("");
      setShow(true);
    } finally {
      setLoading(false);
    }
  }

  if (!loraPath) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={fetchTriggerWords}
        onMouseEnter={() => { if (triggerWords !== null && triggerWords) setShow(true); }}
        onMouseLeave={() => setShow(false)}
        className="rounded p-0.5 text-amber-400/40 hover:text-amber-400/80 transition"
        title="触发词"
      >
        <Zap className="size-3" />
      </button>
      {show && triggerWords && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 max-w-52 rounded-lg border border-amber-500/20 bg-zinc-900 px-2.5 py-1.5 text-[10px] text-amber-300 shadow-lg whitespace-pre-wrap">
          {triggerWords}
        </div>
      )}
      {show && triggerWords === "" && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[10px] text-zinc-500 shadow-lg">
          未设置触发词
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Color helpers for source tags
// ---------------------------------------------------------------------------

/** Parse HSL color string "H S% L%" → build inline style. Fallback for manual source. */
function sourceTagStyle(color?: string | null): React.CSSProperties | undefined {
  if (!color) return undefined;
  const match = color.match(/^(\d+)\s/);
  if (!match) return undefined;
  const h = parseInt(match[1], 10);
  return {
    borderColor: `hsl(${h} 50% 55% / 0.3)`,
    backgroundColor: `hsl(${h} 50% 55% / 0.1)`,
    color: `hsl(${h} 80% 72%)`,
  };
}

// ---------------------------------------------------------------------------
// Sortable row — two-line layout
// ---------------------------------------------------------------------------

function SortableLoraRow({
  entry,
  disabled,
  readOnly,
  onToggle,
  onPathChange,
  onWeightChange,
  onRemove,
  onStandaloneRemove,
}: {
  entry: LoraEntry;
  disabled: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onPathChange: (path: string) => void;
  onWeightChange: (value: string) => void;
  onRemove: () => void;
  onStandaloneRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isManual = entry.source === "manual";
  const fileName = entry.path ? (entry.path.split("/").pop() || entry.path) : "未选择";
  // Row 1: show preset name for imported, file name for manual
  const displayName = !isManual && entry.sourceName ? entry.sourceName : fileName;

  // Tag style: use category color for preset source, fallback to rose for manual
  const tagStyle = !isManual && entry.sourceColor
    ? sourceTagStyle(entry.sourceColor)
    : undefined;
  const tagClassName = tagStyle
    ? "inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9px] font-medium"
    : `inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9px] font-medium ${SOURCE_LABELS[entry.source]?.color || SOURCE_LABELS.manual.color}`;
  const tagLabel = !isManual && entry.sourceLabel
    ? entry.sourceLabel
    : SOURCE_LABELS[entry.source]?.label || "自定义";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition ${
        entry.enabled
          ? "border-white/10 bg-white/[0.02]"
          : "border-white/5 bg-white/[0.01] opacity-60"
      }`}
    >
      <div className="flex items-stretch">
        {/* Left: drag handle — spans full height */}
        {!readOnly && (
          <div className="flex items-center px-2 border-r border-white/5">
            <button
              type="button"
              className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          </div>
        )}

        {/* Center: two rows */}
        <div className="flex-1 min-w-0 py-2 px-2.5 space-y-1.5">
          {/* Row 1: name + source tag + trigger hint */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-300 truncate">
              {displayName}
            </span>
            <span className={tagClassName} style={tagStyle}>
              {tagLabel}
            </span>
            <TriggerWordHint loraPath={entry.path} />
          </div>

          {/* Row 2: toggle + selector/path + weight controls */}
          <div className="flex items-center gap-2">
            {/* Enabled toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={entry.enabled}
              onClick={onToggle}
              disabled={disabled}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:opacity-50 ${
                entry.enabled
                  ? "border-sky-500/30 bg-sky-500"
                  : "border-white/10 bg-white/10"
              }`}
            >
              <span
                className={`pointer-events-none block size-3 rounded-full bg-white shadow transition-transform ${
                  entry.enabled ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>

            {/* Path: always show selector for editing */}
            <div className="flex-1 min-w-0">
              <LoraCascadePicker
                value={entry.path}
                onChange={onPathChange}
                disabled={disabled}
              />
            </div>

            {/* Weight input + adjust buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" disabled={disabled} onClick={() => onWeightChange(String(entry.weight - 0.5))}
                className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50">-.5</button>
              <button type="button" disabled={disabled} onClick={() => onWeightChange(String(entry.weight - 0.1))}
                className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50">-.1</button>
              <input
                type="number"
                value={entry.weight}
                onChange={(e) => onWeightChange(e.target.value)}
                step="0.05"
                min="-2"
                max="2"
                disabled={disabled}
                className="input-number w-12 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center text-[11px] text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-50"
              />
              <button type="button" disabled={disabled} onClick={() => onWeightChange(String(entry.weight + 0.1))}
                className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50">+.1</button>
              <button type="button" disabled={disabled} onClick={() => onWeightChange(String(entry.weight + 0.5))}
                className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50">+.5</button>
            </div>
          </div>
        </div>

        {/* Right: delete button — spans full height */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 px-2 border-l border-white/5">
            {onStandaloneRemove && (
              <button
                type="button"
                onClick={onStandaloneRemove}
                disabled={disabled}
                title="独立删除（仅此 LoRA）"
                className="rounded p-1 text-zinc-500 transition hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
              >
                <Unlink className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              title="级联删除（含绑定）"
              className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function LoraListEditor({
  entries,
  onChange,
  disabled = false,
  readOnly = false,
  presetBindings,
  enableStandaloneDelete = false,
}: LoraListEditorProps) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const ids = useMemo(() => entries.map((e) => e.id), [entries]);

  function handleAdd() {
    const newEntry: LoraEntry = {
      id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      path: "",
      weight: 1.0,
      enabled: true,
      source: "manual",
    };
    onChange([...entries, newEntry]);
  }

  function handleRemove(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (entry?.bindingId && presetBindings) {
      const binding = presetBindings.find((b) => b.bindingId === entry.bindingId);
      if (binding) {
        if (!confirm(`此 LoRA 属于预制「${binding.presetName}」的绑定。\n删除将同时移除该绑定的所有 ${binding.blockCount} 个提示词块和 ${binding.loraCount} 个 LoRA。\n确认删除？`)) {
          return;
        }
        // Remove all LoRAs with this bindingId
        onChange(entries.filter((e) => e.bindingId !== entry.bindingId));
        return;
      }
    }
    onChange(entries.filter((e) => e.id !== id));
  }

  function handleStandaloneRemove(id: string) {
    if (!confirm("独立删除此 LoRA？不影响同绑定的其他块和 LoRA。")) return;
    onChange(entries.filter((e) => e.id !== id));
  }

  function handleUpdate(id: string, updates: Partial<LoraEntry>) {
    onChange(
      entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  }

  function handleWeightChange(id: string, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const clamped = Math.min(2.0, Math.max(-2.0, num));
      const rounded = Math.round(clamped * 100) / 100;
      handleUpdate(id, { weight: rounded });
    }
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      onChange(arrayMove(entries, oldIndex, newIndex));
    },
    [ids, entries, onChange],
  );

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>LoRA 列表</span>
        {entries.length > 0 && (
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
            {enabledCount}/{entries.length}
          </span>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.01] p-3">
        {entries.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-zinc-600">
            暂无 LoRA，从预制库导入或手动添加
          </div>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <SortableLoraRow
                    key={entry.id}
                    entry={entry}
                    disabled={disabled}
                    readOnly={readOnly}
                    onToggle={() => handleUpdate(entry.id, { enabled: !entry.enabled })}
                    onPathChange={(v) => handleUpdate(entry.id, { path: v })}
                    onWeightChange={(v) => handleWeightChange(entry.id, v)}
                    onRemove={() => handleRemove(entry.id)}
                    onStandaloneRemove={enableStandaloneDelete && entry.bindingId ? () => handleStandaloneRemove(entry.id) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
          >
            <Plus className="size-3" />
            添加 LoRA
          </button>
        )}
      </div>
    </div>
  );
}
