"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import type { PresetCategoryFull, PresetFull } from "@/lib/server-data";
import {
  updatePreset,
  updatePresetVariant,
  upsertPresetVariantBySlug,
} from "@/lib/actions/preset-variant-crud";
import { parseLoraBindings, serializeLoraBindings } from "@/lib/lora-types";
import { PresetForm, type VariantDraft } from "../preset-form";
import { toast } from "sonner";

type PresetSaveData = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  notes?: string | null;
  civitaiLinks?: string[] | null;
  isActive?: boolean;
};

type VariantSaveData = {
  presetId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: ReturnType<typeof serializeLoraBindings>;
  lora2: ReturnType<typeof serializeLoraBindings>;
  linkedVariants: VariantDraft["linkedVariants"];
};

type VariantPatchData = Partial<Omit<VariantSaveData, "presetId">>;

type SavedSnapshot = {
  preset: PresetSaveData;
  variants: Map<string, VariantSaveData>;
};

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function variantDataFromDraft(presetId: string, draft: VariantDraft): VariantSaveData {
  return {
    presetId,
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    prompt: draft.prompt.trim(),
    negativePrompt: draft.negativePrompt.trim() || null,
    lora1: serializeLoraBindings(draft.lora1),
    lora2: serializeLoraBindings(draft.lora2),
    linkedVariants: draft.linkedVariants,
  };
}

function createSavedSnapshot(preset: PresetFull): SavedSnapshot {
  return {
    preset: {
      categoryId: preset.categoryId,
      folderId: preset.folderId,
      name: preset.name,
      slug: preset.slug,
      notes: preset.notes,
      civitaiLinks: preset.civitaiLinks,
      isActive: preset.isActive,
    },
    variants: new Map(
      preset.variants.map((variant) => [
        variant.id,
        {
          presetId: preset.id,
          name: variant.name,
          slug: variant.slug,
          prompt: variant.prompt,
          negativePrompt: variant.negativePrompt,
          lora1: serializeLoraBindings(parseLoraBindings(variant.lora1)),
          lora2: serializeLoraBindings(parseLoraBindings(variant.lora2)),
          linkedVariants: variant.linkedVariants,
        },
      ]),
    ),
  };
}

function cloneSavedSnapshot(snapshot: SavedSnapshot): SavedSnapshot {
  return {
    preset: { ...snapshot.preset, civitaiLinks: [...(snapshot.preset.civitaiLinks ?? [])] },
    variants: new Map(snapshot.variants),
  };
}

function presetChanged(before: PresetSaveData, after: PresetSaveData) {
  return (
    before.categoryId !== after.categoryId ||
    before.folderId !== after.folderId ||
    before.name !== after.name ||
    before.slug !== after.slug ||
    before.notes !== after.notes ||
    before.isActive !== after.isActive ||
    stableJson(before.civitaiLinks) !== stableJson(after.civitaiLinks)
  );
}

function variantChanged(before: VariantSaveData, after: VariantSaveData) {
  return (
    before.presetId !== after.presetId ||
    before.name !== after.name ||
    before.slug !== after.slug ||
    before.prompt !== after.prompt ||
    before.negativePrompt !== after.negativePrompt ||
    stableJson(before.lora1) !== stableJson(after.lora1) ||
    stableJson(before.lora2) !== stableJson(after.lora2) ||
    stableJson(before.linkedVariants) !== stableJson(after.linkedVariants)
  );
}

function variantPatchFromChange(before: VariantSaveData, after: VariantSaveData) {
  const patch: VariantPatchData = {};
  if (before.name !== after.name) patch.name = after.name;
  if (before.slug !== after.slug) patch.slug = after.slug;
  if (before.prompt !== after.prompt) patch.prompt = after.prompt;
  if (before.negativePrompt !== after.negativePrompt) patch.negativePrompt = after.negativePrompt;
  if (stableJson(before.lora1) !== stableJson(after.lora1)) patch.lora1 = after.lora1;
  if (stableJson(before.lora2) !== stableJson(after.lora2)) patch.lora2 = after.lora2;
  if (stableJson(before.linkedVariants) !== stableJson(after.linkedVariants)) {
    patch.linkedVariants = after.linkedVariants;
  }
  return patch;
}

