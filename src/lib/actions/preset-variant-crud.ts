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

type LinkedVariantRef = {
  presetId: string | null;
  variantId: string;
  sortOrder: number;
};

function normalizeLinkedVariantRefs(linkedVariants: unknown): LinkedVariantRef[] {
  if (linkedVariants == null) return [];
  if (!Array.isArray(linkedVariants)) {
    throw new Error("linkedVariants must be an array");
  }

  const seen = new Set<string>();
  const refs: LinkedVariantRef[] = [];

  linkedVariants.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const record = entry as {
      presetId?: unknown;
      variantId?: unknown;
      linkedVariantId?: unknown;
      sortOrder?: unknown;
    };
    const variantId =
      typeof record.variantId === "string"
        ? record.variantId
        : typeof record.linkedVariantId === "string"
          ? record.linkedVariantId
          : null;
    if (!variantId || seen.has(variantId)) return;
    seen.add(variantId);

    refs.push({
      presetId: typeof record.presetId === "string" ? record.presetId : null,
      variantId,
      sortOrder: typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
        ? record.sortOrder
        : index,
    });
  });

  return refs;
}

function remapLinkedVariantRefs(
  refs: readonly LinkedVariantRef[],
  originalPresetId: string,
  newPresetId: string,
  variantIdMap: Map<string, string>,
) {
  return refs.map((ref) => {
    const remappedVariantId = variantIdMap.get(ref.variantId);
    if (ref.presetId === originalPresetId && remappedVariantId) {
      return {
        ...ref,
        presetId: newPresetId,
        variantId: remappedVariantId,
      };
    }

    return {
      ...ref,
      variantId: remappedVariantId ?? ref.variantId,
    };
  });
}

async function replaceVariantLinks(
  tx: Prisma.TransactionClient,
  sourceVariantId: string,
  linkedVariants: unknown,
) {
  const refs = normalizeLinkedVariantRefs(linkedVariants);

  await tx.presetVariantLink.deleteMany({ where: { sourceVariantId } });
  if (refs.length === 0) return refs;

  await tx.presetVariantLink.createMany({
    data: refs.map((ref) => ({
      sourceVariantId,
      linkedVariantId: ref.variantId,
      sortOrder: ref.sortOrder,
    })),
  });

  return refs;
}

async function readVariantLinkSnapshot(sourceVariantId: string, legacyLinkedVariants: unknown) {
  const relationLinks = await prisma.presetVariantLink.findMany({
    where: { sourceVariantId },
    select: {
      linkedVariantId: true,
      sortOrder: true,
      linkedVariant: {
        select: { presetId: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const linkedVariants = relationLinks.length > 0
    ? relationLinks.map((link) => ({
        presetId: link.linkedVariant.presetId,
        variantId: link.linkedVariantId,
      }))
    : normalizeLinkedVariantRefs(legacyLinkedVariants).map((link) => ({
        presetId: link.presetId,
        variantId: link.variantId,
      }));

  return { linkedVariants };
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
    linkedVariants: normalizeLinkedVariantRefs(variant.linkedVariants).map((link) => ({
      presetId: link.presetId,
      variantId: link.variantId,
    })),
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

function shouldRevalidateProjectPresetUsage(input: Partial<PresetVariantInput>) {
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
    const createdVariants: Array<{
      oldId: string;
      newId: string;
      linkedRefs: LinkedVariantRef[];
    }> = [];

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
        oldId: variant.id,
        newId: newVariant.id,
        linkedRefs: normalizeLinkedVariantRefs(variant.linkedVariants),
      });
    }

    const sourceLinks = await tx.presetVariantLink.findMany({
      where: { sourceVariantId: { in: source.variants.map((variant) => variant.id) } },
      select: { sourceVariantId: true, linkedVariantId: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });
    const linksBySourceVariantId = new Map<string, LinkedVariantRef[]>();
    for (const link of sourceLinks) {
      const existing = linksBySourceVariantId.get(link.sourceVariantId) ?? [];
      existing.push({
        presetId: null,
        variantId: link.linkedVariantId,
        sortOrder: link.sortOrder,
      });
      linksBySourceVariantId.set(link.sourceVariantId, existing);
    }

    for (const variant of createdVariants) {
      const sourceRefs = linksBySourceVariantId.get(variant.oldId) ?? variant.linkedRefs;
      const linkedRefs = remapLinkedVariantRefs(
        sourceRefs,
        source.id,
        newPreset.id,
        variantIdMap,
      );
      if (linkedRefs.length === 0) continue;
      await tx.presetVariantLink.createMany({
        data: linkedRefs.map((ref) => ({
          sourceVariantId: variant.newId,
          linkedVariantId: ref.variantId,
          sortOrder: ref.sortOrder,
        })),
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
  const variant = await prisma.$transaction(async (tx) => {
    const created = await tx.presetVariant.create({
      data: {
        ...rest,
        lora1: toJsonValue(lora1) ?? Prisma.DbNull,
        lora2: toJsonValue(lora2) ?? Prisma.DbNull,
        linkedVariants: Prisma.DbNull,
      },
    });
    await replaceVariantLinks(tx, created.id, linkedVariants);
    return created;
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

  const beforeLinked = await readVariantLinkSnapshot(existing.id, existing.linkedVariants);
  const { lora1, lora2, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest, isActive: true };
  delete data.presetId;
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (linkedVariants !== undefined) {
    data.linkedVariants = Prisma.DbNull;
  }

  const variant = await prisma.$transaction(async (tx) => {
    const updated = await tx.presetVariant.update({
      where: { id: existing.id },
      data,
    });
    if (linkedVariants !== undefined) {
      await replaceVariantLinks(tx, updated.id, linkedVariants);
    }
    return updated;
  });
  const afterLinked = await readVariantLinkSnapshot(variant.id, variant.linkedVariants);
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "variants",
    title: `更新关联变体：${variant.name}`,
    before: beforeLinked,
    after: afterLinked,
  });
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "content",
    title: `更新提示词与 LoRA：${variant.name}`,
    before: presetVariantContentSnapshot(existing),
    after: presetVariantContentSnapshot(variant),
  });
  if (shouldRevalidateProjectPresetUsage(input)) revalidatePath("/projects");
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
    revalidatePath("/projects");
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function updatePresetVariant(id: string, input: Partial<PresetVariantInput>) {
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const { lora1, lora2, linkedVariants, ...rest } = input;
  const beforeLinked = before
    ? await readVariantLinkSnapshot(before.id, before.linkedVariants)
    : presetVariantLinkedSnapshot({ linkedVariants: null });
  const data: Record<string, unknown> = { ...rest };
  delete data.presetId;
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (linkedVariants !== undefined) {
    data.linkedVariants = Prisma.DbNull;
  }

  const variant = await prisma.$transaction(async (tx) => {
    const updated = await tx.presetVariant.update({ where: { id }, data });
    if (linkedVariants !== undefined) {
      await replaceVariantLinks(tx, updated.id, linkedVariants);
    }
    return updated;
  });
  if (before) {
    const afterLinked = await readVariantLinkSnapshot(variant.id, variant.linkedVariants);
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "variants",
      title: `更新关联变体：${variant.name}`,
      before: beforeLinked,
      after: afterLinked,
    });
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "content",
      title: `更新提示词与 LoRA：${variant.name}`,
      before: presetVariantContentSnapshot(before),
      after: presetVariantContentSnapshot(variant),
    });
  }
  if (before && shouldRevalidateProjectPresetUsage(input)) revalidatePath("/projects");
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
    revalidatePath("/projects");
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
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
