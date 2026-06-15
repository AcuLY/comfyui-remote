"use server";

import { revalidatePath } from "next/cache";
import { ORDINARY_PRESET_CATEGORY_TYPE } from "@/lib/actions/preset-resource-scope";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolvedVariantContent = {
  prompt: string;
  negativePrompt: string | null;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
};

// ---------------------------------------------------------------------------
// Resolution and sync functions
// ---------------------------------------------------------------------------

export async function findPresetIdsAffectedByVariantChange(variantId: string, presetId: string) {
  const variants = await prisma.presetVariant.findMany({
    where: {
      preset: { category: { type: ORDINARY_PRESET_CATEGORY_TYPE } },
    },
    select: { id: true, presetId: true },
  });
  const relationLinks = await prisma.presetVariantLink.findMany({
    where: {
      sourceVariant: { preset: { category: { type: ORDINARY_PRESET_CATEGORY_TYPE } } },
      linkedVariant: { preset: { category: { type: ORDINARY_PRESET_CATEGORY_TYPE } } },
    },
    select: { sourceVariantId: true, linkedVariantId: true },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const parentVariantIdsByLinkedVariantId = new Map<string, string[]>();

  const addParentLink = (sourceVariantId: string, linkedVariantId: string) => {
    const parentVariantIds = parentVariantIdsByLinkedVariantId.get(linkedVariantId) ?? [];
    parentVariantIds.push(sourceVariantId);
    parentVariantIdsByLinkedVariantId.set(linkedVariantId, parentVariantIds);
  };

  for (const link of relationLinks) {
    addParentLink(link.sourceVariantId, link.linkedVariantId);
  }

  const affectedPresetIds = new Set<string>([presetId]);
  const seenVariantIds = new Set<string>([variantId]);
  const queue = [variantId];

  while (queue.length > 0) {
    const currentVariantId = queue.shift()!;
    for (const parentVariantId of parentVariantIdsByLinkedVariantId.get(currentVariantId) ?? []) {
      if (seenVariantIds.has(parentVariantId)) continue;
      seenVariantIds.add(parentVariantId);
      queue.push(parentVariantId);

      const parentVariant = variantById.get(parentVariantId);
      if (parentVariant) affectedPresetIds.add(parentVariant.presetId);
    }
  }

  return affectedPresetIds;
}

export async function syncVariantContentToImportedSections(variantId: string, presetId: string) {
  const presetIds = await findPresetIdsAffectedByVariantChange(variantId, presetId);
  revalidatePath("/projects");
  return [...presetIds];
}

export async function syncPresetMetadataToImportedSections(presetId: string) {
  revalidatePath("/projects");
  return [presetId];
}

// ---------------------------------------------------------------------------
// Variant content resolution (handles linkedVariants recursively)
// ---------------------------------------------------------------------------

/** Recursively resolve a variant's content including linked variants. */
export async function resolveVariantContent(
  variantId: string,
  visited = new Set<string>(),
): Promise<ResolvedVariantContent> {
  const empty: ResolvedVariantContent = { prompt: "", negativePrompt: null, lora1: [], lora2: [] };
  if (visited.has(variantId)) return empty;
  visited.add(variantId);

  const variant = await prisma.presetVariant.findFirst({
    where: {
      id: variantId,
      preset: { category: { type: ORDINARY_PRESET_CATEGORY_TYPE } },
    },
  });
  if (!variant || !variant.isActive) return empty;

  let prompt = variant.prompt;
  let negativePrompt = variant.negativePrompt;

  // Parse own LoRAs
  const parseLora = (json: unknown): Array<{ path: string; weight: number; enabled: boolean }> => {
    if (!json || !Array.isArray(json)) return [];
    return json.filter(
      (item): item is { path: string; weight: number; enabled: boolean } =>
        typeof item === "object" && item !== null &&
        typeof item.path === "string" &&
        typeof item.weight === "number" &&
        typeof item.enabled === "boolean",
    );
  };

  const lora1 = parseLora(variant.lora1);
  const lora2 = parseLora(variant.lora2);

  const relationLinks = await prisma.presetVariantLink.findMany({
    where: { sourceVariantId: variant.id },
    select: { linkedVariantId: true },
    orderBy: { sortOrder: "asc" },
  });
  const linkedVariantIds = relationLinks.map((link) => link.linkedVariantId);

  for (const linkedVariantId of linkedVariantIds) {
    const resolved = await resolveVariantContent(linkedVariantId, visited);
    if (resolved.prompt) prompt += ", " + resolved.prompt;
    if (resolved.negativePrompt) {
      negativePrompt = negativePrompt
        ? negativePrompt + ", " + resolved.negativePrompt
        : resolved.negativePrompt;
    }
    for (const l of resolved.lora1) {
      if (!lora1.some((e) => e.path === l.path)) lora1.push(l);
    }
    for (const l of resolved.lora2) {
      if (!lora2.some((e) => e.path === l.path)) lora2.push(l);
    }
  }

  return { prompt, negativePrompt, lora1, lora2 };
}