function findSavedVariant(snapshot: SavedSnapshot, draft: VariantDraft, data: VariantSaveData) {
  if (draft.id) {
    return { id: draft.id, data: snapshot.variants.get(draft.id) };
  }

  for (const [id, saved] of snapshot.variants) {
    if (saved.slug === data.slug) {
      return { id, data: saved };
    }
  }

  return { id: null, data: undefined };
}

function listUrl(category: PresetCategoryFull, preset: PresetFull) {
  const params = new URLSearchParams({
    category: category.id,
    preset: preset.id,
  });

  if (preset.folderId) {
    params.set("folder", preset.folderId);
  }

  const firstVariant = preset.variants[0]?.id;
  if (firstVariant) {
    params.set("variant", firstVariant);
  }

  return `/assets/presets?${params.toString()}`;
}

export function PresetEditClient({
  categories,
  category,
  preset,
  previousPreset,
  nextPreset,
  presetPosition,
  totalPresets,
}: {
  categories: PresetCategoryFull[];
  category: PresetCategoryFull;
  preset: PresetFull;
  previousPreset: PresetFull | null;
  nextPreset: PresetFull | null;
  presetPosition: number;
  totalPresets: number;
}) {
  const router = useRouter();
  const [isPending, startRefreshTransition] = useTransition();
  const savedSnapshotRef = useRef(createSavedSnapshot(preset));
  const backHref = listUrl(category, preset);
  const previousPresetHref = previousPreset?.id ? `/assets/presets/${previousPreset.id}` : null;
  const nextPresetHref = nextPreset?.id ? `/assets/presets/${nextPreset.id}` : null;
  const presetPositionText = presetPosition >= 0 ? `${presetPosition + 1} / ${totalPresets}` : null;

  useEffect(() => {
    savedSnapshotRef.current = createSavedSnapshot(preset);
  }, [preset]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          return;
        }
      }

      const href = event.key.toLowerCase() === "s"
        ? previousPresetHref
        : event.key.toLowerCase() === "f"
          ? nextPresetHref
          : null;

      if (!href) {
        return;
      }

      event.preventDefault();
      router.push(href);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPresetHref, previousPresetHref, router]);

  async function savePreset(
    data: PresetSaveData,
    variantDrafts: VariantDraft[],
  ): Promise<void> {
    try {
      const nextSnapshot = cloneSavedSnapshot(savedSnapshotRef.current);
      let didMutate = false;

      if (presetChanged(nextSnapshot.preset, data)) {
        await updatePreset(preset.id, data);
        nextSnapshot.preset = { ...data, civitaiLinks: [...(data.civitaiLinks ?? [])] };
        savedSnapshotRef.current = nextSnapshot;
        didMutate = true;
      }

      for (const draft of variantDrafts) {
        const variantData = variantDataFromDraft(preset.id, draft);
        const savedVariant = findSavedVariant(nextSnapshot, draft, variantData);

        if (savedVariant.id && savedVariant.data) {
          if (!variantChanged(savedVariant.data, variantData)) {
            continue;
          }

          const variantPatch = variantPatchFromChange(savedVariant.data, variantData);
          await updatePresetVariant(savedVariant.id, variantPatch);
          nextSnapshot.variants.set(savedVariant.id, variantData);
        } else {
          const variant = await upsertPresetVariantBySlug(variantData);
          nextSnapshot.variants.set(variant.id, variantData);
        }
        savedSnapshotRef.current = nextSnapshot;
        didMutate = true;
      }

      if (didMutate) {
        startRefreshTransition(() => router.refresh());
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
      throw error;
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => router.push(backHref)} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
          <ArrowLeft className="size-3.5" /> 返回预制列表
        </button>
        <NeighborNavigation
          previousHref={previousPresetHref}
          nextHref={nextPresetHref}
          previousTitle={previousPreset?.name}
          nextTitle={nextPreset?.name}
          positionText={presetPositionText}
          className="justify-end"
        />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-white">{preset.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">{category.name} / {preset.variants.length} 个变体</p>
      </div>
      <PresetForm
        categoryId={category.id}
        folderId={preset.folderId}
        preset={preset}
        allCategories={categories}
        onSave={savePreset}
        onCancel={() => router.push(backHref)}
        isPending={isPending}
        embedded
      />
    </div>
  );
}
