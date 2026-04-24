"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import { ArrowLeft, GripVertical, Check } from "lucide-react";
import { updateCategorySortOrders } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryData = {
  id: string;
  name: string;
  color: string | null;
  positivePromptOrder: number;
  negativePromptOrder: number;
  lora1Order: number;
  lora2Order: number;
};

type Dimension = "positivePromptOrder" | "negativePromptOrder" | "lora1Order" | "lora2Order";

const DIMENSIONS: { key: Dimension; title: string; description: string }[] = [
  {
    key: "positivePromptOrder",
    title: "正向提示词",
    description: "导入预设时，各分类的正向提示词插入顺序",
  },
  {
    key: "negativePromptOrder",
    title: "负向提示词",
    description: "导入预设时，各分类的负向提示词插入顺序",
  },
  {
    key: "lora1Order",
    title: "LoRA 1",
    description: "导入预设时，各分类的 LoRA 1 插入顺序",
  },
  {
    key: "lora2Order",
    title: "LoRA 2",
    description: "导入预设时，各分类的 LoRA 2 插入顺序",
  },
];

// ---------------------------------------------------------------------------
// Sortable card
// ---------------------------------------------------------------------------

function SortableCard({ id, name, color }: { id: string; name: string; color: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hsl = color ?? "210 50% 55%";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 select-none"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: `hsl(${hsl})` }}
      />
      <span className="text-xs font-medium text-zinc-300">{name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single dimension panel
// ---------------------------------------------------------------------------

function SortPanel({
  dimension,
  title,
  description,
  items,
  onReorder,
  saving,
  saved,
}: {
  dimension: Dimension;
  title: string;
  description: string;
  items: CategoryData[];
  onReorder: (dimension: Dimension, ids: string[]) => void;
  saving: boolean;
  saved: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const ids = useMemo(() => items.map((c) => c.id), [items]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      const newIds = arrayMove(ids, oldIndex, newIndex);
      onReorder(dimension, newIds);
    },
    [ids, dimension, onReorder],
  );

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">{description}</p>
        </div>
        {saving && (
          <span className="text-[10px] text-zinc-500">保存中…</span>
        )}
        {saved && !saving && (
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
            <Check className="size-3" />
            已保存
          </span>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((cat) => (
              <SortableCard key={cat.id} id={cat.id} name={cat.name} color={cat.color} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="py-6 text-center text-xs text-zinc-600">暂无分类</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function SortRulesEditor({ categories }: { categories: CategoryData[] }) {
  const [isPending, startTransition] = useTransition();

  // Per-dimension ordered lists
  const [orders, setOrders] = useState<Record<Dimension, string[]>>(() => {
    const result = {} as Record<Dimension, string[]>;
    for (const dim of DIMENSIONS) {
      const sorted = [...categories].sort((a, b) => a[dim.key] - b[dim.key]);
      result[dim.key] = sorted.map((c) => c.id);
    }
    return result;
  });

  // Track which dimension was just saved
  const [savedDim, setSavedDim] = useState<Dimension | null>(null);
  const [savingDim, setSavingDim] = useState<Dimension | null>(null);

  const handleReorder = useCallback(
    (dimension: Dimension, newIds: string[]) => {
      setOrders((prev) => ({ ...prev, [dimension]: newIds }));
      setSavingDim(dimension);
      setSavedDim(null);

      startTransition(async () => {
        await updateCategorySortOrders(dimension, newIds);
        setSavingDim(null);
        setSavedDim(dimension);
        setTimeout(() => setSavedDim((d) => (d === dimension ? null : d)), 1500);
      });
    },
    [startTransition],
  );

  // Build ordered category lists per dimension
  const orderedByDimension = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const result = {} as Record<Dimension, CategoryData[]>;
    for (const dim of DIMENSIONS) {
      result[dim.key] = orders[dim.key]
        .map((id) => catMap.get(id))
        .filter((c): c is CategoryData => !!c);
    }
    return result;
  }, [categories, orders]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/assets/presets"
          className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-zinc-100">自动排序规则</h1>
          <p className="text-xs text-zinc-500">
            拖拽分类卡片调整顺序。数字越小（越靠上）的分类，其内容在导入时越先插入。
          </p>
        </div>
      </div>

      {/* 4 panels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DIMENSIONS.map((dim) => (
          <SortPanel
            key={dim.key}
            dimension={dim.key}
            title={dim.title}
            description={dim.description}
            items={orderedByDimension[dim.key]}
            onReorder={handleReorder}
            saving={savingDim === dim.key && isPending}
            saved={savedDim === dim.key}
          />
        ))}
      </div>
    </div>
  );
}
