"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Plus,
  X,
  ExternalLink,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PresetCategoryFull,
  PresetFull,
} from "@/lib/server-data";
import {
  deletePresetVariant,
  reorderPresetVariants,
} from "@/lib/actions/preset-variant-crud";
import { parseLoraBindings } from "@/lib/lora-types";
import type { VariantDraft } from "./preset-types";
import { toSlug } from "./group-utils";
import { usePresetSaveQueue } from "./use-preset-save-queue";
import { PresetVariantList } from "./preset-variant-list";
import { PresetVariantEditor } from "./preset-variant-editor";
import { PresetFormActionFooter } from "./preset-form-action-footer";
import {
  applyLoraToPresetVariants,
  applyPromptToPresetVariants,
  cloneLinkedVariants,
  cloneLoraBindings,
  hasIncompletePresetVariantLoraDraft,
} from "./preset-variant-bulk-apply";

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
// PresetForm — create/edit form for a preset with inline variant editing
// ---------------------------------------------------------------------------

export type { VariantDraft } from "./preset-types";

let variantDraftCounter = 0;
function nextVariantDraftClientId() {
  variantDraftCounter += 1;
  return `variant-draft-${variantDraftCounter}-${Math.random().toString(36).slice(2, 7)}`;
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
  const {
    saveStatus,
    saveError,
    requestSave,
    retryFailedSave,
  } = usePresetSaveQueue<SavePayload>({
    initialStatus: preset ? "saved" : "idle",
    onSave: async (payload) => {
      await onSave(payload.data, payload.variantDrafts);
    },
  });

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

    if (!hasIncompletePresetVariantLoraDraft(updated)) {
      saveDrafts(updated);
    }
  }

  function applyPromptToAllVariants(key: "prompt" | "negativePrompt") {
    const updated = applyPromptToPresetVariants(variants, current, key);
    setVariants(updated);
    saveDrafts(updated);
  }

  function applyBulkTextVariants(updated: VariantDraft[]) {
    setVariants(updated);
    saveDrafts(updated);
  }

  function applyLoraToAllVariants(key: "lora1" | "lora2", entry: VariantDraft["lora1"][number]) {
    const updated = applyLoraToPresetVariants(variants, key, entry);
    if (!updated) return;

    setVariants(updated);
    if (!hasIncompletePresetVariantLoraDraft(updated)) {
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

  function handleVariantReorder(reordered: VariantDraft[], oldIdx: number, newIdx: number) {
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
  const isSaveBusy = saveStatus === "saving" || saveStatus === "queued" || isPending;
  const showSaveStatus = preset || saveStatus !== "idle";

  const formContent = (
    <div className="min-w-0 space-y-3 border-t border-white/5 px-3 py-3">
      {showSaveStatus && (
        <PresetFormActionFooter
          saveStatus={saveStatus}
          saveError={saveError}
          onRetry={retryFailedSave}
        />
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
          className="cm-text-editor cm-text-editor--compact w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
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
        <PresetVariantList
          variants={variants}
          currentIndex={currentIdx}
          canRemove={totalVariants > 1}
          onSelect={selectVariant}
          onAdd={addVariant}
          onRemove={removeCurrentVariant}
          onReorder={handleVariantReorder}
        />

        <PresetVariantEditor
          current={current}
          currentVariantKey={currentVariantKey}
          variants={variants}
          preset={preset}
          allCategories={allCategories}
          onVariantNameChange={handleVariantNameChange}
          onLinkedVariantsChange={(lv) => updateVariant(current.clientId, { linkedVariants: cloneLinkedVariants(lv) }, { autoSave: true })}
          onPromptChange={(value) => updateVariant(current.clientId, { prompt: value })}
          onNegativePromptChange={(value) => updateVariant(current.clientId, { negativePrompt: value })}
          onLoraChange={(key, value) => updateVariantLoras(current.clientId, key, value)}
          onAutoSave={handleAutoSave}
          onApplyPromptToAllVariants={applyPromptToAllVariants}
          onApplyBulkTextVariants={applyBulkTextVariants}
          onApplyLoraToAllVariants={applyLoraToAllVariants}
        />
      </div>
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
