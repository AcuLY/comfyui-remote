import {
  dedupeLoraBindingsByPath,
  joinPromptParts,
  sortBySortOrder,
} from "./order";
import { isOrdinaryPresetCategoryType } from "@/lib/actions/preset-resource-scope";
import type {
  LoraBinding,
  MissingReference,
  PresetVariantLinkRow,
  PresetVariantRow,
  ResolvePresetVariantContentInput,
  ResolvedPresetVariantContent,
} from "./types";

type PresetResolverDbClient = {
  presetVariant: {
    findUnique(args: unknown): Promise<PresetVariantRow | null>;
  };
  presetVariantLink: {
    findMany(args: unknown): Promise<PresetVariantLinkRow[]>;
  };
};

const emptyResolvedVariant = (missingReferences: MissingReference[] = []): ResolvedPresetVariantContent => ({
  prompt: "",
  negativePrompt: null,
  lora1: [],
  lora2: [],
  missingReferences,
});

function isOrdinaryPresetVariantRow(variant: PresetVariantRow) {
  const categoryType = variant.preset?.category?.type;
  return categoryType === undefined || categoryType === null || isOrdinaryPresetCategoryType(categoryType);
}

function isLoraBinding(value: unknown): value is LoraBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { path?: unknown }).path === "string" &&
    typeof (value as { weight?: unknown }).weight === "number" &&
    typeof (value as { enabled?: unknown }).enabled === "boolean"
  );
}

export function parseVariantLora(value: unknown): LoraBinding[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isLoraBinding)
    .map((entry) => ({
      path: entry.path,
      weight: Math.round(entry.weight * 100) / 100,
      enabled: entry.enabled,
    }));
}

export async function loadReachablePresetVariantGraph(
  variantIds: readonly string[],
  client: PresetResolverDbClient,
): Promise<ResolvePresetVariantContentInput> {
  const variantsById = new Map<string, PresetVariantRow>();
  const missingVariantIds = new Set<string>();
  const loadedLinkSourceIds = new Set<string>();
  const variantLinks: PresetVariantLinkRow[] = [];
  const queuedVariantIds = [...new Set(variantIds.filter(Boolean))];

  while (queuedVariantIds.length > 0) {
    const currentVariantId = queuedVariantIds.shift()!;
    if (missingVariantIds.has(currentVariantId)) continue;

    let variant = variantsById.get(currentVariantId) ?? null;
    if (!variant) {
      variant = await client.presetVariant.findUnique({
        where: { id: currentVariantId },
        select: {
          id: true,
          presetId: true,
          name: true,
          prompt: true,
          negativePrompt: true,
          lora1: true,
          lora2: true,
          sortOrder: true,
          isActive: true,
          preset: {
            select: {
              category: {
                select: { type: true },
              },
            },
          },
        },
      });

      if (!variant || !isOrdinaryPresetVariantRow(variant)) {
        missingVariantIds.add(currentVariantId);
        continue;
      }
      variantsById.set(currentVariantId, variant);
    }

    if (loadedLinkSourceIds.has(currentVariantId)) continue;
    loadedLinkSourceIds.add(currentVariantId);

    const relationLinks = await client.presetVariantLink.findMany({
      where: { sourceVariantId: currentVariantId },
      select: {
        sourceVariantId: true,
        linkedVariantId: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });
    variantLinks.push(...relationLinks);

    const linkedVariantIds = relationLinks.map((link) => link.linkedVariantId);

    for (const linkedVariantId of linkedVariantIds) {
      if (
        variantsById.has(linkedVariantId) ||
        missingVariantIds.has(linkedVariantId) ||
        queuedVariantIds.includes(linkedVariantId)
      ) {
        continue;
      }
      queuedVariantIds.push(linkedVariantId);
    }
  }

  return {
    variants: [...variantsById.values()],
    variantLinks,
  };
}

function buildVariantIndex(variants: readonly PresetVariantRow[]) {
  return new Map(variants.map((variant) => [variant.id, variant]));
}

function buildLinksBySource(links: readonly PresetVariantLinkRow[]) {
  const linksBySource = new Map<string, PresetVariantLinkRow[]>();

  for (const link of links) {
    const existing = linksBySource.get(link.sourceVariantId) ?? [];
    existing.push(link);
    linksBySource.set(link.sourceVariantId, existing);
  }

  for (const [sourceVariantId, sourceLinks] of linksBySource) {
    linksBySource.set(sourceVariantId, sortBySortOrder(sourceLinks));
  }

  return linksBySource;
}

function resolveLinkedVariantIds(
  variant: PresetVariantRow,
  linksBySource: Map<string, PresetVariantLinkRow[]>,
) {
  const relationRows = linksBySource.get(variant.id) ?? [];
  return relationRows.map((link) => link.linkedVariantId);
}

export function resolvePresetVariantContentFromRows(
  variantId: string,
  input: ResolvePresetVariantContentInput,
): ResolvedPresetVariantContent {
  const variantsById = buildVariantIndex(input.variants);
  const linksBySource = buildLinksBySource(input.variantLinks ?? []);

  const resolve = (currentVariantId: string, visited: Set<string>): ResolvedPresetVariantContent => {
    if (visited.has(currentVariantId)) return emptyResolvedVariant();
    visited.add(currentVariantId);

    const variant = variantsById.get(currentVariantId);
    if (!variant || variant.isActive === false) {
      return emptyResolvedVariant([{ kind: "presetVariant", id: currentVariantId }]);
    }

    const promptParts = [variant.prompt];
    const negativeParts = [variant.negativePrompt];
    const lora1 = parseVariantLora(variant.lora1);
    const lora2 = parseVariantLora(variant.lora2);
    const missingReferences: MissingReference[] = [];

    for (const linkedVariantId of resolveLinkedVariantIds(variant, linksBySource)) {
      const linked = resolve(linkedVariantId, visited);
      promptParts.push(linked.prompt);
      negativeParts.push(linked.negativePrompt);
      lora1.push(...linked.lora1);
      lora2.push(...linked.lora2);
      missingReferences.push(...linked.missingReferences);
    }

    const prompt = joinPromptParts(promptParts);
    const negativePrompt = joinPromptParts(negativeParts) || null;

    return {
      prompt,
      negativePrompt,
      lora1: dedupeLoraBindingsByPath(lora1),
      lora2: dedupeLoraBindingsByPath(lora2),
      missingReferences,
    };
  };

  return resolve(variantId, new Set());
}

export async function resolvePresetVariantContent(
  variantId: string,
  client?: PresetResolverDbClient,
) {
  const db = client ?? ((await import("@/lib/prisma")).prisma as PresetResolverDbClient);
  const { variants, variantLinks } = await loadReachablePresetVariantGraph([variantId], db);

  return resolvePresetVariantContentFromRows(variantId, { variants, variantLinks });
}
