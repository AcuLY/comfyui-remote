"use client";

import { useState, useEffect, useTransition, useMemo, useId, useSyncExternalStore, useRef } from "react";
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
import {
  Plus,
  Trash2,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import { toast } from "sonner";
import type {
  PresetCategoryFull,
  PresetFull,
} from "@/lib/server-data";
import {
  deletePresetVariant,
  reorderPresetVariants,
} from "@/lib/actions";
import { parseLoraBindings } from "@/lib/lora-types";
import type { LinkedVariantRef, VariantDraft } from "./preset-types";
import { PRESET_HISTORY_TABS } from "./preset-types";
import { PresetChangeHistoryPanel } from "./change-history-panel";
import { toSlug } from "./group-utils";

function uniqueSlug(base: string, usedSlugs: Set<string>) {
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

// ---------------------------------------------------------------------------
// LinkedVariantsEditor — select linked variants from other presets
// ---------------------------------------------------------------------------

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build filtered categories excluding current preset
  const categoriesFiltered = useMemo(() => {
    return allCategories
      .map((cat) => ({
        ...cat,
        presets: cat.presets.filter((p) => p.id !== currentPresetId),
      }))
      .filter((cat) => cat.presets.length > 0);
  }, [allCategories, currentPresetId]);

  // Flat list with full variant data for display name + content resolution
  const allItems = useMemo(() => {
    const items: Array<{
      presetId: string;
      presetName: string;
      variantId: string;
      variantName: string;
      categoryName: string;
      displayName: string;
      prompt: string;
      negativePrompt: string | null;
      lora1: ReturnType<typeof parseLoraBindings>;
      lora2: ReturnType<typeof parseLoraBindings>;
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
            prompt: v.prompt ?? "",
            negativePrompt: v.negativePrompt,
            lora1: parseLoraBindings(v.lora1),
            lora2: parseLoraBindings(v.lora2),
          });
        }
      }
    }
    return items;
  }, [categoriesFiltered]);

  // Resolve display + content for current linked variants
  const linkedDisplay = linkedVariants.map((ref) => {
    const item = allItems.find((a) => a.variantId === ref.variantId);
    return {
      ...ref,
      displayName: item?.displayName ?? `未知变体 (${ref.variantId.slice(0, 8)}...)`,
      prompt: item?.prompt ?? "",
      negativePrompt: item?.negativePrompt,
      lora1: item?.lora1 ?? [],
      lora2: item?.lora2 ?? [],
    };
  });

  function handleAdd(val: { presetId: string; variantId: string }) {
    if (linkedVariants.some((lv) => lv.variantId === val.variantId)) return;
    onChange([...linkedVariants, { presetId: val.presetId, variantId: val.variantId }]);
  }

  function handleRemove(variantId: string) {
    onChange(linkedVariants.filter((lv) => lv.variantId !== variantId));
  }

  // Filter out already-linked variants from picker categories
  const pickerCategories = useMemo(() => {
    return categoriesFiltered.map((cat) => ({
      ...cat,
      presets: cat.presets.map((p) => ({
        ...p,
        variants: p.variants.filter((v) => !linkedVariants.some((lv) => lv.variantId === v.id)),
      })).filter((p) => p.variants.length > 0),
    })).filter((cat) => cat.presets.length > 0);
  }, [categoriesFiltered, linkedVariants]);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-zinc-500">关联变体</span>

      {/* Current linked variants */}
      {linkedDisplay.length > 0 && (
        <div className="space-y-1">
          {linkedDisplay.map((item) => {
            const isExpanded = expandedId === item.variantId;
            const hasContent = item.prompt || item.negativePrompt || item.lora1.length > 0 || item.lora2.length > 0;
            return (
              <div
                key={item.variantId}
                className="rounded-lg border border-white/5 bg-white/[0.02]"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.variantId)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  >
                    {hasContent && (
                      <ChevronDown className={`size-3 shrink-0 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    )}
                    <span className="text-xs text-zinc-300 truncate">{item.displayName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.variantId)}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                {/* Expanded preview: prompt + LoRA */}
                {isExpanded && hasContent && (
                  <div className="space-y-1.5 border-t border-white/5 px-2.5 py-2">
                    {item.prompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">正面提示词</span>
                        <div className="mt-0.5 rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {item.prompt}
                        </div>
                      </div>
                    )}
                    {item.negativePrompt && (
                      <div>
                        <span className="text-[10px] text-zinc-600">负面提示词</span>
                        <div className="mt-0.5 rounded bg-black/20 px-2 py-1.5 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {item.negativePrompt}
                        </div>
                      </div>
                    )}
                    {item.lora1.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 1</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora1.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
                              <span className="shrink-0 text-zinc-600">{l.weight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.lora2.length > 0 && (
                      <div>
                        <span className="text-[10px] text-zinc-600">LoRA 2</span>
                        <div className="mt-0.5 space-y-0.5">
                          {item.lora2.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <span className="truncate">{l.path.split(/[\\/]/).pop()}</span>
                              <span className="shrink-0 text-zinc-600">{l.weight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {linkedVariants.length === 0 && !showPicker && (
        <div className="text-xs text-zinc-600">无关联变体</div>
      )}

      {/* Full-width add button / picker */}
      {showPicker ? (
        <PresetCascadePicker
          categories={pickerCategories}
          value={null}
          onChange={(val) => {
            if (val) handleAdd({ presetId: val.presetId, variantId: val.variantId });
          }}
          placeholder="选择关联变体…"
          presetCategoriesOnly
          defaultOpen
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition"
        >
          <Plus className="size-3 inline-block mr-1 -mt-0.5" />添加关联变体
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableVariantBar — draggable bar for a single variant in PresetForm
// ---------------------------------------------------------------------------

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
  const style: React.CSSProperties = {
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
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

// ---------------------------------------------------------------------------
// PresetForm — create/edit form for a preset with inline variant editing
// ---------------------------------------------------------------------------

export type { VariantDraft } from "./preset-types";

let variantDraftCounter = 0;
function nextVariantDraftClientId() {
  variantDraftCounter += 1;
  return `variant-draft-${variantDraftCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneLoraBindings(bindings: VariantDraft["lora1"]) {
  return bindings.map((entry) => ({ ...entry }));
}

function cloneLinkedVariants(linkedVariants: VariantDraft["linkedVariants"]) {
  return linkedVariants.map((entry) => ({ ...entry }));
}

function hasIncompleteLoraDraft(variantDrafts: VariantDraft[]) {
  return variantDrafts.some((variant) =>
    [...variant.lora1, ...variant.lora2].some((entry) => !entry.path.trim()),
  );
}

type PresetFormData = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  notes?: string | null;
  civitaiLinks?: string[] | null;
  isActive?: boolean;
};

type SavePayload = {
  data: PresetFormData;
  variantDrafts: VariantDraft[];
};

type SaveStatus = "idle" | "saving" | "queued" | "saved" | "error";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "保存失败";
}

export function PresetForm({
  categoryId,
  folderId,
  preset,
  onSave,
  onCancel,
  isPending,
  allCategories,
  activeVariantId,
  onVariantChange,
  embedded = false,
}: {
  categoryId: string;
  folderId?: string | null;
  preset: PresetFull | null;
  onSave: (data: PresetFormData, variantDrafts: VariantDraft[]) => void | Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  allCategories: PresetCategoryFull[];
  activeVariantId?: string | null;
  onVariantChange?: (variantId: string | null) => void;
  /** When true, renders without outer container (for inline accordion use) */
  embedded?: boolean;
}) {
  const [, startVariantTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(preset ? "saved" : "idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef<SavePayload | null>(null);
  const failedSaveRef = useRef<SavePayload | null>(null);

  // Preset-level fields
  const [name, setName] = useState(preset?.name ?? "");
  const [notes, setNotes] = useState(preset?.notes ?? "");
  const [civitaiLinks, setCivitaiLinks] = useState<string[]>(preset?.civitaiLinks ?? []);
  const [newCivitaiLink, setNewCivitaiLink] = useState("");

  // Variant state
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (preset && preset.variants.length > 0) {
      return preset.variants.map((v) => ({
        clientId: nextVariantDraftClientId(),
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
    return [{ clientId: nextVariantDraftClientId(), name: "默认", slug: "default", prompt: "", negativePrompt: "", lora1: [], lora2: [], linkedVariants: [] }];
  });
  const [currentIdx, setCurrentIdx] = useState(0);

  // DnD for variant reordering
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
    () => variants.map((variant, index) => variant.clientId ?? variant.id ?? `draft-${index}`),
    [variants],
  );
  const variantDbIds = variants.map((variant) => variant.id ?? "").join("\u0001");
  const current = variants[currentIdx];
  const totalVariants = variants.length;

  useEffect(() => {
    if (!activeVariantId) {
      return;
    }

    const nextIdx = variantDbIds.split("\u0001").indexOf(activeVariantId);
    if (nextIdx >= 0) {
      queueMicrotask(() => setCurrentIdx(nextIdx));
    }
  }, [activeVariantId, variantDbIds]);

  function selectVariant(index: number) {
    setCurrentIdx(index);
    onVariantChange?.(variants[index]?.id ?? null);
  }

  function handleNameChange(value: string) {
    setName(value);
  }

  function handleVariantNameChange(value: string) {
    const patch: Partial<VariantDraft> = { name: value };
    if (!current.id) {
      patch.slug = toSlug(value) || "variant";
    }
    updateVariant(current.clientId, patch);
  }

  function buildPresetData(nextCivitaiLinks = civitaiLinks) {
    const categoryPresets = allCategories.find((item) => item.id === categoryId)?.presets ?? [];
    const usedSlugs = new Set(categoryPresets.filter((item) => item.id !== preset?.id).map((item) => item.slug));
    return {
      categoryId,
      folderId,
      name: name.trim(),
      slug: preset?.slug ?? uniqueSlug(toSlug(name.trim()) || "preset", usedSlugs),
      notes: notes.trim() || null,
      civitaiLinks: nextCivitaiLinks,
      isActive: true,
    };
  }

  function withSystemVariantSlugs(nextVariants: VariantDraft[]) {
    const usedSlugs = new Set<string>();
    return nextVariants.map((variant) => {
      const baseSlug = variant.id ? (variant.slug || toSlug(variant.name) || "variant") : (toSlug(variant.name) || "variant");
      const slug = uniqueSlug(baseSlug, usedSlugs);
      usedSlugs.add(slug);
      return { ...variant, slug };
    });
  }

  function buildSavePayload(nextVariants: VariantDraft[] = variants, nextCivitaiLinks = civitaiLinks): SavePayload {
    return {
      data: buildPresetData(nextCivitaiLinks),
      variantDrafts: withSystemVariantSlugs(nextVariants),
    };
  }

  async function flushSaveQueue() {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;

    try {
      while (queuedSaveRef.current) {
        const payload = queuedSaveRef.current;
        queuedSaveRef.current = null;
        setSaveStatus("saving");
        setSaveError(null);

        try {
          await onSave(payload.data, payload.variantDrafts);
          failedSaveRef.current = null;
        } catch (error: unknown) {
          failedSaveRef.current = payload;
          setSaveStatus("error");
          setSaveError(errorMessage(error));
          return;
        }
      }

      setSaveStatus("saved");
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) {
        void flushSaveQueue();
      }
    }
  }

  function requestSave(payload: SavePayload) {
    failedSaveRef.current = null;
    queuedSaveRef.current = payload;
    setSaveStatus(saveInFlightRef.current ? "queued" : "saving");
    setSaveError(null);
    void flushSaveQueue();
  }

  function retryFailedSave() {
    const payload = queuedSaveRef.current ?? failedSaveRef.current;
    if (!payload) return;
    failedSaveRef.current = null;
    queuedSaveRef.current = payload;
    setSaveStatus("saving");
    setSaveError(null);
    void flushSaveQueue();
  }

  function saveDrafts(nextVariants: VariantDraft[] = variants, nextCivitaiLinks = civitaiLinks) {
    requestSave(buildSavePayload(nextVariants, nextCivitaiLinks));
  }

  function normalizeCivitaiLink(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      toast.error("请输入完整链接，例如 https://civitai.com/models/...");
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      toast.error("链接只支持 http 或 https");
      return null;
    }

    return url.toString();
  }

  function addCivitaiLink() {
    const link = normalizeCivitaiLink(newCivitaiLink);
    if (!link) return;
    if (civitaiLinks.includes(link)) {
      setNewCivitaiLink("");
      return;
    }

    const nextLinks = [...civitaiLinks, link];
    setCivitaiLinks(nextLinks);
    setNewCivitaiLink("");
    saveDrafts(variants, nextLinks);
  }

  function removeCivitaiLink(link: string) {
    const nextLinks = civitaiLinks.filter((item) => item !== link);
    setCivitaiLinks(nextLinks);
    saveDrafts(variants, nextLinks);
  }

  function updateVariant(clientId: string | undefined, patch: Partial<VariantDraft>, options?: { autoSave?: boolean }) {
    const targetIdx = variants.findIndex((variant, index) =>
      variant.clientId === clientId || (!clientId && index === currentIdx),
    );
    if (targetIdx < 0) return;

    const updated = [...variants];
    updated[targetIdx] = { ...updated[targetIdx], ...patch };
    setVariants(updated);
    if (options?.autoSave) {
      saveDrafts(updated);
    }
  }

  function updateVariantLoras(clientId: string | undefined, key: "lora1" | "lora2", value: VariantDraft["lora1"]) {
    const targetIdx = variants.findIndex((variant, index) =>
      variant.clientId === clientId || (!clientId && index === currentIdx),
    );
    if (targetIdx < 0) return;

    const updated = [...variants];
    updated[targetIdx] = { ...updated[targetIdx], [key]: cloneLoraBindings(value) };
    setVariants(updated);

    if (!hasIncompleteLoraDraft(updated)) {
      saveDrafts(updated);
    }
  }

  function applyPromptToAllVariants(key: "prompt" | "negativePrompt") {
    const value = current[key];
    const updated = variants.map((variant) => ({ ...variant, [key]: value }));
    setVariants(updated);
    saveDrafts(updated);
  }

  function applyLoraToAllVariants(key: "lora1" | "lora2", entry: VariantDraft["lora1"][number]) {
    const path = entry.path.trim();
    if (!path) return;

    const appliedEntry = {
      path,
      weight: entry.weight,
      enabled: entry.enabled,
    };
    const updated = variants.map((variant) => {
      const bindings = cloneLoraBindings(variant[key]);
      const existingIdx = bindings.findIndex((item) => item.path.trim() === path);
      if (existingIdx >= 0) {
        bindings[existingIdx] = appliedEntry;
      } else {
        bindings.push(appliedEntry);
      }
      return { ...variant, [key]: bindings };
    });

    setVariants(updated);
    if (!hasIncompleteLoraDraft(updated)) {
      saveDrafts(updated);
    }
  }

  function addVariant() {
    const newIdx = variants.length;
    const prev = variants[variants.length - 1];
    setVariants([...variants, {
      clientId: nextVariantDraftClientId(),
      name: `变体 ${newIdx + 1}`,
      slug: `variant-${newIdx + 1}`,
      prompt: prev?.prompt ?? "",
      negativePrompt: prev?.negativePrompt ?? "",
      lora1: prev?.lora1 ? cloneLoraBindings(prev.lora1) : [],
      lora2: prev?.lora2 ? cloneLoraBindings(prev.lora2) : [],
      linkedVariants: prev?.linkedVariants ? cloneLinkedVariants(prev.linkedVariants) : [],
    }]);
    setCurrentIdx(newIdx);
    onVariantChange?.(null);
  }

  function removeCurrentVariant() {
    if (totalVariants <= 1) return;
    if (!confirm(`确认删除变体「${current.name}」？`)) return;

    // If existing variant, call server delete
    if (current.id) {
      startVariantTransition(async () => {
        try {
          await deletePresetVariant(current.id!);
          toast.success("变体已删除");
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "删除变体失败");
        }
      });
    }

    const updated = variants.filter((_, i) => i !== currentIdx);
    const nextIdx = Math.min(currentIdx, updated.length - 1);
    setVariants(updated);
    setCurrentIdx(nextIdx);
    onVariantChange?.(updated[nextIdx]?.id ?? null);
  }

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = variantIds.indexOf(active.id as string);
    const newIdx = variantIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(variants, oldIdx, newIdx);
    setVariants(reordered);

    // Follow the selected variant if it moved
    if (oldIdx === currentIdx) {
      setCurrentIdx(newIdx);
      onVariantChange?.(reordered[newIdx]?.id ?? null);
    } else if (oldIdx < currentIdx && newIdx >= currentIdx) {
      setCurrentIdx(currentIdx - 1);
      onVariantChange?.(reordered[currentIdx - 1]?.id ?? null);
    } else if (oldIdx > currentIdx && newIdx <= currentIdx) {
      setCurrentIdx(currentIdx + 1);
      onVariantChange?.(reordered[currentIdx + 1]?.id ?? null);
    }

    // Persist order for existing variants with real DB ids
    if (preset) {
      const idsWithOrder = reordered
        .filter((v) => v.id)
        .map((v) => v.id!);
      if (idsWithOrder.length > 0) {
        startVariantTransition(async () => {
          await reorderPresetVariants(preset.id, idsWithOrder);
        });
      }
    }
  }

  async function handleSubmit() {
    // Pass preset data + variant drafts to parent for saving
    saveDrafts(variants);
  }

  function handleAutoSave() {
    handleSubmit();
  }

  // For new presets, variants are saved after the preset is created
  // We need a post-save callback — handled by the parent's onSave flow
  const currentVariantKey = current.clientId ?? current.id ?? `draft-${currentIdx}`;
  const applyAllButtonClass = "inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-300";
  const isSaveBusy = saveStatus === "saving" || saveStatus === "queued" || isPending;
  const showSaveStatus = preset || saveStatus !== "idle";

  function renderLoraApplyActions(key: "lora1" | "lora2") {
    const bindings = current[key].filter((entry) => entry.path.trim());
    if (bindings.length === 0) return null;

    return (
      <div className="space-y-1">
        {bindings.map((entry, index) => {
          const path = entry.path.trim();
          return (
            <div
              key={`${path}:${index}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              <div className="min-w-0 text-[11px] text-zinc-500">
                <span className="block truncate text-zinc-400">{path.split(/[\\/]/).pop() || path}</span>
                <span className="text-zinc-600">
                  {entry.enabled ? "enabled" : "disabled"} / {entry.weight.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => applyLoraToAllVariants(key, entry)}
                className={applyAllButtonClass}
                title="Apply to all variants"
              >
                应用到所有变体
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  const formContent = (
    <div className="min-w-0 space-y-3 border-t border-white/5 px-3 py-3">
      {showSaveStatus && (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 text-[11px]">
          <span className="shrink-0 text-zinc-500">自动保存</span>
          <div className="flex min-w-0 items-center gap-2">
            {saveStatus === "saving" && (
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <Loader2 className="size-3 animate-spin" />
                保存中…
              </span>
            )}
            {saveStatus === "queued" && (
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <Loader2 className="size-3 animate-spin" />
                还有修改待保存
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400/80">
                <CheckCircle2 className="size-3" />
                已保存
              </span>
            )}
            {saveStatus === "error" && (
              <>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-red-300">
                  <AlertTriangle className="size-3 shrink-0" />
                  <span className="truncate">{saveError ?? "保存失败"}</span>
                </span>
                <button
                  type="button"
                  onClick={retryFailedSave}
                  className="shrink-0 rounded-md border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200 transition hover:bg-red-500/20"
                >
                  重试
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preset-level: name */}
      <div className="grid grid-cols-1 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-zinc-500">预制名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={handleAutoSave}
            placeholder="预制名称"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500">备注</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleAutoSave}
          rows={1}
          placeholder="可选备注..."
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-[10px] text-zinc-500">Civitai 链接</span>
        {civitaiLinks.length > 0 && (
          <div className="space-y-1">
            {civitaiLinks.map((link) => (
              <div
                key={link}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
              >
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-sky-300 transition hover:text-sky-200"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{link}</span>
                </a>
                <button
                  type="button"
                  onClick={() => removeCivitaiLink(link)}
                  className="shrink-0 rounded p-0.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                  title="移除链接"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="url"
            value={newCivitaiLink}
            onChange={(e) => setNewCivitaiLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCivitaiLink();
              }
            }}
            placeholder="https://civitai.com/models/..."
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
          <button
            type="button"
            onClick={addCivitaiLink}
            disabled={!newCivitaiLink.trim() || isSaveBusy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-40"
          >
            <Plus className="size-3" /> 添加
          </button>
        </div>
      </div>

      {/* ── Variant section ── */}
      <div className="border-t border-white/5 pt-3 space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-500">变体列表</span>
      </div>
      <div className="space-y-2">
        {/* Sortable variant list */}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {mounted ? (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleVariantDragEnd}
            >
              <SortableContext items={variantIds} strategy={rectSortingStrategy}>
                {variants.map((v, i) => (
                  <SortableVariantBar
                    key={variantIds[i]}
                    sortId={variantIds[i]}
                    name={v.name}
                    isSelected={i === currentIdx}
                    onSelect={() => selectVariant(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            variants.map((v, i) => (
              <div
                key={i}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-2"
              >
                <GripVertical className="size-3 text-zinc-600" />
                <div className="flex-1 min-w-0 truncate text-xs text-zinc-300">{v.name || "未命名变体"}</div>
              </div>
            ))
          )}
        </div>

        {/* Add / Delete buttons */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={addVariant}
            className="w-full rounded-lg border border-dashed border-white/10 px-2 py-1.5 text-xs text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition"
          >
            <Plus className="size-3 inline-block mr-1 -mt-0.5" />添加变体
          </button>
          {totalVariants > 1 && (
            <button
              type="button"
              onClick={removeCurrentVariant}
              className="w-full rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition"
            >
              <Trash2 className="size-3 inline-block mr-1 -mt-0.5" />删除变体
            </button>
          )}
        </div>


        {/* Variant name */}
        <div className="grid grid-cols-1 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">变体名称</span>
            <input
              type="text"
              value={current.name}
              onChange={(e) => handleVariantNameChange(e.target.value)}
              onBlur={handleAutoSave}
              placeholder="变体名称"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
            />
          </label>
        </div>

        <LinkedVariantsEditor
          linkedVariants={current.linkedVariants}
          onChange={(lv) => updateVariant(current.clientId, { linkedVariants: cloneLinkedVariants(lv) }, { autoSave: true })}
          currentPresetId={preset?.id}
          allCategories={allCategories}
        />

        {/* Variant prompt fields */}
        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">正面提示词</span>
          <button
            type="button"
            onClick={() => applyPromptToAllVariants("prompt")}
            className={`${applyAllButtonClass} float-right -mt-1 mb-1`}
            title="Apply to all variants"
          >
            应用到所有变体
          </button>
          <textarea
            value={current.prompt}
            onChange={(e) => updateVariant(current.clientId, { prompt: e.target.value })}
            onBlur={handleAutoSave}
            rows={3}
            placeholder="positive prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-zinc-500">负面提示词</span>
          <button
            type="button"
            onClick={() => applyPromptToAllVariants("negativePrompt")}
            className={`${applyAllButtonClass} float-right -mt-1 mb-1`}
            title="Apply to all variants"
          >
            应用到所有变体
          </button>
          <textarea
            value={current.negativePrompt}
            onChange={(e) => updateVariant(current.clientId, { negativePrompt: e.target.value })}
            onBlur={handleAutoSave}
            rows={2}
            placeholder="negative prompt..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500">LoRA 1（第一阶段）</span>
          <LoraBindingEditor
            key={`${currentVariantKey}:lora1`}
            bindings={current.lora1}
            onChange={(v) => updateVariantLoras(current.clientId, "lora1", v)}
          />
          {renderLoraApplyActions("lora1")}
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500">LoRA 2（高清修复）</span>
          <LoraBindingEditor
            key={`${currentVariantKey}:lora2`}
            bindings={current.lora2}
            onChange={(v) => updateVariantLoras(current.clientId, "lora2", v)}
          />
          {renderLoraApplyActions("lora2")}
        </div>
      </div>

      {preset && (
        <PresetChangeHistoryPanel
          history={preset.changeHistory}
          tabs={PRESET_HISTORY_TABS}
        />
      )}
    </div>
  );

  if (embedded) {
    return <>{formContent}</>;
  }

  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={onCancel}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <Plus className="size-3.5 shrink-0 text-sky-400/80" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-200">
            {preset ? "编辑预制" : "新建预制"}
          </div>
          <div className="text-[10px] text-zinc-500">
            {preset ? `${variants.length} 个变体` : "填写名称、变体与 LoRA"}
          </div>
        </div>
        <ChevronUp className="size-3.5 text-zinc-500" />
      </button>
      {formContent}
    </div>
  );
}
