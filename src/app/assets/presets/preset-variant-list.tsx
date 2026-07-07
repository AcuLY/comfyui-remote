"use client";

import { useId, useMemo, useSyncExternalStore, type CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { VariantDraft } from "./preset-types";

function variantSortId(variant: VariantDraft, index: number) {
  return variant.clientId ?? variant.id ?? `draft-${index}`;
}

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
  const style: CSSProperties = {
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
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className={`flex min-w-0 items-center gap-1.5 rounded-lg border p-2 cursor-pointer transition ${
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

export function PresetVariantList({
  variants,
  currentIndex,
  canRemove,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: {
  variants: VariantDraft[];
  currentIndex: number;
  canRemove: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onReorder: (variants: VariantDraft[], oldIndex: number, newIndex: number) => void;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const variantIds = useMemo(
    () => variants.map((variant, index) => variantSortId(variant, index)),
    [variants],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = variantIds.indexOf(active.id as string);
    const newIndex = variantIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(variants, oldIndex, newIndex), oldIndex, newIndex);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {mounted ? (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={variantIds} strategy={rectSortingStrategy}>
              {variants.map((variant, index) => (
                <SortableVariantBar
                  key={variantIds[index]}
                  sortId={variantIds[index]}
                  name={variant.name}
                  isSelected={index === currentIndex}
                  onSelect={() => onSelect(index)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          variants.map((variant, index) => (
            <div
              key={variantIds[index]}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-2"
            >
              <GripVertical className="size-3 text-zinc-600" />
              <div className="flex-1 min-w-0 truncate text-xs text-zinc-300">{variant.name || "未命名变体"}</div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition"
        >
          <Plus className="size-3 inline-block mr-1 -mt-0.5" />添加变体
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-full rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition"
          >
            <Trash2 className="size-3 inline-block mr-1 -mt-0.5" />删除变体
          </button>
        )}
      </div>
    </div>
  );
}
