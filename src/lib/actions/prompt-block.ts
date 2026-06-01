"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  parseSectionLoraConfig,
  removeLoraEntriesByBinding,
  serializeSectionLoraConfig,
  type LoraEntry,
} from "@/lib/lora-types";
import { getDetachedPresetPaths } from "@/lib/preset-binding-utils";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import { detachSectionLorasFromPresetBinding } from "@/server/services/preset-binding-service";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { resolveVariantContent } from "./preset-variant";
import {
  createBindingId,
  createLoraEntryId,
  sortSectionLoraEntriesByCategoryOrder,
} from "./_helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptBlockData = {
  id: string;
  type: string;
  sourceId: string | null;
  variantId: string | null;
  categoryId: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export type ImportPresetResult = {
  block: PromptBlockData;
  lora1: LoraEntry[];
  lora2: LoraEntry[];
  categoryOrders: { positivePromptOrder: number; lora1Order: number; lora2Order: number };
};

async function getCategoryOrderByName() {
  const categories = await prisma.presetCategory.findMany({
    select: { name: true, lora1Order: true, lora2Order: true },
  });
  return new Map(categories.map((category) => [category.name, category]));
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}

function buildPresetBlockLabel(
  preset: { name: string; variants: Array<{ id: string; name: string }> },
  variant: { id: string; name: string },
) {
  return preset.variants.length === 1
    ? preset.name
    : `${preset.name} / ${variant.name}`;
}

function makeResolvedOnlyBlockId(bindingKey: string, index = 0) {
  return `resolved:${bindingKey}:${index}`;
}

function parseResolvedOnlyBlockId(blockId: string) {
  if (!blockId.startsWith("resolved:")) return null;
  const rest = blockId.slice("resolved:".length);
  const indexSeparator = rest.lastIndexOf(":");
  return indexSeparator >= 0 ? rest.slice(0, indexSeparator) : rest;
}

function makePresetLoraEntries(
  input: {
    bindingKey: string;
    groupBindingKey: string | null;
    category: { name: string; color: string | null };
    preset: { name: string };
    resolved: Awaited<ReturnType<typeof resolveVariantContent>>;
  },
) {
  const makeLora = (
    stage: "lora1" | "lora2",
    index: number,
    entry: { path: string; weight: number; enabled: boolean },
  ): LoraEntry => ({
    id: `preset:${input.bindingKey}:${stage}:${index}:${entry.path}`,
    path: entry.path,
    weight: entry.weight,
    enabled: entry.enabled,
    source: "preset",
    sourceLabel: input.category.name,
    sourceColor: input.category.color ?? undefined,
    sourceName: input.preset.name,
    bindingId: input.bindingKey,
    groupBindingId: input.groupBindingKey ?? undefined,
  });

  return {
    lora1: input.resolved.lora1.map((entry, index) => makeLora("lora1", index, entry)),
    lora2: input.resolved.lora2.map((entry, index) => makeLora("lora2", index, entry)),
  };
}

async function findNormalizedPromptBlockById(blockId: string) {
  const direct = await prisma.sectionPromptBlock.findUnique({
    where: { id: blockId },
    include: {
      sectionBinding: {
        select: {
          id: true,
          bindingKey: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          groupBindingKey: true,
        },
      },
    },
  });
  if (direct) return direct;

  const bindingKey = parseResolvedOnlyBlockId(blockId);
  if (!bindingKey) return null;

  const bindings = await prisma.sectionPresetBinding.findMany({
    where: { bindingKey },
    take: 2,
    select: { id: true, projectSectionId: true },
  });
  if (bindings.length !== 1) return null;

  const binding = bindings[0];
  const existing = await prisma.sectionPromptBlock.findFirst({
    where: {
      projectSectionId: binding.projectSectionId,
      sectionBindingId: binding.id,
    },
    include: {
      sectionBinding: {
        select: {
          id: true,
          bindingKey: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          groupBindingKey: true,
        },
      },
    },
  });
  if (existing) return existing;

  return prisma.sectionPromptBlock.create({
    data: {
      projectSectionId: binding.projectSectionId,
      sectionBindingId: binding.id,
      type: "preset",
      sortOrder: 0,
    },
    include: {
      sectionBinding: {
        select: {
          id: true,
          bindingKey: true,
          categoryId: true,
          presetId: true,
          variantId: true,
          groupBindingKey: true,
        },
      },
    },
  });
}

