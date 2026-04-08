"use client";

import { useState, useCallback, useMemo, useId } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
import type { LoraBinding } from "@/lib/lora-types";

type LoraBindingEditorProps = {
  bindings: LoraBinding[];
  onChange: (bindings: LoraBinding[]) => void;
};

// Internal type with stable id for dnd-kit
type BindingWithId = LoraBinding & { _id: string };

let _idCounter = 0;
function nextId() {
  return `lb-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

function SortableRow({
  item,
  index,
  weightDisplay,
  onToggle,
  onPathChange,
  onWeightInput,
  onWeightBlur,
  onWeightAdjust,
  onRemove,
}: {
  item: BindingWithId;
  index: number;
  weightDisplay: string;
  onToggle: () => void;
  onPathChange: (path: string) => void;
  onWeightInput: (value: string) => void;
  onWeightBlur: () => void;
  onWeightAdjust: (delta: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-white/5 bg-white/[0.02] p-2"
    >
      {/* Row 1: drag handle + toggle + path picker (+ weight & delete on desktop) */}
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>

        {/* Enabled toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={item.enabled}
          onClick={onToggle}
          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
            item.enabled
              ? "border-sky-500/30 bg-sky-500"
              : "border-white/10 bg-white/10"
          }`}
        >
          <span
            className={`pointer-events-none block size-3 rounded-full bg-white shadow transition-transform ${
              item.enabled ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </button>

        {/* Path picker */}
        <div className="flex-1 min-w-0">
          <LoraCascadePicker value={item.path} onChange={onPathChange} />
        </div>

        {/* Weight input + adjust buttons (desktop only) */}
        <div className="hidden items-center gap-1 sm:flex">
          <div className="flex gap-0.5">
            <button type="button" onClick={() => onWeightAdjust(-0.5)}
              className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">-.5</button>
            <button type="button" onClick={() => onWeightAdjust(-0.1)}
              className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">-.1</button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={weightDisplay}
            onChange={(e) => onWeightInput(e.target.value)}
            onBlur={onWeightBlur}
            className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
          <div className="flex gap-0.5">
            <button type="button" onClick={() => onWeightAdjust(0.1)}
              className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">+.1</button>
            <button type="button" onClick={() => onWeightAdjust(0.5)}
              className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">+.5</button>
          </div>
        </div>

        {/* Remove (desktop only) */}
        <button
          type="button"
          onClick={onRemove}
          className="hidden rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 sm:block"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Row 2: weight controls + delete (mobile only) */}
      <div className="mt-1.5 flex items-center gap-1 pl-[3.25rem] sm:hidden">
        <div className="flex gap-0.5">
          <button type="button" onClick={() => onWeightAdjust(-0.5)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">-.5</button>
          <button type="button" onClick={() => onWeightAdjust(-0.1)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">-.1</button>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={weightDisplay}
          onChange={(e) => onWeightInput(e.target.value)}
          onBlur={onWeightBlur}
          className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
        <div className="flex gap-0.5">
          <button type="button" onClick={() => onWeightAdjust(0.1)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">+.1</button>
          <button type="button" onClick={() => onWeightAdjust(0.5)}
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300">+.5</button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function LoraBindingEditor({ bindings, onChange }: LoraBindingEditorProps) {
  // Maintain stable IDs for dnd-kit
  const [items, setItems] = useState<BindingWithId[]>(() =>
    bindings.map((b) => ({ ...b, _id: nextId() })),
  );
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const ids = useMemo(() => items.map((i) => i._id), [items]);

  // Sync items → parent (strip _id)
  const emit = useCallback(
    (next: BindingWithId[]) => {
      setItems(next);
      onChange(next.map(({ _id, ...rest }) => rest));
    },
    [onChange],
  );

  // Sync from parent when bindings array length changes (e.g. external reset)
  // Simple: just track length mismatch
  if (bindings.length !== items.length) {
    const synced = bindings.map((b, i) =>
      i < items.length ? { ...b, _id: items[i]._id } : { ...b, _id: nextId() },
    );
    setItems(synced);
  }

  function handleAdd() {
    emit([...items, { path: "", weight: 1.0, enabled: true, _id: nextId() }]);
  }

  function handleRemove(id: string) {
    emit(items.filter((i) => i._id !== id));
    setWeightInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleUpdate(id: string, updates: Partial<LoraBinding>) {
    emit(items.map((i) => (i._id === id ? { ...i, ...updates } : i)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    emit(arrayMove(items, oldIndex, newIndex));
  }

  function getWeightDisplay(item: BindingWithId): string {
    if (item._id in weightInputs) return weightInputs[item._id];
    return item.weight.toFixed(2);
  }

  function handleWeightBlur(item: BindingWithId) {
    const val = weightInputs[item._id];
    if (val === undefined) return;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.min(2.0, Math.max(-2.0, num));
      const rounded = Math.round(clamped * 100) / 100;
      handleUpdate(item._id, { weight: rounded });
    }
    setWeightInputs((prev) => {
      const next = { ...prev };
      delete next[item._id];
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500 mb-1">LoRA 绑定</div>

      <div className="space-y-2 rounded-lg border border-white/5 bg-white/[0.01] p-2">
        {items.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-zinc-600">
            暂无绑定的 LoRA
          </div>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <SortableRow
                    key={item._id}
                    item={item}
                    index={index}
                    weightDisplay={getWeightDisplay(item)}
                    onToggle={() => handleUpdate(item._id, { enabled: !item.enabled })}
                    onPathChange={(v) => handleUpdate(item._id, { path: v })}
                    onWeightInput={(v) => setWeightInputs((prev) => ({ ...prev, [item._id]: v }))}
                    onWeightBlur={() => handleWeightBlur(item)}
                    onWeightAdjust={(delta) => {
                      const clamped = Math.min(2.0, Math.max(-2.0, item.weight + delta));
                      handleUpdate(item._id, { weight: Math.round(clamped * 100) / 100 });
                    }}
                    onRemove={() => handleRemove(item._id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.01] py-1.5 text-[11px] text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300"
        >
          <Plus className="size-3" />
          添加 LoRA
        </button>
      </div>
    </div>
  );
}
