"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordPresetChange } from "@/server/services/preset-change-history-service";
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
  defaultParams?: unknown;
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
      data: { ...input, isActive: true },
    });
  } else {
    preset = await prisma.preset.create({ data: input });
  }

  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function createPresetVariant(input: PresetVariantInput) {
  const { lora1, lora2, defaultParams, linkedVariants, ...rest } = input;
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
      defaultParams: toJsonValue(defaultParams) ?? Prisma.DbNull,
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

  const { presetId: _pid, lora1, lora2, defaultParams, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest, isActive: true };
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (defaultParams !== undefined) data.defaultParams = toJsonValue(defaultParams) ?? Prisma.DbNull;
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
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function updatePreset(id: string, input: Partial<PresetInput>) {
  const preset = await prisma.preset.update({ where: { id }, data: input });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function updatePresetVariant(id: string, input: Partial<PresetVariantInput>) {
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const { presetId: _pid, lora1, lora2, defaultParams, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (defaultParams !== undefined) data.defaultParams = toJsonValue(defaultParams) ?? Prisma.DbNull;
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
      prisma.preset.update({ where: { id }, data: { sortOrder: index } }),
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