async function resolvePromptBlockDataForRow(
  row: {
    id: string;
    projectSectionId: string;
    sectionBindingId: string | null;
    type: string;
    customLabel: string | null;
    customPositive: string | null;
    customNegative: string | null;
    sortOrder: number;
    sectionBinding?: { bindingKey: string } | null;
  },
): Promise<PromptBlockData> {
  const resolvedConfig = await resolveSectionConfig(row.projectSectionId);
  const resolvedBlock = row.sectionBinding?.bindingKey
    ? resolvedConfig?.promptBlocks.find((block) => block.bindingId === row.sectionBinding?.bindingKey)
    : resolvedConfig?.promptBlocks.find((block) =>
        block.sortOrder === row.sortOrder &&
        block.type === row.type &&
        block.positive === (row.customPositive ?? ""),
      );

  return {
    id: row.id,
    type: resolvedBlock?.type ?? row.type,
    sourceId: resolvedBlock?.sourceId ?? null,
    variantId: resolvedBlock?.variantId ?? null,
    categoryId: resolvedBlock?.categoryId ?? null,
    bindingId: resolvedBlock?.bindingId ?? null,
    groupBindingId: resolvedBlock?.groupBindingId ?? null,
    label: resolvedBlock?.label ?? row.customLabel ?? "Custom",
    positive: resolvedBlock?.positive ?? row.customPositive ?? "",
    negative: resolvedBlock?.negative ?? row.customNegative ?? null,
    sortOrder: row.sortOrder,
  };
}

async function resolvePromptBlockDataForBinding(
  sectionId: string,
  bindingKey: string,
): Promise<PromptBlockData | null> {
  const binding = await prisma.sectionPresetBinding.findUnique({
    where: {
      projectSectionId_bindingKey: {
        projectSectionId: sectionId,
        bindingKey,
      },
    },
    select: { id: true },
  });
  if (!binding) return null;

  const row = await prisma.sectionPromptBlock.findFirst({
    where: { projectSectionId: sectionId, sectionBindingId: binding.id },
    include: {
      sectionBinding: {
        select: { bindingKey: true },
      },
    },
  });
  if (!row) {
    const resolvedConfig = await resolveSectionConfig(sectionId);
    const resolvedBlock = resolvedConfig?.promptBlocks.find((block) => block.bindingId === bindingKey);
    if (!resolvedBlock) return null;
    return {
      id: makeResolvedOnlyBlockId(bindingKey),
      type: resolvedBlock.type,
      sourceId: resolvedBlock.sourceId,
      variantId: resolvedBlock.variantId,
      categoryId: resolvedBlock.categoryId,
      bindingId: resolvedBlock.bindingId,
      groupBindingId: resolvedBlock.groupBindingId,
      label: resolvedBlock.label,
      positive: resolvedBlock.positive,
      negative: resolvedBlock.negative,
      sortOrder: resolvedBlock.sortOrder,
    };
  }

  return resolvePromptBlockDataForRow(row);
}

// ---------------------------------------------------------------------------
// Prompt Block CRUD
// ---------------------------------------------------------------------------

