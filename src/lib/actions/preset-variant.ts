"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { parseSectionLoraConfig, serializeSectionLoraConfig } from "@/lib/lora-types";
import { recordPresetChange } from "@/server/services/preset-change-history-service";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { toJsonValue } from "./_helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetInput = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  notes?: string | null;
  civitaiLinks?: string[] | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type PresetVariantInput = {
  presetId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  lora1?: unknown;
  lora2?: unknown;
  linkedVariants?: unknown;
  isActive?: boolean;
  sortOrder?: number;
};

export type ResolvedVariantContent = {
  prompt: string;
  negativePrompt: string | null;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeCivitaiLinks(value: unknown) {
  if (value == null) return null;
  if (!Array.isArray(value)) {
    throw new Error("civitaiLinks must be an array");
  }

  const links = [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];

  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new Error(`Invalid Civitai URL: ${link}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Invalid Civitai URL protocol: ${link}`);
    }
  }

  return links.length > 0 ? links : null;
}

function presetData(input: PresetInput | Partial<PresetInput>) {
  const { civitaiLinks, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (civitaiLinks !== undefined) {
    data.civitaiLinks = normalizeCivitaiLinks(civitaiLinks) ?? Prisma.DbNull;
  }
  return data;
}

function cloneJsonField(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value == null) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function remapLinkedVariants(
  linkedVariants: unknown,
  originalPresetId: string,
  newPresetId: string,
  variantIdMap: Map<string, string>,
) {
  const cloned = linkedVariants == null
    ? null
    : JSON.parse(JSON.stringify(linkedVariants));

  if (!Array.isArray(cloned)) return cloned;

  return cloned.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;

    const ref = entry as { presetId?: unknown; variantId?: unknown };
    if (
      ref.presetId === originalPresetId &&
      typeof ref.variantId === "string" &&
      variantIdMap.has(ref.variantId)
    ) {
      return {
        ...entry,
        presetId: newPresetId,
        variantId: variantIdMap.get(ref.variantId)!,
      };
    }

    return entry;
  });
}

function presetVariantRosterSnapshot(variant: {
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    name: variant.name,
    slug: variant.slug,
    sortOrder: variant.sortOrder,
    isActive: variant.isActive,
  };
}

function presetVariantLinkedSnapshot(variant: {
  linkedVariants: unknown;
}) {
  return {
    linkedVariants: variant.linkedVariants,
  };
}

function presetVariantContentSnapshot(variant: {
  name: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
}) {
  return {
    name: variant.name,
    prompt: variant.prompt,
    negativePrompt: variant.negativePrompt,
    lora1: variant.lora1,
    lora2: variant.lora2,
  };
}

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

function shouldSyncVariantContent(input: Partial<PresetVariantInput>) {
  return (
    input.name !== undefined ||
    input.prompt !== undefined ||
    input.negativePrompt !== undefined ||
    input.lora1 !== undefined ||
    input.lora2 !== undefined ||
    input.linkedVariants !== undefined ||
    input.isActive !== undefined ||
    input.sortOrder !== undefined
  );
}

