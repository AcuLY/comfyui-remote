"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  ChevronLeft,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import type { PresetCategoryFull, PresetFull, PresetVariantItem } from "@/lib/server-data";
import {
  createPresetCategory,
  updatePresetCategory,
  deletePresetCategory,
  createPreset,
  updatePreset,
  deletePreset,
  createPresetVariant,
  updatePresetVariant,
  deletePresetVariant,
  getPresetUsage,
  deletePresetCascade,
  syncPresetToSections,
} from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptManager({
  initialCategories,
}: {
  initialCategories: PresetCategoryFull[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );

  // Sync with server data after router.refresh()
  useEffect(() => {
    setCategories(initialCategories);
    // Keep selection if the category still exists, otherwise select first
    setSelectedCatId((prev) =>
      initialCategories.some((c) => c.id === prev)
        ? prev
        : initialCategories[0]?.id ?? null,
    );
  }, [initialCategories]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <SectionCard title="预制管理" subtitle="管理预制分类和预制项。每个分类下可创建多个预制，用于项目绑定和小节导入。">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Left panel: categories */}
          <div className="w-full shrink-0 space-y-2 md:w-56">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                分类
              </span>
              <div className="flex gap-1">
                <Link
                  href="/assets/prompts/sort-rules"
                  className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
                  title="排序规则"
                >
                  <Settings2 className="size-3.5" />
                </Link>
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
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedCatId(cat.id);
                    setShowCatForm(false);
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
                    {cat.presetCount} 个预制
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCatId(cat.id);
                    setShowCatForm(true);
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
                      await updatePresetCategory(editingCatId, data);
                    } else {
                      const cat = await createPresetCategory(data);
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
                            await deletePresetCategory(editingCatId);
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
  category: PresetCategoryFull | null;
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
// PresetList — right panel showing presets within a category
// ---------------------------------------------------------------------------

function PresetList({
  category,
  onRefresh,
}: {
  category: PresetCategoryFull;
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
            {category.presets.length} 个预制
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
          <Plus className="size-3" /> 新建预制
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <PresetForm
          categoryId={category.id}
          preset={null}
          onSave={(data, variantDrafts) => {
            startTransition(async () => {
              const newPreset = await createPreset(data);
              // Save all variant drafts from the form
              for (const v of variantDrafts) {
                await createPresetVariant({
                  presetId: newPreset.id,
                  name: v.name.trim(),
                  slug: v.slug.trim(),
                  prompt: v.prompt.trim(),
                  negativePrompt: v.negativePrompt.trim() || null,
                  lora1: serializeLoraBindings(v.lora1),
                  lora2: serializeLoraBindings(v.lora2),
                });
              }
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
          暂无预制，点击「新建预制」开始
        </div>
      ) : (
        category.presets.map((preset) =>
          editingId === preset.id ? (
            <PresetForm
              key={preset.id}
              categoryId={category.id}
              preset={preset}
              onSave={(data, _variantDrafts) => {
                startTransition(async () => {
                  await updatePreset(preset.id, data);
                  setEditingId(null);
                  onRefresh();
                });
              }}
              onDelete={() => {
                startTransition(async () => {
                  // Check usage before deleting
                  const usage = await getPresetUsage(preset.id);
                  let msg = "确认删除此预制？";
                  if (usage.sections.length > 0) {
                    const lines = usage.sections.map(
                      (s) => `  · ${s.projectTitle} / ${s.sectionName} (${s.blockCount} 个提示词块)`,
                    );
                    msg = `以下小节使用了该预制：\n${lines.join("\n")}\n\n确认删除将同时移除这些小节中的相关提示词块和 LoRA。`;
                  }
                  if (!confirm(msg)) return;
                  await deletePresetCascade(preset.id);
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
  preset: PresetFull;
  onEdit: () => void;
}) {
  const variantCount = preset.variantCount;
  const firstVariant = preset.variants[0];
  const lora1 = firstVariant ? parseLoraBindings(firstVariant.lora1) : [];
  const lora2 = firstVariant ? parseLoraBindings(firstVariant.lora2) : [];
  const loraCount = lora1.length + lora2.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/15 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-200">
          {preset.name}
        </span>
        {variantCount > 0 && (
          <span className="text-[9px] text-sky-400/60">
            {variantCount} 变体
          </span>
        )}
        {loraCount > 0 && (
          <span className="text-[9px] text-amber-400/60">
            {loraCount} LoRA
          </span>
        )}
      </div>
      {firstVariant && (
        <div className="mt-1 text-[11px] text-zinc-500 line-clamp-1">
          {firstVariant.prompt.slice(0, 100)}
          {firstVariant.prompt.length > 100 ? "..." : ""}
        </div>
      )}
      {!firstVariant && (
        <div className="mt-1 text-[11px] text-zinc-600">暂无变体</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetForm — create/edit form for a preset with inline variant editing
// ---------------------------------------------------------------------------

type LinkedVariantRef = { presetId: string; variantId: string };

type VariantDraft = {
  id?: string; // undefined = new variant
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string;
  lora1: import("@/lib/lora-types").LoraBinding[];
  lora2: import("@/lib/lora-types").LoraBinding[];
  linkedVariants: LinkedVariantRef[];
};

function PresetForm({
  categoryId,
  preset,
  onSave,
  onDelete,
  onCancel,
  isPending,
}: {
  categoryId: string;
  preset: PresetFull | null;
  onSave: (data: {
    categoryId: string;
    name: string;
    slug: string;
    notes?: string | null;
    isActive?: boolean;
  }, variantDrafts: VariantDraft[]) => void;
  onDelete?: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const router = useRouter();
  const [, startVariantTransition] = useTransition();

  // Preset-level fields
  const [name, setName] = useState(preset?.name ?? "");
  const [slug, setSlug] = useState(preset?.slug ?? "");
  const [notes, setNotes] = useState(preset?.notes ?? "");

  // Variant state
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (preset && preset.variants.length > 0) {
      return preset.variants.map((v) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt ?? "",
        lora1: parseLoraBindings(v.lora1),
        lora2: parseLoraBindings(v.lora2),
      }));
    }
    // New preset: start with one empty variant
    return [{ name: "默认", slug: "default", prompt: "", negativePrompt: "", lora1: [], lora2: [] }];
  });
  const [currentIdx, setCurrentIdx] = useState(0);

  const current = variants[currentIdx];
  const totalVariants = variants.length;

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

  function handleVariantNameChange(value: string) {
    const updated = [...variants];
    updated[currentIdx] = { ...current, name: value };
    // Auto-slug for variant
    if (!current.id) {
      updated[currentIdx].slug = value
        .toLowerCase()
        .replace(/[\s]+/g, "-")
        .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "") || "variant";
    }
    setVariants(updated);
  }

  function updateCurrentVariant(patch: Partial<VariantDraft>) {
    const updated = [...variants];
    updated[currentIdx] = { ...current, ...patch };
    setVariants(updated);
  }

  function addVariant() {
    const newIdx = variants.length;
    setVariants([...variants, {
      name: `变体 ${newIdx + 1}`,
      slug: `variant-${newIdx + 1}`,
      prompt: "",
      negativePrompt: "",
      lora1: [],
      lora2: [],
    }]);
    setCurrentIdx(newIdx);
  }

  function removeCurrentVariant() {
    if (totalVariants <= 1) return;
    if (!confirm(`确认删除变体「${current.name}」？`)) return;

    // If existing variant, call server delete
    if (current.id) {
      startVariantTransition(async () => {
        await deletePresetVariant(current.id!);
      });
    }

    const updated = variants.filter((_, i) => i !== currentIdx);
    setVariants(updated);
    setCurrentIdx(Math.min(currentIdx, updated.length - 1));
  }

  async function handleSubmit() {
    // 1. Save preset (create or update) — pass variant drafts to parent
    onSave({
      categoryId,
      name: name.trim(),
      slug: slug.trim(),
      notes: notes.trim() || null,
      isActive: true,
    }, variants);

    // 2. For existing preset, save all variants then sync to sections
    if (preset) {
      startVariantTransition(async () => {
        for (const v of variants) {
          const variantData = {
            presetId: preset.id,
            name: v.name.trim(),
            slug: v.slug.trim(),
            prompt: v.prompt.trim(),
            negativePrompt: v.negativePrompt.trim() || null,
            lora1: serializeLoraBindings(v.lora1),
            lora2: serializeLoraBindings(v.lora2),
          };
          if (v.id) {
            await updatePresetVariant(v.id, variantData);
          } else {
            await createPresetVariant(variantData);
          }
        }
        // Sync updated content to all sections that imported this preset
        await syncPresetToSections(preset.id);
      });
    }
  }

  // For new presets, variants are saved after the preset is created
  // We need a post-save callback — handled by the parent's onSave flow

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-3">
      <div className="text-[11px] font-medium text-sky-300">
        {preset ? "编辑预制" : "新建预制"}
      </div>

      {/* Preset-level: name + slug */}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">预制名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="预制名称"
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
        <span className="text-[10px] text-zinc-500">备注</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="可选备注..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      {/* ── Variant section ── */}
      <div className="border-t border-white/5 pt-3 space-y-2">
        {/* Variant header: pagination + add/delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-400">
              变体 {currentIdx + 1} / {totalVariants}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(currentIdx - 1)}
                className="rounded p-0.5 text-zinc-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={currentIdx >= totalVariants - 1}
                onClick={() => setCurrentIdx(currentIdx + 1)}
                className="rounded p-0.5 text-zinc-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.06]"
            >
              <Plus className="size-2.5" /> 添加
            </button>
            {totalVariants > 1 && (
              <button
                type="button"
                onClick={removeCurrentVariant}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="size-2.5" /> 删除
              </button>
            )}
          </div>
        </div>

        {/* Variant name + slug */}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">变体名称</span>
            <input
              type="text"
              value={current.name}
              onChange={(e) => handleVariantNameChange(e.target.value)}
              placeholder="变体名称"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">变体 Slug</span>
            <input
              type="text"
              value={current.slug}
              onChange={(e) => updateCurrentVariant({ slug: e.target.value })}
              placeholder="variant-slug"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
        </div>

        {/* Variant prompt fields */}
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">正面提示词</span>
          <textarea
            value={current.prompt}
            onChange={(e) => updateCurrentVariant({ prompt: e.target.value })}
            rows={3}
            placeholder="positive prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-500">负面提示词</span>
          <textarea
            value={current.negativePrompt}
            onChange={(e) => updateCurrentVariant({ negativePrompt: e.target.value })}
            rows={2}
            placeholder="negative prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">LoRA 1（第一阶段）</span>
          <LoraBindingEditor bindings={current.lora1} onChange={(v) => updateCurrentVariant({ lora1: v })} />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">LoRA 2（高清修复）</span>
          <LoraBindingEditor bindings={current.lora2} onChange={(v) => updateCurrentVariant({ lora2: v })} />
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex gap-1.5 border-t border-white/5 pt-3">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
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
            <Trash2 className="size-3" /> 删除预制
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
