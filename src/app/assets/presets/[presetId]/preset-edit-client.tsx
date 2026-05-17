"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import type { PresetCategoryFull, PresetFull } from "@/lib/server-data";
import {
  updatePreset,
  updatePresetVariant,
  upsertPresetVariantBySlug,
} from "@/lib/actions";
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
}: {
  categories: PresetCategoryFull[];
  category: PresetCategoryFull;
  preset: PresetFull;
}) {
  const router = useRouter();
  const [isPending, startRefreshTransition] = useTransition();
  const savedSnapshotRef = useRef(createSavedSnapshot(preset));
  const backHref = listUrl(category, preset);

  useEffect(() => {
    savedSnapshotRef.current = createSavedSnapshot(preset);
  }, [preset]);

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
        if (savedVariant.data && !variantChanged(savedVariant.data, variantData)) {
          continue;
        }

        if (savedVariant.id && savedVariant.data) {
          await updatePresetVariant(savedVariant.id, variantData);
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
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => router.push(backHref)} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回预制列表
      </button>
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
