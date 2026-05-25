"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { parseSectionLoraConfig, serializeSectionLoraConfig } from "@/lib/lora-types";
import { recordSectionChange } from "@/server/services/section-change-history-service";

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
// Internal helpers
// ---------------------------------------------------------------------------

function getLinkedVariantIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const variantId = (entry as { variantId?: unknown }).variantId;
      return typeof variantId === "string" && variantId ? variantId : null;
    })
    .filter((variantId): variantId is string => Boolean(variantId));
}

// ---------------------------------------------------------------------------
// Resolution and sync functions
// ---------------------------------------------------------------------------

export async function findPresetIdsAffectedByVariantChange(variantId: string, presetId: string) {
  const variants = await prisma.presetVariant.findMany({
    select: { id: true, presetId: true, linkedVariants: true },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const parentVariantIdsByLinkedVariantId = new Map<string, string[]>();

  for (const variant of variants) {
    for (const linkedVariantId of getLinkedVariantIds(variant.linkedVariants)) {
      const parentVariantIds = parentVariantIdsByLinkedVariantId.get(linkedVariantId) ?? [];
      parentVariantIds.push(variant.id);
      parentVariantIdsByLinkedVariantId.set(linkedVariantId, parentVariantIds);
    }
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
  const { syncPresetToSections } = await import("./preset-sync");

  for (const affectedPresetId of presetIds) {
    await syncPresetToSections(affectedPresetId);
  }
}

export async function syncPresetMetadataToImportedSections(presetId: string) {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset) return;

  const defaultVariant = preset.variants[0] ?? null;
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      projectSectionId: true,
      variantId: true,
      categoryId: true,
      bindingId: true,
      groupBindingId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  if (blocks.length === 0) return;

  const bindingIdsBySection = new Map<string, Set<string>>();

  for (const block of blocks) {
    const variant = block.variantId
      ? (preset.variants.find((item) => item.id === block.variantId) ?? defaultVariant)
      : defaultVariant;
    const nextLabel = preset.variants.length <= 1 || !variant
      ? preset.name
      : `${preset.name} / ${variant.name}`;

    if (block.bindingId) {
      const sectionBindingIds = bindingIdsBySection.get(block.projectSectionId) ?? new Set<string>();
      sectionBindingIds.add(block.bindingId);
      bindingIdsBySection.set(block.projectSectionId, sectionBindingIds);
    }

    if (block.label === nextLabel && block.categoryId === preset.categoryId) continue;

    const before = {
      id: block.id,
      label: block.label,
      categoryId: block.categoryId,
      bindingId: block.bindingId,
      groupBindingId: block.groupBindingId,
      sortOrder: block.sortOrder,
    };
    const updatedBlock = await prisma.promptBlock.update({
      where: { id: block.id },
      data: { label: nextLabel, categoryId: preset.categoryId },
      select: {
        id: true,
        label: true,
        categoryId: true,
        bindingId: true,
        groupBindingId: true,
        sortOrder: true,
      },
    });
    await recordSectionChange({
      sectionId: block.projectSectionId,
      dimension: "prompt",
      title: `Sync preset metadata: ${nextLabel}`,
      before,
      after: updatedBlock,
    });
  }

  for (const [sectionId, bindingIds] of bindingIdsBySection) {
    const section = await prisma.projectSection.findUnique({
      where: { id: sectionId },
      select: { loraConfig: true },
    });
    if (!section?.loraConfig) continue;

    const before = section.loraConfig;
    const config = parseSectionLoraConfig(section.loraConfig);
    let changed = false;
    const updateEntry = <T extends { bindingId?: string; source?: string; sourceName?: string; sourceLabel?: string; sourceColor?: string }>(entry: T) => {
      if (entry.source !== "preset" || !entry.bindingId || !bindingIds.has(entry.bindingId)) return entry;
      if (
        entry.sourceName === preset.name &&
        entry.sourceLabel === preset.category.name &&
        entry.sourceColor === (preset.category.color ?? undefined)
      ) {
        return entry;
      }
      changed = true;
      return {
        ...entry,
        sourceName: preset.name,
        sourceLabel: preset.category.name,
        sourceColor: preset.category.color ?? undefined,
      };
    };

    config.lora1 = config.lora1.map(updateEntry);
    config.lora2 = config.lora2.map(updateEntry);

    if (!changed) continue;

    const nextConfig = serializeSectionLoraConfig(config);
    await prisma.projectSection.update({
      where: { id: sectionId },
      data: { loraConfig: nextConfig as Prisma.InputJsonValue },
    });
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: `Sync preset metadata: ${preset.name}`,
      before,
      after: nextConfig,
    });
  }
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

  const variant = await prisma.presetVariant.findUnique({ where: { id: variantId } });
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

  // Resolve linked variants
  const linked = Array.isArray(variant.linkedVariants)
    ? (variant.linkedVariants as Array<{ presetId: string; variantId: string }>)
    : [];

  for (const ref of linked) {
    const resolved = await resolveVariantContent(ref.variantId, visited);
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
