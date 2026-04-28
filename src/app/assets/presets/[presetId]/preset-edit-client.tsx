"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import type { PresetCategoryFull, PresetFull } from "@/lib/server-data";
import {
  createPresetVariant,
  syncPresetToSections,
  updatePreset,
  updatePresetVariant,
} from "@/lib/actions";
import { serializeLoraBindings } from "@/lib/lora-types";
import { PresetForm, type VariantDraft } from "../preset-form";
import { toast } from "sonner";

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
  const [isPending, startTransition] = useTransition();
  const backHref = listUrl(category, preset);

  function savePreset(
    data: {
      categoryId: string;
      folderId?: string | null;
      name: string;
      slug: string;
      notes?: string | null;
      isActive?: boolean;
    },
    variantDrafts: VariantDraft[],
  ) {
    startTransition(async () => {
      try {
        await updatePreset(preset.id, data);
        for (const draft of variantDrafts) {
          const variantData = {
            presetId: preset.id,
            name: draft.name.trim(),
            slug: draft.slug.trim(),
            prompt: draft.prompt.trim(),
            negativePrompt: draft.negativePrompt.trim() || null,
            lora1: serializeLoraBindings(draft.lora1),
            lora2: serializeLoraBindings(draft.lora2),
            linkedVariants: draft.linkedVariants,
          };
          if (draft.id) {
            await updatePresetVariant(draft.id, variantData);
          } else {
            await createPresetVariant(variantData);
          }
        }
        await syncPresetToSections(preset.id);
        toast.success("预制已保存");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => router.push(backHref)} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
        <ArrowLeft className="size-3.5" /> 返回预制列表
      </button>
      <SectionCard title={preset.name} subtitle={`${category.name} / ${preset.slug}`}>
        <PresetForm
          categoryId={category.id}
          folderId={preset.folderId}
          preset={preset}
          allCategories={categories}
          onSave={savePreset}
          onCancel={() => router.push(backHref)}
          isPending={isPending}
        />
      </SectionCard>
    </div>
  );
}
