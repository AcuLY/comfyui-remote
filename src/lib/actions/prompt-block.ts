"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { resolveVariantContent } from "./preset-variant";
import { createBindingId, createLoraEntryId } from "./_helpers";

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
  lora1: Array<{ id: string; path: string; weight: number; enabled: boolean; source: string; sourceLabel: string; sourceColor?: string; sourceName: string; bindingId: string; groupBindingId?: string }>;
  lora2: Array<{ id: string; path: string; weight: number; enabled: boolean; source: string; sourceLabel: string; sourceColor?: string; sourceName: string; bindingId: string; groupBindingId?: string }>;
  categoryOrders: { positivePromptOrder: number; lora1Order: number; lora2Order: number };
};

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
  const { PromptBlockType } = await import("@/generated/prisma");
  const { audit } = await import("@/server/services/audit-service");

  const block = await createPromptBlock(sectionId, {
    type: input.type as (typeof PromptBlockType)[keyof typeof PromptBlockType],
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
  const block = await updatePromptBlock(blockId, input);
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

  // Resolve with linked variants
  const resolved = await resolveVariantContent(variant.id);

  const bindingId = createBindingId();
  const label = preset.variants.length === 1
    ? preset.name
    : `${preset.name} / ${variant.name}`;

  // --- Compute insertion sortOrder based on category positivePromptOrder ---
  // 1. Get all existing blocks with their category's positivePromptOrder
  const existingBlocks = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    select: { id: true, sortOrder: true, categoryId: true },
    orderBy: { sortOrder: "asc" },
  });

  const myOrder = preset.category.positivePromptOrder;

  // Look up category orders for existing blocks
  const existingCategoryIds = [...new Set(existingBlocks.map((b) => b.categoryId).filter(Boolean))] as string[];
  const catOrders = await prisma.presetCategory.findMany({
    where: { id: { in: existingCategoryIds } },
    select: { id: true, positivePromptOrder: true },
  });
  const catOrderMap = new Map(catOrders.map((c) => [c.id, c.positivePromptOrder]));

  // Find insertion index: after last block whose category positivePromptOrder <= myOrder
  let insertAfterIndex = -1;
  for (let i = 0; i < existingBlocks.length; i++) {
    const catId = existingBlocks[i].categoryId;
    const order = catId ? (catOrderMap.get(catId) ?? 999) : 999;
    if (order <= myOrder) insertAfterIndex = i;
  }

  // Shift blocks after insertion point
  const insertSortOrder = insertAfterIndex >= 0
    ? existingBlocks[insertAfterIndex].sortOrder + 1
    : 0;

  // Bump all blocks at or after insertSortOrder
  await prisma.promptBlock.updateMany({
    where: {
      projectSectionId: sectionId,
      sortOrder: { gte: insertSortOrder },
    },
    data: { sortOrder: { increment: 1 } },
  });

  // Create prompt block at the correct position
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const block = await createPromptBlock(sectionId, {
    type: "preset" as "custom" | "preset",
    sourceId: presetId,
    variantId: variant.id,
    categoryId: preset.category.id,
    bindingId,
    groupBindingId: groupBindingId ?? null,
    label,
    positive: resolved.prompt,
    negative: resolved.negativePrompt,
    sortOrder: insertSortOrder,
  });
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `导入预制：${label}`,
    before: null,
    after: block,
  });

  // Build LoRA entries
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
    groupBindingId: groupBindingId ?? undefined,
  });

  return {
    block,
    lora1: resolved.lora1.map(makeLora),
    lora2: resolved.lora2.map(makeLora),
    categoryOrders: {
      positivePromptOrder: myOrder,
      lora1Order: preset.category.lora1Order,
      lora2Order: preset.category.lora2Order,
    },
  };
}

// ---------------------------------------------------------------------------
// Switch variant for an imported preset binding
// ---------------------------------------------------------------------------

export async function switchBindingVariant(
  sectionId: string,
  bindingId: string,
  newVariantId: string,
): Promise<{ block: PromptBlockData; lora1: ImportPresetResult["lora1"]; lora2: ImportPresetResult["lora2"] } | null> {
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

  const newLora1 = resolved.lora1.map(makeLora);
  const newLora2 = resolved.lora2.map(makeLora);

  if (section?.loraConfig) {
    const config = section.loraConfig as {
      lora1?: Array<Record<string, unknown>>;
      lora2?: Array<Record<string, unknown>>;
    };
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
    await prisma.projectSection.update({
      where: { id: sectionId },
      data: { loraConfig: config as Prisma.InputJsonValue },
    });
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: `切换预制 LoRA：${label}`,
      before: beforeLoraConfig,
      after: config,
    });
  }

  revalidatePath("/projects");

  return {
    block: updatedBlock as PromptBlockData,
    lora1: newLora1,
    lora2: newLora2,
  };
}