export async function addSectionBlock(
  sectionId: string,
  input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
    sourceId?: string;
    categoryId?: string | null;
    bindingId?: string | null;
  },
): Promise<PromptBlockData> {
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const block = await createPromptBlock(sectionId, {
    type: input.type as "custom" | "preset",
    sourceId: input.sourceId ?? null,
    categoryId: input.categoryId ?? null,
    bindingId: input.bindingId ?? null,
    label: input.label,
    positive: input.positive,
    negative: input.negative ?? null,
  });
  audit("PromptBlock", block.id, "create", { sectionId, type: input.type }, "user" as const);
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `添加提示词块：${block.label}`,
    before: null,
    after: block,
  });
  return block;
}

export async function updateSectionBlock(
  blockId: string,
  input: {
    label?: string;
    positive?: string;
    negative?: string | null;
  },
): Promise<PromptBlockData> {
  const { updatePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const normalizedBefore = await findNormalizedPromptBlockById(blockId);
  if (normalizedBefore) {
    const beforeResolved = await resolvePromptBlockDataForRow(normalizedBefore);
    const shouldDetachFromPreset = Boolean(normalizedBefore.sectionBinding);
    let updatedRow;

    if (shouldDetachFromPreset && normalizedBefore.sectionBinding) {
      await detachSectionLorasFromPresetBinding(
        normalizedBefore.projectSectionId,
        normalizedBefore.sectionBinding.bindingKey,
      );
      updatedRow = await prisma.$transaction(async (tx) => {
        const row = await tx.sectionPromptBlock.update({
          where: { id: normalizedBefore.id },
          data: {
            sectionBindingId: null,
            type: "custom",
            customLabel: input.label ?? beforeResolved.label,
            customPositive: input.positive ?? beforeResolved.positive,
            customNegative: input.negative !== undefined ? input.negative : beforeResolved.negative,
          },
          include: {
            sectionBinding: {
              select: { bindingKey: true },
            },
          },
        });
        await tx.sectionPresetBinding.delete({
          where: { id: normalizedBefore.sectionBinding!.id },
        });
        return row;
      });
    } else {
      updatedRow = await prisma.sectionPromptBlock.update({
        where: { id: normalizedBefore.id },
        data: {
          ...(input.label !== undefined ? { customLabel: input.label } : {}),
          ...(input.positive !== undefined ? { customPositive: input.positive } : {}),
          ...(input.negative !== undefined ? { customNegative: input.negative } : {}),
        },
        include: {
          sectionBinding: {
            select: { bindingKey: true },
          },
        },
      });
    }

    const block = await resolvePromptBlockDataForRow(updatedRow);
    audit("PromptBlock", normalizedBefore.id, "update", Object.fromEntries(Object.entries(input)), "user" as const);
    await recordSectionChange({
      sectionId: normalizedBefore.projectSectionId,
      dimension: "prompt",
      title: `编辑提示词块：${beforeResolved.label}`,
      before: beforeResolved,
      after: block,
    });
    return block;
  }

  const before = await prisma.promptBlock.findUnique({
    where: { id: blockId },
    select: {
      id: true,
      projectSectionId: true,
      type: true,
      sourceId: true,
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
  const shouldDetachFromPreset = before?.type === "preset" || Boolean(before?.sourceId || before?.bindingId);
  const block = await updatePromptBlock(blockId, {
    ...input,
    ...(shouldDetachFromPreset
      ? {
          type: "custom",
          sourceId: null,
          variantId: null,
          categoryId: null,
          bindingId: null,
          groupBindingId: null,
        }
      : {}),
  });
  audit("PromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), "user" as const);
  if (before) {
    const { projectSectionId, ...beforeForLog } = before;
    await recordSectionChange({
      sectionId: projectSectionId,
      dimension: "prompt",
      title: `编辑提示词块：${before.label}`,
      before: beforeForLog,
      after: block,
    });
    if (shouldDetachFromPreset && before.bindingId) {
      await detachSectionLorasFromPresetBinding(projectSectionId, before.bindingId);
    }
  }
  return block;
}

export async function deleteSectionBlock(blockId: string): Promise<void> {
  const { deletePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const before = await prisma.promptBlock.findUnique({
    where: { id: blockId },
    select: {
      id: true,
      projectSectionId: true,
      type: true,
      sourceId: true,
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
  await deletePromptBlock(blockId);
  audit("PromptBlock", blockId, "delete", {}, "user" as const);
  if (before) {
    await recordSectionChange({
      sectionId: before.projectSectionId,
      dimension: "prompt",
      title: `删除提示词块：${before.label}`,
      before,
      after: null,
    });
  }
}

export async function reorderSectionBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockData[]> {
  const { reorderPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const before = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, sortOrder: true },
  });
  const reordered = await reorderPromptBlocks(sectionId, blockIds);
  audit("PromptBlock", sectionId, "reorder", { blockIds }, "user" as const);
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: "调整提示词块顺序",
    before,
    after: reordered.map((block) => ({ id: block.id, label: block.label, sortOrder: block.sortOrder })),
  });
  return reordered;
}

// ---------------------------------------------------------------------------
// Import preset to section (resolves linkedVariants server-side)
// ---------------------------------------------------------------------------

/** Import a preset variant into a section, resolving linkedVariants server-side */
export async function importPresetToSection(
  sectionId: string,
  presetId: string,
  variantId: string,
  groupBindingId?: string,
): Promise<ImportPresetResult | null> {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { id: true, name: true, color: true, positivePromptOrder: true, lora1Order: true, lora2Order: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset) return null;

  const variant = preset.variants.find((v) => v.id === variantId) ?? preset.variants[0];
  if (!variant) return null;

  const resolved = await resolveVariantContent(variant.id);
  const bindingKey = createBindingId();
  const label = buildPresetBlockLabel(preset, variant);

  const existingBlocks = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: sectionId },
    select: {
      id: true,
      sortOrder: true,
      sectionBinding: {
        select: {
          category: { select: { positivePromptOrder: true } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const myOrder = preset.category.positivePromptOrder;

  let insertAfterIndex = -1;
  for (let i = 0; i < existingBlocks.length; i++) {
    const order = existingBlocks[i].sectionBinding?.category.positivePromptOrder ?? 999;
    if (order <= myOrder) insertAfterIndex = i;
  }

  const insertSortOrder = insertAfterIndex >= 0
    ? existingBlocks[insertAfterIndex].sortOrder + 1
    : 0;

  await prisma.sectionPromptBlock.updateMany({
    where: {
      projectSectionId: sectionId,
      sortOrder: { gte: insertSortOrder },
    },
    data: { sortOrder: { increment: 1 } },
  });

  const { binding, promptRow } = await prisma.$transaction(async (tx) => {
    const binding = await tx.sectionPresetBinding.create({
      data: {
        projectSectionId: sectionId,
        bindingKey,
        categoryId: preset.category.id,
        presetId,
        variantId: variant.id,
        groupBindingKey: groupBindingId ?? null,
        sortOrder: insertSortOrder,
      },
    });
    const promptRow = await tx.sectionPromptBlock.create({
      data: {
        projectSectionId: sectionId,
        sectionBindingId: binding.id,
        type: "preset",
        sortOrder: insertSortOrder,
      },
      include: {
        sectionBinding: { select: { bindingKey: true } },
      },
    });
    return { binding, promptRow };
  });

  const block = await resolvePromptBlockDataForRow(promptRow);
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `导入预制：${label}`,
    before: null,
    after: { binding, block },
  });

  const { lora1, lora2 } = makePresetLoraEntries({
    bindingKey,
    groupBindingKey: groupBindingId ?? null,
    category: preset.category,
    preset,
    resolved,
  });

  return {
    block,
    lora1,
    lora2,
    categoryOrders: {
      positivePromptOrder: myOrder,
      lora1Order: preset.category.lora1Order,
      lora2Order: preset.category.lora2Order,
    },
  };
}

export async function removeImportedPresetFromSection(
  sectionId: string,
  bindingId: string,
): Promise<{ deletedBlocks: number; removedLoras: { lora1: number; lora2: number } } | null> {
  const blocks = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId, bindingId },
    select: { id: true, label: true, sourceId: true },
  });
  if (blocks.length === 0) return null;

  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { loraConfig: true },
  });
  const beforeLoraConfig = section?.loraConfig ?? null;
  const parsed = parseSectionLoraConfig(section?.loraConfig);
  const { config, removed } = removeLoraEntriesByBinding(parsed, bindingId);
  const nextConfig = serializeSectionLoraConfig(config);

  await prisma.$transaction([
    prisma.promptBlock.deleteMany({ where: { projectSectionId: sectionId, bindingId } }),
    prisma.projectSection.update({
      where: { id: sectionId },
      data: { loraConfig: nextConfig as Prisma.InputJsonValue },
    }),
  ]);

  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `删除导入预制：${blocks.map((block) => block.label).join(", ")}`,
    before: blocks,
    after: null,
  });
  if (removed.lora1 > 0 || removed.lora2 > 0) {
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: "删除导入预制 LoRA",
      before: beforeLoraConfig,
      after: nextConfig,
    });
  }
  safeRevalidatePath("/projects");

  return { deletedBlocks: blocks.length, removedLoras: removed };
}

