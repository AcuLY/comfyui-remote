"use client";

import { useState, useCallback } from "react";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  X,
  GripVertical,
  Pencil,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import type {
  PresetCategoryFull,
  SlotTemplateDef,
} from "@/lib/server-data";
import {
  createPresetCategory,
  updatePresetCategory,
  deletePresetCategory,
} from "@/lib/actions";
import { toast } from "sonner";

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

// ---------------------------------------------------------------------------
// CategoryBadge
// ---------------------------------------------------------------------------

export function CategoryBadge({ color }: { color: string | null }) {
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

function HueSlider({ value, onChange, onBlur }: { value: number; onChange: (hue: number) => void; onBlur?: () => void }) {
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
        onBlur={onBlur}
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

export function CategoryForm({
  category,
  allCategories,
  onSave,
  isPending,
}: {
  category: PresetCategoryFull | null;
  allCategories: PresetCategoryFull[];
  onSave: (data: { name: string; slug: string; icon?: string; color?: string; type?: string; slotTemplate?: SlotTemplateDef[] | null }) => void;
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
    const nextSlots = [...slots, { categoryId: catId }];
    setSlots(nextSlots);
    handleSave(nextSlots);
  }

  function removeSlot(idx: number) {
    const nextSlots = slots.filter((_, i) => i !== idx);
    setSlots(nextSlots);
    handleSave(nextSlots);
  }

  function updateSlotCategory(idx: number, categoryId: string) {
    const updated = [...slots];
    const cat = presetCategories.find((c) => c.id === categoryId);
    updated[idx] = { categoryId, label: cat?.name };
    setSlots(updated);
    handleSave(updated);
  }

  function handleSave(nextSlots = slots) {
    if (isPending || !name.trim() || !slug.trim()) return;
    onSave({
      name: name.trim(),
      slug: slug.trim(),
      color: hslString(hue),
      type: category ? undefined : catType,
      slotTemplate: catType === "group" ? nextSlots : undefined,
    });
  }

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="space-y-2 border-t border-white/10 bg-zinc-950/80 p-3">
      <div className="text-[11px] font-medium text-sky-300">
        {category ? "编辑分类" : "新建分类"}
      </div>

      {/* Type toggle — only editable for new categories */}
      <div className="flex items-center gap-1">
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
        onBlur={() => handleSave()}
        placeholder="分类名称"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        onBlur={() => handleSave()}
        placeholder="slug"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <HueSlider
        value={hue}
        onChange={(value) => {
          setHue(value);
        }}
        onBlur={handleSave}
      />

      {/* Slot template editor — only for group-type categories */}
      {catType === "group" && (
        <div className="space-y-1.5">
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
            <div className="py-0.5 text-[10px] text-zinc-600">无默认槽位，新建预制组时成员列表为空</div>
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
                    onBlur={() => handleSave()}
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
                  onBlur={() => handleSave()}
                  placeholder={slotCat?.name ?? "标签"}
                  className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-sky-500/30 placeholder:text-zinc-600"
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
      {isPending && (
        <div className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
          <Loader2 className="size-3 animate-spin" />
          保存中
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableCategoryItem
// ---------------------------------------------------------------------------

export function SortableCategoryItem({
  cat,
  isSelected,
  isExpanded,
  onSelect,
  onEdit,
  onDelete,
  children,
}: {
  cat: PresetCategoryFull;
  isSelected: boolean;
  isExpanded?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
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
      className={`rounded-xl border transition ${
        isExpanded
          ? "border-sky-500/30 bg-zinc-950/80"
          : isSelected
            ? "border-sky-500/30 bg-sky-500/10"
            : "border-white/5 bg-white/[0.02] hover:border-white/10"
      }`}
    >
      <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
        className="flex w-full cursor-pointer items-center gap-1.5 p-2.5 text-left"
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
          <div className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
            {cat.name}
            {cat.type === "group" && (
              <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-300/80">组</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500">
            {cat.type === "group" ? `${cat.groupCount} 个预制组` : `${cat.presetCount} 个预制`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded p-1 text-zinc-600 hover:text-zinc-300"
            title={isExpanded ? "收起分类" : "编辑分类"}
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-zinc-600 hover:text-red-400"
            title="删除分类"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
