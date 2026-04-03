"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
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
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import type { PresetCategoryFull, PresetFull, PresetVariantItem, PresetGroupItem } from "@/lib/server-data";
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
  createPresetGroup,
  updatePresetGroup,
  deletePresetGroup,
  addGroupMember,
  removeGroupMember,
} from "@/lib/actions";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptManager({
  initialCategories,
  initialGroups,
}: {
  initialCategories: PresetCategoryFull[];
  initialGroups: PresetGroupItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [groups, setGroups] = useState(initialGroups);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );

  // Sync with server data after router.refresh()
  useEffect(() => {
    setCategories(initialCategories);
    setGroups(initialGroups);
    // Keep selection if the category still exists, otherwise select first
    setSelectedCatId((prev) =>
      initialCategories.some((c) => c.id === prev)
        ? prev
        : initialCategories[0]?.id ?? null,
    );
  }, [initialCategories, initialGroups]);
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
                allCategories={categories}
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
                选择或创建一个分类
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Preset Group management */}
      <GroupManager
        groups={groups}
        categories={categories}
        onRefresh={refresh}
      />
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
  allCategories,
}: {
  category: PresetCategoryFull;
  onRefresh: () => void;
  allCategories: PresetCategoryFull[];
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
          allCategories={allCategories}
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
                  linkedVariants: v.linkedVariants.length > 0 ? v.linkedVariants : undefined,
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
              allCategories={allCategories}
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
// LinkedVariantsEditor — select linked variants from other presets
// ---------------------------------------------------------------------------

type LinkedVariantRef = { presetId: string; variantId: string };

function LinkedVariantsEditor({
  linkedVariants,
  onChange,
  currentPresetId,
  allCategories,
}: {
  linkedVariants: LinkedVariantRef[];
  onChange: (lv: LinkedVariantRef[]) => void;
  currentPresetId?: string;
  allCategories: PresetCategoryFull[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // Build structured data excluding current preset
  const categoriesFiltered = useMemo(() => {
    return allCategories
      .map((cat) => ({
        ...cat,
        presets: cat.presets.filter((p) => p.id !== currentPresetId),
      }))
      .filter((cat) => cat.presets.length > 0);
  }, [allCategories, currentPresetId]);

  // Flat list for search
  const allItems = useMemo(() => {
    const items: Array<{
      presetId: string;
      presetName: string;
      variantId: string;
      variantName: string;
      categoryName: string;
      displayName: string;
    }> = [];
    for (const cat of categoriesFiltered) {
      for (const preset of cat.presets) {
        for (const v of preset.variants) {
          items.push({
            presetId: preset.id,
            variantId: v.id,
            presetName: preset.name,
            variantName: v.name,
            categoryName: cat.name,
            displayName: preset.variants.length === 1
              ? `${cat.name} / ${preset.name}`
              : `${cat.name} / ${preset.name} / ${v.name}`,
          });
        }
      }
    }
    return items;
  }, [categoriesFiltered]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allItems
      .filter((item) =>
        !linkedVariants.some((lv) => lv.variantId === item.variantId) &&
        (item.displayName.toLowerCase().includes(q) ||
         item.presetName.toLowerCase().includes(q) ||
         item.variantName.toLowerCase().includes(q) ||
         item.categoryName.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [searchQuery, allItems, linkedVariants]);

  // Cascade selections
  const selectedCat = categoriesFiltered.find((c) => c.id === selectedCatId);
  const selectedPreset = selectedCat?.presets.find((p) => p.id === selectedPresetId);
  const availableVariants = selectedPreset?.variants.filter(
    (v) => !linkedVariants.some((lv) => lv.variantId === v.id),
  ) ?? [];

  // Resolve display names for current linked variants
  const linkedDisplay = linkedVariants.map((ref) => {
    const item = allItems.find((a) => a.variantId === ref.variantId);
    return {
      ...ref,
      displayName: item?.displayName ?? `未知变体 (${ref.variantId.slice(0, 8)}...)`,
    };
  });

  function handleAdd(presetId: string, variantId: string) {
    if (linkedVariants.some((lv) => lv.variantId === variantId)) return;
    onChange([...linkedVariants, { presetId, variantId }]);
    setSelectedPresetId("");
  }

  function handleRemove(variantId: string) {
    onChange(linkedVariants.filter((lv) => lv.variantId !== variantId));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">关联变体</span>
        <button
          type="button"
          onClick={() => { setShowPicker(!showPicker); setSearchQuery(""); }}
          className="inline-flex items-center gap-0.5 text-[10px] text-sky-400/70 hover:text-sky-300"
        >
          <Plus className="size-2.5" /> 添加
        </button>
      </div>

      {/* Current linked variants */}
      {linkedDisplay.length > 0 && (
        <div className="space-y-1">
          {linkedDisplay.map((item) => (
            <div
              key={item.variantId}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1"
            >
              <span className="text-[10px] text-zinc-300 truncate">{item.displayName}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.variantId)}
                className="rounded p-0.5 text-zinc-600 hover:text-red-400"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {linkedVariants.length === 0 && !showPicker && (
        <div className="text-[10px] text-zinc-600">无关联变体</div>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="rounded-lg border border-sky-500/20 bg-zinc-900 p-2 space-y-2">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索变体..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-sky-500/30 placeholder:text-zinc-600"
          />

          {/* Search results */}
          {searchQuery.trim() ? (
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {searchResults.length === 0 ? (
                <div className="py-1.5 text-center text-[10px] text-zinc-600">无匹配结果</div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.variantId}
                    type="button"
                    onClick={() => handleAdd(item.presetId, item.variantId)}
                    className="w-full rounded px-2 py-1 text-left text-[10px] text-zinc-300 hover:bg-white/[0.06]"
                  >
                    {item.displayName}
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Three-level cascade */
            <div className="space-y-1.5">
              {/* Level 1: Category */}
              <select
                value={selectedCatId}
                onChange={(e) => { setSelectedCatId(e.target.value); setSelectedPresetId(""); }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-200 outline-none"
              >
                <option value="">选择分类...</option>
                {categoriesFiltered.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Level 2: Preset */}
              {selectedCat && (
                <select
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-200 outline-none"
                >
                  <option value="">选择预制...</option>
                  {selectedCat.presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

              {/* Level 3: Variant list */}
              {selectedPreset && (
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {availableVariants.length === 0 ? (
                    <div className="py-1.5 text-center text-[10px] text-zinc-600">无可选变体</div>
                  ) : (
                    availableVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleAdd(selectedPreset.id, v.id)}
                        className="w-full rounded px-2 py-1 text-left text-[10px] text-zinc-300 hover:bg-white/[0.06]"
                      >
                        {v.name}
                        <span className="ml-1 text-zinc-600 truncate">
                          {v.prompt.slice(0, 40)}{v.prompt.length > 40 ? "..." : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetForm — create/edit form for a preset with inline variant editing
// ---------------------------------------------------------------------------

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
  allCategories,
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
  allCategories: PresetCategoryFull[];
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
        linkedVariants: v.linkedVariants ?? [],
      }));
    }
    // New preset: start with one empty variant
    return [{ name: "默认", slug: "default", prompt: "", negativePrompt: "", lora1: [], lora2: [], linkedVariants: [] }];
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
      linkedVariants: [],
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
            linkedVariants: v.linkedVariants.length > 0 ? v.linkedVariants : undefined,
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

        {/* Linked variants */}
        <LinkedVariantsEditor
          linkedVariants={current.linkedVariants}
          onChange={(lv) => updateCurrentVariant({ linkedVariants: lv })}
          currentPresetId={preset?.id}
          allCategories={allCategories}
        />

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

// ---------------------------------------------------------------------------
// GroupManager — 预制组管理
// ---------------------------------------------------------------------------

function GroupManager({
  groups,
  categories,
  onRefresh,
}: {
  groups: PresetGroupItem[];
  categories: PresetCategoryFull[];
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <SectionCard title="预制组" subtitle="将多个预制组合为一组，导入时一次性添加所有成员。">
      <div className="space-y-3">
        {groups.length === 0 && !showCreateForm && (
          <div className="flex h-20 items-center justify-center text-xs text-zinc-500">
            暂无预制组
          </div>
        )}

        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            categories={categories}
            groups={groups}
            isEditing={editingGroupId === group.id}
            onEdit={() => setEditingGroupId(editingGroupId === group.id ? null : group.id)}
            onRefresh={() => {
              setEditingGroupId(null);
              onRefresh();
            }}
            isPending={isPending}
            startTransition={startTransition}
          />
        ))}

        {showCreateForm && (
          <GroupCreateForm
            onSave={(data) => {
              startTransition(async () => {
                await createPresetGroup(data);
                setShowCreateForm(false);
                onRefresh();
              });
            }}
            onCancel={() => setShowCreateForm(false)}
            isPending={isPending}
          />
        )}

        {!showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-400 hover:border-white/20 hover:text-zinc-200"
          >
            <Plus className="size-3.5" /> 新建预制组
          </button>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// GroupCard
// ---------------------------------------------------------------------------

function GroupCard({
  group,
  categories,
  groups,
  isEditing,
  onEdit,
  onRefresh,
  isPending,
  startTransition,
}: {
  group: PresetGroupItem;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  isEditing: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}
        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
      >
        <FolderOpen className="size-4 shrink-0 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200">{group.name}</div>
          <div className="text-[10px] text-zinc-500">
            {group.members.length} 个成员 · {group.slug}
          </div>
        </div>
        <ChevronDown className={`size-3.5 text-zinc-500 transition ${isEditing ? "rotate-180" : ""}`} />
      </div>

      {isEditing && (
        <div className="border-t border-white/5 px-3 py-3 space-y-3">
          <GroupInlineEditor
            group={group}
            onSave={(data) => {
              startTransition(async () => {
                await updatePresetGroup(group.id, data);
                onRefresh();
              });
            }}
            onDelete={() => {
              if (!confirm(`确认删除预制组「${group.name}」？`)) return;
              startTransition(async () => {
                await deletePresetGroup(group.id);
                onRefresh();
              });
            }}
            isPending={isPending}
          />

          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">成员</span>
            {group.members.length === 0 && (
              <div className="text-[10px] text-zinc-600 py-1">暂无成员</div>
            )}
            {group.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                <div className="flex-1 min-w-0 text-xs text-zinc-300">
                  {m.subGroupId ? (
                    <span className="text-amber-400/80">
                      <FolderOpen className="mr-1 inline size-3" />
                      {m.subGroupName ?? m.subGroupId}
                    </span>
                  ) : (
                    <>
                      {m.presetName ?? m.presetId}
                      {m.variantName && (
                        <span className="text-zinc-500"> / {m.variantName}</span>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await removeGroupMember(m.id);
                      onRefresh();
                    });
                  }}
                  className="rounded p-0.5 text-zinc-600 hover:text-red-400 disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>

          <AddGroupMemberForm
            groupId={group.id}
            categories={categories}
            groups={groups.filter((g) => g.id !== group.id)}
            onAdd={(input) => {
              startTransition(async () => {
                await addGroupMember(input);
                onRefresh();
              });
            }}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupCreateForm
// ---------------------------------------------------------------------------

function GroupCreateForm({
  onSave,
  onCancel,
  isPending,
}: {
  onSave: (data: { name: string; slug: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">组名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === toSlug(name)) setSlug(toSlug(e.target.value));
            }}
            placeholder="如：基础组合"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="basic-combo"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim() })}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3" /> 创建
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

/** Simple slug generator */
function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// GroupInlineEditor
// ---------------------------------------------------------------------------

function GroupInlineEditor({
  group,
  onSave,
  onDelete,
  isPending,
}: {
  group: PresetGroupItem;
  onSave: (data: { name: string; slug: string }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(group.name);
  const [slug, setSlug] = useState(group.slug);
  const dirty = name !== group.name || slug !== group.slug;

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">组名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">Slug</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      {dirty && (
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim() })}
          className="rounded-lg bg-sky-500/20 p-1.5 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddGroupMemberForm
// ---------------------------------------------------------------------------

function AddGroupMemberForm({
  groupId,
  categories,
  groups,
  onAdd,
  isPending,
}: {
  groupId: string;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  onAdd: (input: { groupId: string; presetId?: string; variantId?: string; subGroupId?: string }) => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<"preset" | "group">("preset");
  const [selCatId, setSelCatId] = useState<string>("");
  const [selPresetId, setSelPresetId] = useState<string>("");
  const [selVariantId, setSelVariantId] = useState<string>("");
  const [selGroupId, setSelGroupId] = useState<string>("");

  const selCat = categories.find((c) => c.id === selCatId);
  const selPreset = selCat?.presets.find((p) => p.id === selPresetId);

  useEffect(() => { setSelPresetId(""); setSelVariantId(""); }, [selCatId]);
  useEffect(() => { setSelVariantId(""); }, [selPresetId]);

  const canAdd = mode === "group" ? !!selGroupId : !!selPresetId;

  function handleAdd() {
    if (mode === "group" && selGroupId) {
      onAdd({ groupId, subGroupId: selGroupId });
      setSelGroupId("");
    } else if (selPresetId) {
      onAdd({
        groupId,
        presetId: selPresetId,
        variantId: selVariantId || undefined,
      });
      setSelVariantId("");
    }
  }

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-white/10 p-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500">添加成员:</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={`rounded px-2 py-0.5 text-[10px] ${mode === "preset" ? "bg-sky-500/20 text-sky-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            预制
          </button>
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setMode("group")}
              className={`rounded px-2 py-0.5 text-[10px] ${mode === "group" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              子组
            </button>
          )}
        </div>
      </div>

      {mode === "preset" ? (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="relative">
            <select value={selCatId} onChange={(e) => setSelCatId(e.target.value)} className={selectClass}>
              <option value="">分类...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          </div>
          <div className="relative">
            <select value={selPresetId} onChange={(e) => setSelPresetId(e.target.value)} disabled={!selCatId} className={selectClass}>
              <option value="">预制...</option>
              {selCat?.presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          </div>
          <div className="relative">
            <select value={selVariantId} onChange={(e) => setSelVariantId(e.target.value)} disabled={!selPresetId} className={selectClass}>
              <option value="">变体 (可选)...</option>
              {selPreset?.variants.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">{v.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>
      ) : (
        <div className="relative">
          <select value={selGroupId} onChange={(e) => setSelGroupId(e.target.value)} className={selectClass}>
            <option value="">选择子组...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-zinc-900">{g.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
        </div>
      )}

      <button
        type="button"
        disabled={isPending || !canAdd}
        onClick={handleAdd}
        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.1] disabled:opacity-40"
      >
        <Plus className="size-3" /> 添加
      </button>
    </div>
  );
}