async function findPresetIdsAffectedByVariantChange(variantId: string, presetId: string) {
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

async function syncVariantContentToImportedSections(variantId: string, presetId: string) {
  const presetIds = await findPresetIdsAffectedByVariantChange(variantId, presetId);
  const { syncPresetToSections } = await import("./preset-sync");

  for (const affectedPresetId of presetIds) {
    await syncPresetToSections(affectedPresetId);
  }
}

async function syncPresetMetadataToImportedSections(presetId: string) {
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
// Preset CRUD
// ---------------------------------------------------------------------------

export async function createPreset(input: PresetInput) {
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.preset.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  // Check for soft-deleted preset with same slug in same category
  const existing = await prisma.preset.findUnique({
    where: {
      categoryId_slug: { categoryId: input.categoryId, slug: input.slug },
    },
  });

  let preset;
  if (existing && !existing.isActive) {
    // Reactivate and update the soft-deleted record, clearing old variants
    await prisma.presetVariant.deleteMany({ where: { presetId: existing.id } });
    preset = await prisma.preset.update({
      where: { id: existing.id },
      data: { ...presetData(input), isActive: true },
    });
  } else {
    preset = await prisma.preset.create({ data: presetData(input) as Prisma.PresetCreateInput });
  }

  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function copyPreset(presetId: string) {
  const source = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!source || !source.isActive) {
    throw new Error("Preset not found");
  }

  let copyIdentity: { name: string; slug: string } | null = null;
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const copySuffix = attempt === 1 ? "Copy" : `Copy ${attempt}`;
    const slugSuffix = attempt === 1 ? "copy" : `copy-${attempt}`;
    const candidateSlug = `${source.slug}-${slugSuffix}`;
    const existing = await prisma.preset.findUnique({
      where: {
        categoryId_slug: {
          categoryId: source.categoryId,
          slug: candidateSlug,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      copyIdentity = { name: `${source.name} ${copySuffix}`, slug: candidateSlug };
      break;
    }
  }

  if (!copyIdentity) {
    throw new Error("Unable to generate a unique preset copy slug");
  }

  const maxOrder = await prisma.preset.aggregate({
    where: { categoryId: source.categoryId },
    _max: { sortOrder: true },
  });

  const copied = await prisma.$transaction(async (tx) => {
    const newPreset = await tx.preset.create({
      data: {
        categoryId: source.categoryId,
        folderId: source.folderId,
        name: copyIdentity.name,
        slug: copyIdentity.slug,
        notes: source.notes,
        civitaiLinks: cloneJsonField(source.civitaiLinks),
        isActive: true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        folderId: true,
      },
    });

    const variantIdMap = new Map<string, string>();
    const createdVariants: Array<{ newId: string; linkedVariants: unknown }> = [];

    for (const variant of source.variants) {
      const newVariant = await tx.presetVariant.create({
        data: {
          presetId: newPreset.id,
          name: variant.name,
          slug: variant.slug,
          prompt: variant.prompt,
          negativePrompt: variant.negativePrompt,
          lora1: cloneJsonField(variant.lora1),
          lora2: cloneJsonField(variant.lora2),
          linkedVariants: Prisma.DbNull,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        },
        select: { id: true },
      });
      variantIdMap.set(variant.id, newVariant.id);
      createdVariants.push({
        newId: newVariant.id,
        linkedVariants: variant.linkedVariants,
      });
    }

    for (const variant of createdVariants) {
      const linkedVariants = remapLinkedVariants(
        variant.linkedVariants,
        source.id,
        newPreset.id,
        variantIdMap,
      );
      await tx.presetVariant.update({
        where: { id: variant.newId },
        data: { linkedVariants: cloneJsonField(linkedVariants) },
      });
    }

    return newPreset;
  });

  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return copied;
}

export async function createPresetVariant(input: PresetVariantInput) {
  const { lora1, lora2, linkedVariants, ...rest } = input;
  if (rest.sortOrder === undefined) {
    const maxOrder = await prisma.presetVariant.aggregate({
      where: { presetId: input.presetId },
      _max: { sortOrder: true },
    });
    rest.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  const variant = await prisma.presetVariant.create({
    data: {
      ...rest,
      lora1: toJsonValue(lora1) ?? Prisma.DbNull,
      lora2: toJsonValue(lora2) ?? Prisma.DbNull,
      linkedVariants: (Array.isArray(linkedVariants) && linkedVariants.length > 0)
        ? (toJsonValue(linkedVariants) ?? Prisma.DbNull)
        : Prisma.DbNull,
    },
  });
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "variants",
    title: `创建变体：${variant.name}`,
    before: null,
    after: presetVariantRosterSnapshot(variant),
  });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function upsertPresetVariantBySlug(input: PresetVariantInput) {
  const existing = await prisma.presetVariant.findUnique({
    where: {
      presetId_slug: {
        presetId: input.presetId,
        slug: input.slug,
      },
    },
  });

  if (!existing) {
    return createPresetVariant(input);
  }

  const { lora1, lora2, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest, isActive: true };
  delete data.presetId;
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (linkedVariants !== undefined) {
    data.linkedVariants = Array.isArray(linkedVariants) && linkedVariants.length === 0
      ? Prisma.DbNull
      : toJsonValue(linkedVariants) ?? Prisma.DbNull;
  }

  const variant = await prisma.presetVariant.update({
    where: { id: existing.id },
    data,
  });
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "variants",
    title: `更新关联变体：${variant.name}`,
    before: presetVariantLinkedSnapshot(existing),
    after: presetVariantLinkedSnapshot(variant),
  });
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "content",
    title: `更新提示词与 LoRA：${variant.name}`,
    before: presetVariantContentSnapshot(existing),
    after: presetVariantContentSnapshot(variant),
  });
  if (shouldSyncVariantContent(input)) {
    await syncVariantContentToImportedSections(variant.id, variant.presetId);
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function updatePreset(id: string, input: Partial<PresetInput>) {
  const preset = await prisma.preset.update({ where: { id }, data: presetData(input) });
  if (
    input.name !== undefined ||
    input.slug !== undefined ||
    input.categoryId !== undefined
  ) {
    await syncPresetMetadataToImportedSections(id);
    revalidatePath("/projects");
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function updatePresetVariant(id: string, input: Partial<PresetVariantInput>) {
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const { lora1, lora2, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  delete data.presetId;
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (linkedVariants !== undefined) {
    // Empty array → store as DbNull; non-empty → store as JSON array
    if (Array.isArray(linkedVariants) && linkedVariants.length === 0) {
      data.linkedVariants = Prisma.DbNull;
    } else {
      data.linkedVariants = toJsonValue(linkedVariants) ?? Prisma.DbNull;
    }
  }

  const variant = await prisma.presetVariant.update({ where: { id }, data });
  if (before) {
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "variants",
      title: `更新关联变体：${variant.name}`,
      before: presetVariantLinkedSnapshot(before),
      after: presetVariantLinkedSnapshot(variant),
    });
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "content",
      title: `更新提示词与 LoRA：${variant.name}`,
      before: presetVariantContentSnapshot(before),
      after: presetVariantContentSnapshot(variant),
    });
  }
  if (before && shouldSyncVariantContent(input)) {
    await syncVariantContentToImportedSections(variant.id, variant.presetId);
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function deletePreset(id: string) {
  // Soft delete: set isActive = false
  await prisma.preset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
}

export async function deletePresetVariant(id: string) {
  // Soft delete: set isActive = false
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const variant = await prisma.presetVariant.update({ where: { id }, data: { isActive: false } });
  if (before) {
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "variants",
      title: `删除变体：${variant.name}`,
      before: presetVariantRosterSnapshot(before),
      after: presetVariantRosterSnapshot(variant),
    });
    await syncVariantContentToImportedSections(variant.id, variant.presetId);
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
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

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

export async function reorderPresets(categoryId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.preset.update({ where: { id, categoryId }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function reorderPresetVariants(presetId: string, ids: string[]) {
  const before = await prisma.presetVariant.findMany({
    where: { presetId, id: { in: ids } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetVariant.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const after = await prisma.presetVariant.findMany({
    where: { presetId, id: { in: ids } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  await recordPresetChange({
    presetId,
    dimension: "variants",
    title: "调整变体顺序",
    before,
    after,
  });
  revalidatePath("/assets/presets");
}
