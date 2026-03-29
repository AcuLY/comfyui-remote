"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  X,
  GripVertical,
  Pencil,
  Settings2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import type { PromptCategoryFull, PromptPresetItem } from "@/lib/server-data";
import {
  createPromptCategory,
  updatePromptCategory,
  deletePromptCategory,
  createPromptPreset,
  updatePromptPreset,
  deletePromptPreset,
} from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptManager({
  initialCategories,
}: {
  initialCategories: PromptCategoryFull[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showSortConfig, setShowSortConfig] = useState(false);

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <SectionCard title="提示词管理" subtitle="管理提示词分类和模板。每个分类下可创建多个模板，用于项目绑定和小节导入。">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Left panel: categories */}
          <div className="w-full shrink-0 space-y-2 md:w-56">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                分类
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowSortConfig(!showSortConfig)}
                  className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
                  title="排序规则"
                >
                  <Settings2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCatForm(true);
                    setEditingCatId(null);
                  }}
                  className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Category list */}
            {categories.map((cat) => (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedCatId(cat.id);
                  setShowCatForm(false);
                  setShowSortConfig(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedCatId(cat.id);
                    setShowCatForm(false);
                    setShowSortConfig(false);
                  }
                }}
                className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  selectedCatId === cat.id
                    ? "border-sky-500/30 bg-sky-500/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                <CategoryBadge color={cat.color} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">
                    {cat.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {cat.presetCount} 个模板
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCatId(cat.id);
                    setShowCatForm(true);
                    setShowSortConfig(false);
                  }}
                  className="rounded p-1 text-zinc-600 hover:text-zinc-300"
                >
                  <Pencil className="size-3" />
                </button>
              </div>
            ))}

            {/* Category create/edit form */}
            {showCatForm && (
              <CategoryForm
                category={
                  editingCatId
                    ? categories.find((c) => c.id === editingCatId) ?? null
                    : null
                }
                onSave={(data) => {
                  startTransition(async () => {
                    if (editingCatId) {
                      await updatePromptCategory(editingCatId, data);
                    } else {
                      const cat = await createPromptCategory(data);
                      setSelectedCatId(cat.id);
                    }
                    setShowCatForm(false);
                    setEditingCatId(null);
                    refresh();
                  });
                }}
                onDelete={
                  editingCatId
                    ? () => {
                        if (!confirm("确认删除此分类？")) return;
                        startTransition(async () => {
                          try {
                            await deletePromptCategory(editingCatId);
                            if (selectedCatId === editingCatId) {
                              setSelectedCatId(categories[0]?.id ?? null);
                            }
                          } catch (e: unknown) {
                            alert(e instanceof Error ? e.message : "删除失败");
                          }
                          setShowCatForm(false);
                          setEditingCatId(null);
                          refresh();
                        });
                      }
                    : undefined
                }
                onCancel={() => {
                  setShowCatForm(false);
                  setEditingCatId(null);
                }}
                isPending={isPending}
              />
            )}

            {/* Sort order config */}
            {showSortConfig && (
              <SortOrderConfig
                categories={categories}
                onSave={(updates) => {
                  startTransition(async () => {
                    for (const u of updates) {
                      await updatePromptCategory(u.id, u);
                    }
                    setShowSortConfig(false);
                    refresh();
                  });
                }}
                onCancel={() => setShowSortConfig(false)}
                isPending={isPending}
              />
            )}
          </div>

          {/* Right panel: presets */}
          <div className="flex-1 min-w-0">
            {selectedCat ? (
              <PresetList
                category={selectedCat}
                onRefresh={refresh}
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
                选择或创建一个分类
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryBadge
// ---------------------------------------------------------------------------

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

function CategoryBadge({ color }: { color: string | null }) {
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

function HueSlider({ value, onChange }: { value: number; onChange: (hue: number) => void }) {
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

function CategoryForm({
  category,
  onSave,
  onDelete,
  onCancel,
  isPending,
}: {
  category: PromptCategoryFull | null;
  onSave: (data: { name: string; slug: string; icon?: string; color?: string }) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [hue, setHue] = useState(() =>
    category ? parseHue(category.color) : Math.floor(Math.random() * 360),
  );

  function handleNameChange(value: string) {
    setName(value);
    if (!category) {
      // Auto-generate slug from name for new categories
      setSlug(
        value
          .toLowerCase()
          .replace(/[\s]+/g, "-")
          .replace(/[^a-z0-9\u4e00-\u9fff-]/g, ""),
      );
    }
  }

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2">
      <div className="text-[11px] font-medium text-sky-300">
        {category ? "编辑分类" : "新建分类"}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder="分类名称"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
      />
      <HueSlider value={hue} onChange={setHue} />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim(), color: hslString(hue) })}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="size-3" /> 删除
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortOrderConfig — category sort order configuration
// ---------------------------------------------------------------------------

function SortOrderConfig({
  categories,
  onSave,
  onCancel,
  isPending,
}: {
  categories: PromptCategoryFull[];
  onSave: (
    updates: Array<{
      id: string;
      positivePromptOrder: number;
      negativePromptOrder: number;
      lora1Order: number;
      lora2Order: number;
    }>,
  ) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [orders, setOrders] = useState(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      positivePromptOrder: c.positivePromptOrder,
      negativePromptOrder: c.negativePromptOrder,
      lora1Order: c.lora1Order,
      lora2Order: c.lora2Order,
    })),
  );

  function updateOrder(
    id: string,
    field: "positivePromptOrder" | "negativePromptOrder" | "lora1Order" | "lora2Order",
    value: number,
  ) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3 space-y-3">
      <div className="text-[11px] font-medium text-amber-300">
        自动排序规则
      </div>
      <p className="text-[10px] text-zinc-500">
        数字越小越靠前。导入 preset 时系统按此顺序插入 prompt block 和 LoRA。自定义项默认排最后。
      </p>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CategoryBadge color={o.color} />
              <span className="text-[11px] font-medium text-zinc-300">
                {o.name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["positivePromptOrder", "正面提示词"],
                  ["negativePromptOrder", "负面提示词"],
                  ["lora1Order", "LoRA 1"],
                  ["lora2Order", "LoRA 2"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 w-16 shrink-0">
                    {label}
                  </span>
                  <input
                    type="number"
                    value={o[field]}
                    onChange={(e) =>
                      updateOrder(o.id, field, parseInt(e.target.value, 10) || 0)
                    }
                    className="w-14 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-zinc-200 outline-none focus:border-sky-500/30"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSave(orders)}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetList — right panel showing presets within a category
// ---------------------------------------------------------------------------

function PresetList({
  category,
  onRefresh,
}: {
  category: PromptCategoryFull;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge color={category.color} />
          <span className="text-sm font-medium text-zinc-200">
            {category.name}
          </span>
          <span className="text-[10px] text-zinc-500">
            {category.presets.length} 个模板
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20"
        >
          <Plus className="size-3" /> 新建模板
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <PresetForm
          categoryId={category.id}
          preset={null}
          onSave={(data) => {
            startTransition(async () => {
              await createPromptPreset(data);
              setIsCreating(false);
              onRefresh();
            });
          }}
          onCancel={() => setIsCreating(false)}
          isPending={isPending}
        />
      )}

      {/* Preset cards */}
      {category.presets.length === 0 && !isCreating ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/5 text-xs text-zinc-600">
          暂无模板，点击「新建模板」开始
        </div>
      ) : (
        category.presets.map((preset) =>
          editingId === preset.id ? (
            <PresetForm
              key={preset.id}
              categoryId={category.id}
              preset={preset}
              onSave={(data) => {
                startTransition(async () => {
                  await updatePromptPreset(preset.id, data);
                  setEditingId(null);
                  onRefresh();
                });
              }}
              onDelete={() => {
                if (!confirm("确认删除此模板？")) return;
                startTransition(async () => {
                  await deletePromptPreset(preset.id);
                  setEditingId(null);
                  onRefresh();
                });
              }}
              onCancel={() => setEditingId(null)}
              isPending={isPending}
            />
          ) : (
            <PresetCard
              key={preset.id}
              preset={preset}
              onEdit={() => setEditingId(preset.id)}
            />
          ),
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetCard — compact display of a preset
// ---------------------------------------------------------------------------

function PresetCard({
  preset,
  onEdit,
}: {
  preset: PromptPresetItem;
  onEdit: () => void;
}) {
  const lora1 = parseLoraBindings(preset.lora1);
  const lora2 = parseLoraBindings(preset.lora2);
  const loraCount = lora1.length + lora2.length;

  return (
    <div
      className={`rounded-xl border p-3 transition hover:border-white/15 ${
        preset.isActive
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/5 bg-white/[0.01] opacity-50"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200">
              {preset.name}
            </span>
            {!preset.isActive && (
              <span className="text-[9px] text-zinc-500 border border-white/5 rounded px-1">
                已禁用
              </span>
            )}
            {loraCount > 0 && (
              <span className="text-[9px] text-amber-400/60">
                {loraCount} LoRA
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
            {preset.prompt.slice(0, 120)}
            {preset.prompt.length > 120 ? "..." : ""}
          </div>
          {preset.negativePrompt && (
            <div className="mt-0.5 text-[10px] text-rose-400/40 truncate">
              neg: {preset.negativePrompt.slice(0, 80)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetForm — create/edit form for a preset
// ---------------------------------------------------------------------------

function PresetForm({
  categoryId,
  preset,
  onSave,
  onDelete,
  onCancel,
  isPending,
}: {
  categoryId: string;
  preset: PromptPresetItem | null;
  onSave: (data: {
    categoryId: string;
    name: string;
    slug: string;
    prompt: string;
    negativePrompt?: string | null;
    lora1?: unknown;
    lora2?: unknown;
    notes?: string | null;
    isActive?: boolean;
  }) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [slug, setSlug] = useState(preset?.slug ?? "");
  const [prompt, setPrompt] = useState(preset?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(
    preset?.negativePrompt ?? "",
  );
  const [lora1, setLora1] = useState(parseLoraBindings(preset?.lora1));
  const [lora2, setLora2] = useState(parseLoraBindings(preset?.lora2));
  const [notes, setNotes] = useState(preset?.notes ?? "");
  const [isActive, setIsActive] = useState(preset?.isActive ?? true);

  function handleNameChange(value: string) {
    setName(value);
    if (!preset) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[\s]+/g, "-")
          .replace(/[^a-z0-9\u4e00-\u9fff-]/g, ""),
      );
    }
  }

  function handleSubmit() {
    onSave({
      categoryId,
      name: name.trim(),
      slug: slug.trim(),
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || null,
      lora1: serializeLoraBindings(lora1),
      lora2: serializeLoraBindings(lora2),
      notes: notes.trim() || null,
      isActive,
    });
  }

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-3">
      <div className="text-[11px] font-medium text-sky-300">
        {preset ? "编辑模板" : "新建模板"}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="模板名称"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500">正面提示词</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="positive prompt..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500">负面提示词</span>
        <textarea
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          rows={2}
          placeholder="negative prompt..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      <div className="space-y-1">
        <span className="text-[10px] text-zinc-500">LoRA 1（第一阶段）</span>
        <LoraBindingEditor bindings={lora1} onChange={setLora1} />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-zinc-500">LoRA 2（高清修复）</span>
        <LoraBindingEditor bindings={lora2} onChange={setLora2} />
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500">备注</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="可选备注..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-white/20"
        />
        启用
      </label>

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim() || !prompt.trim()}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="size-3" /> 删除
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
    </div>
  );
}