// ---------------------------------------------------------------------------
// Switch variant for an imported preset binding
// ---------------------------------------------------------------------------

export async function switchBindingVariant(
  sectionId: string,
  bindingId: string,
  newVariantId: string,
): Promise<{ block: PromptBlockData; lora1: ImportPresetResult["lora1"]; lora2: ImportPresetResult["lora2"] } | null> {
  const sectionBinding = await prisma.sectionPresetBinding.findUnique({
    where: {
      projectSectionId_bindingKey: {
        projectSectionId: sectionId,
        bindingKey: bindingId,
      },
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      preset: {
        select: {
          id: true,
          name: true,
          variants: {
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true, isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  if (sectionBinding) {
    const variant = sectionBinding.preset.variants.find((item) => item.id === newVariantId);
    if (!variant) return null;

    const before = {
      id: sectionBinding.id,
      bindingKey: sectionBinding.bindingKey,
      variantId: sectionBinding.variantId,
    };
    const updatedBinding = await prisma.sectionPresetBinding.update({
      where: { id: sectionBinding.id },
      data: { variantId: newVariantId },
    });
    const label = buildPresetBlockLabel(sectionBinding.preset, variant);
    const block = await resolvePromptBlockDataForBinding(sectionId, bindingId);
    if (!block) return null;
    await recordSectionChange({
      sectionId,
      dimension: "prompt",
      title: `切换预制变体：${label}`,
      before,
      after: {
        id: updatedBinding.id,
        bindingKey: updatedBinding.bindingKey,
        variantId: updatedBinding.variantId,
      },
    });

    const resolved = await resolveVariantContent(newVariantId);
    const { lora1, lora2 } = makePresetLoraEntries({
      bindingKey: bindingId,
      groupBindingKey: sectionBinding.groupBindingKey,
      category: sectionBinding.category,
      preset: sectionBinding.preset,
      resolved,
    });

    safeRevalidatePath("/projects");
    return { block, lora1, lora2 };
  }

  // Find the block with this bindingId
  const block = await prisma.promptBlock.findFirst({
    where: { projectSectionId: sectionId, bindingId },
  });
  if (!block || !block.sourceId) return null;
  const beforeBlock = {
    id: block.id,
    type: block.type,
    sourceId: block.sourceId,
    variantId: block.variantId,
    categoryId: block.categoryId,
    bindingId: block.bindingId,
    groupBindingId: block.groupBindingId,
    label: block.label,
    positive: block.positive,
    negative: block.negative,
    sortOrder: block.sortOrder,
  };

  // Get preset + category info
  const preset = await prisma.preset.findUnique({
    where: { id: block.sourceId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset) return null;

  const variant = preset.variants.find((v) => v.id === newVariantId);
  if (!variant) return null;

  // Resolve with linked variants
  const resolved = await resolveVariantContent(variant.id);

  const label = preset.variants.length === 1
    ? preset.name
    : `${preset.name} / ${variant.name}`;

  // Update prompt block
  const updatedBlock = await prisma.promptBlock.update({
    where: { id: block.id },
    data: {
      variantId: newVariantId,
      label,
      positive: resolved.prompt,
      negative: resolved.negativePrompt,
    },
    select: { id: true, type: true, sourceId: true, variantId: true, categoryId: true, bindingId: true, groupBindingId: true, label: true, positive: true, negative: true, sortOrder: true },
  });
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `切换预制变体：${label}`,
    before: beforeBlock,
    after: updatedBlock,
  });

  // Update LoRAs in section loraConfig
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { loraConfig: true },
  });
  const beforeLoraConfig = section?.loraConfig ?? null;

  const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
    id: createLoraEntryId(),
    path: b.path,
    weight: b.weight,
    enabled: b.enabled,
    source: "preset" as const,
    sourceLabel: preset.category.name,
    sourceColor: preset.category.color ?? undefined,
    sourceName: preset.name,
    bindingId,
    groupBindingId: block.groupBindingId ?? undefined,
  });
  let persistedLora1: ImportPresetResult["lora1"] = [];
  let persistedLora2: ImportPresetResult["lora2"] = [];

  {
    const categoryOrderByName = await getCategoryOrderByName();
    const config = parseSectionLoraConfig(section?.loraConfig);
    const detachedLora1Paths = getDetachedPresetPaths(config.lora1, bindingId);
    const detachedLora2Paths = getDetachedPresetPaths(config.lora2, bindingId);
    const newLora1 = resolved.lora1
      .filter((entry) => !detachedLora1Paths.has(entry.path))
      .map(makeLora);
    const newLora2 = resolved.lora2
      .filter((entry) => !detachedLora2Paths.has(entry.path))
      .map(makeLora);
    persistedLora1 = newLora1;
    persistedLora2 = newLora2;
    if (config.lora1) {
      const idx = config.lora1.findIndex((e) => e.bindingId === bindingId);
      const filtered = config.lora1.filter((e) => e.bindingId !== bindingId);
      const insertAt = idx >= 0 ? Math.min(idx, filtered.length) : filtered.length;
      filtered.splice(insertAt, 0, ...newLora1);
      config.lora1 = filtered;
    }
    if (config.lora2) {
      const idx = config.lora2.findIndex((e) => e.bindingId === bindingId);
      const filtered = config.lora2.filter((e) => e.bindingId !== bindingId);
      const insertAt = idx >= 0 ? Math.min(idx, filtered.length) : filtered.length;
      filtered.splice(insertAt, 0, ...newLora2);
      config.lora2 = filtered;
    }
    config.lora1 = sortSectionLoraEntriesByCategoryOrder(
      config.lora1,
      "lora1Order",
      categoryOrderByName,
    );
    config.lora2 = sortSectionLoraEntriesByCategoryOrder(
      config.lora2,
      "lora2Order",
      categoryOrderByName,
    );
    const nextConfig = serializeSectionLoraConfig(config);

    await prisma.projectSection.update({
      where: { id: sectionId },
      data: { loraConfig: nextConfig as Prisma.InputJsonValue },
    });
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: `切换预制 LoRA：${label}`,
      before: beforeLoraConfig,
      after: nextConfig,
    });
  }

  revalidatePath("/projects");

  return {
    block: updatedBlock as PromptBlockData,
    lora1: persistedLora1,
    lora2: persistedLora2,
  };
}
