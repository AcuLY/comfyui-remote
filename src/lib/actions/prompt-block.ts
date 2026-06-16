"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { type LoraEntry } from "@/lib/lora-types";
import { resolveSectionConfig } from "@/server/prompt-config/section-resolver";
import {
  resolvePresetGroupContent,
  type PresetGroupResolverDbClient,
} from "@/server/prompt-config/preset-group-resolver";
import { detachSectionLorasFromPresetBinding } from "@/server/services/preset-binding-service";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import { buildGenerationPresetWhere } from "@/server/repositories/generation-resource-boundary";
import { resolveVariantContent } from "./preset-variant";
import { ordinaryPresetCategoryTypeWhere, ordinaryPresetLibraryCategoryTypeWhere } from "./preset-resource-scope";
import {
  createBindingId,
} from "./_helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptBlockData = {
  id: string;
  type: string;
  sourceId: string | null;
  variantId: string | null;
  presetGroupId?: string | null;
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

export type ImportPresetGroupResult = {
  groupBindingId: string;
  results: ImportPresetResult[];
  blocks: PromptBlockData[];
  lora1: LoraEntry[];
  lora2: LoraEntry[];
};

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
          presetGroupId: true,
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
          presetGroupId: true,
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
          presetGroupId: true,
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
    presetGroupId: resolvedBlock?.presetGroupId ?? null,
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
      presetGroupId: resolvedBlock.presetGroupId,
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

async function createSectionPromptBlockRow(
  sectionId: string,
  input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
    sourceId?: string | null;
    variantId?: string | null;
    presetGroupId?: string | null;
    categoryId?: string | null;
    bindingId?: string | null;
    groupBindingId?: string | null;
    sortOrder?: number;
  },
): Promise<PromptBlockData> {
  const row = await prisma.$transaction(async (tx) => {
    const maxResult = await tx.sectionPromptBlock.aggregate({
      where: { projectSectionId: sectionId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (maxResult._max.sortOrder ?? -1) + 1;

    if (input.type === "preset") {
      if (!input.categoryId || !input.bindingId || (!input.sourceId && !input.presetGroupId)) {
        throw new Error("PRESET_BLOCK_IDENTITY_REQUIRED");
      }
      const existingBinding = await tx.sectionPresetBinding.findUnique({
        where: {
          projectSectionId_bindingKey: {
            projectSectionId: sectionId,
            bindingKey: input.bindingId,
          },
        },
        select: { id: true },
      });
      const binding = existingBinding ?? await tx.sectionPresetBinding.create({
        data: {
          projectSectionId: sectionId,
          bindingKey: input.bindingId,
          categoryId: input.categoryId,
          presetId: input.sourceId ?? null,
          variantId: input.sourceId ? input.variantId ?? null : null,
          presetGroupId: input.presetGroupId ?? null,
          groupBindingKey: input.groupBindingId ?? null,
          sortOrder,
        },
        select: { id: true },
      });

      return tx.sectionPromptBlock.create({
        data: {
          projectSectionId: sectionId,
          sectionBindingId: binding.id,
          type: "preset",
          sortOrder,
        },
        include: {
          sectionBinding: {
            select: { bindingKey: true },
          },
        },
      });
    }

    return tx.sectionPromptBlock.create({
      data: {
        projectSectionId: sectionId,
        type: "custom",
        customLabel: input.label,
        customPositive: input.positive,
        customNegative: input.negative ?? null,
        sortOrder,
      },
      include: {
        sectionBinding: {
          select: { bindingKey: true },
        },
      },
    });
  });

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
    presetGroupId?: string | null;
  },
): Promise<PromptBlockData> {
  const { audit } = await import("@/server/services/audit-service");

  const block = await createSectionPromptBlockRow(sectionId, {
    type: input.type as "custom" | "preset",
    sourceId: input.sourceId ?? null,
    categoryId: input.categoryId ?? null,
    bindingId: input.bindingId ?? null,
    presetGroupId: input.presetGroupId ?? null,
    label: input.label,
    positive: input.positive,
    negative: input.negative ?? null,
  });
  audit("SectionPromptBlock", block.id, "create", { sectionId, type: input.type }, "user" as const);
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
    audit("SectionPromptBlock", normalizedBefore.id, "update", Object.fromEntries(Object.entries(input)), "user" as const);
    await recordSectionChange({
      sectionId: normalizedBefore.projectSectionId,
      dimension: "prompt",
      title: `编辑提示词块：${beforeResolved.label}`,
      before: beforeResolved,
      after: block,
    });
    return block;
  }

  throw new Error("PROMPT_BLOCK_NOT_FOUND");
}

export async function deleteSectionBlock(blockId: string): Promise<void> {
  const { audit } = await import("@/server/services/audit-service");

  const beforeRow = await findNormalizedPromptBlockById(blockId);
  if (!beforeRow) throw new Error("PROMPT_BLOCK_NOT_FOUND");

  const before = await resolvePromptBlockDataForRow(beforeRow);
  await prisma.$transaction(async (tx) => {
    if (beforeRow.sectionBinding) {
      await tx.sectionManualLoraEntry.deleteMany({
        where: { projectSectionId: beforeRow.projectSectionId, sectionBindingId: beforeRow.sectionBinding.id },
      });
      await tx.sectionPromptBlock.delete({ where: { id: blockId } });
      await tx.sectionPresetBinding.delete({ where: { id: beforeRow.sectionBinding.id } });
    } else {
      await tx.sectionPromptBlock.delete({ where: { id: blockId } });
    }
  });
  audit("SectionPromptBlock", blockId, "delete", {}, "user" as const);
  await recordSectionChange({
    sectionId: beforeRow.projectSectionId,
    dimension: "prompt",
    title: `删除提示词块：${before.label}`,
    before,
    after: null,
  });
}

export async function reorderSectionBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockData[]> {
  const { audit } = await import("@/server/services/audit-service");

  const beforeRows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      sectionBinding: {
        select: { bindingKey: true },
      },
    },
  });
  const existingIds = new Set(beforeRows.map((row) => row.id));
  for (const blockId of blockIds) {
    if (!existingIds.has(blockId)) {
      throw new Error("PROMPT_BLOCK_NOT_FOUND");
    }
  }
  const reorderedRows = await prisma.$transaction(
    blockIds.map((blockId, index) =>
      prisma.sectionPromptBlock.update({
        where: { id: blockId },
        data: { sortOrder: index },
        include: {
          sectionBinding: {
            select: { bindingKey: true },
          },
        },
      }),
    ),
  );
  const before = await Promise.all(beforeRows.map(resolvePromptBlockDataForRow));
  const reordered = await Promise.all(reorderedRows.map(resolvePromptBlockDataForRow));
  audit("SectionPromptBlock", sectionId, "reorder", { blockIds }, "user" as const);
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
  presetGroupId?: string,
): Promise<ImportPresetResult | null> {
  const preset = await prisma.preset.findFirst({
    where: buildGenerationPresetWhere({
      id: presetId,
      category: { type: ordinaryPresetCategoryTypeWhere() },
    }),
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
        presetGroupId: presetGroupId ?? null,
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

export async function importPresetGroupToSection(
  sectionId: string,
  presetGroupId: string,
  groupBindingId?: string,
): Promise<ImportPresetGroupResult | null> {
  const group = await prisma.presetGroup.findFirst({
    where: {
      id: presetGroupId,
      category: { type: ordinaryPresetLibraryCategoryTypeWhere() },
    },
    select: { id: true, categoryId: true, name: true, isActive: true },
  });
  if (!group || group.isActive === false) return null;

  const resolvedGroup = await resolvePresetGroupContent(
    presetGroupId,
    prisma as unknown as PresetGroupResolverDbClient,
  );
  if (!resolvedGroup || resolvedGroup.members.length === 0) return null;

  const groupBindingKey = groupBindingId ?? `grp:${presetGroupId}:${createBindingId()}`;
  const bindingKey = createBindingId();
  const firstMemberOrder = Math.min(...resolvedGroup.members.map((member) => member.positivePromptOrder));
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

  let insertAfterIndex = -1;
  for (let i = 0; i < existingBlocks.length; i++) {
    const order = existingBlocks[i].sectionBinding?.category.positivePromptOrder ?? 999;
    if (order <= firstMemberOrder) insertAfterIndex = i;
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

  const { binding } = await prisma.$transaction(async (tx) => {
    const binding = await tx.sectionPresetBinding.create({
      data: {
        projectSectionId: sectionId,
        bindingKey,
        categoryId: group.categoryId,
        presetId: null,
        variantId: null,
        presetGroupId,
        groupBindingKey,
        sortOrder: insertSortOrder,
      },
    });
    await tx.sectionPromptBlock.create({
      data: {
        projectSectionId: sectionId,
        sectionBindingId: binding.id,
        type: "preset",
        sortOrder: insertSortOrder,
      },
    });
    return { binding };
  });

  const resolvedConfig = await resolveSectionConfig(sectionId);
  const blocks = (resolvedConfig?.promptBlocks ?? [])
    .filter((block) => block.bindingId === binding.bindingKey && block.presetGroupId === presetGroupId)
    .map((block, index) => ({
      id: makeResolvedOnlyBlockId(binding.bindingKey, index),
      type: block.type,
      sourceId: block.sourceId,
      variantId: block.variantId,
      presetGroupId: block.presetGroupId,
      categoryId: block.categoryId,
      bindingId: block.bindingId,
      groupBindingId: block.groupBindingId,
      label: block.label,
      positive: block.positive,
      negative: block.negative,
      sortOrder: block.sortOrder,
    }));
  const lora1 = (resolvedConfig?.loraConfig.lora1 ?? [])
    .filter((entry) => entry.bindingId === binding.bindingKey && entry.groupBindingId === binding.groupBindingKey);
  const lora2 = (resolvedConfig?.loraConfig.lora2 ?? [])
    .filter((entry) => entry.bindingId === binding.bindingKey && entry.groupBindingId === binding.groupBindingKey);

  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `瀵煎叆棰勫埗缁勶細${group.name}`,
    before: null,
    after: {
      groupId: group.id,
      groupBindingKey,
      bindingId: binding.bindingKey,
      blocks: blocks.map((block) => ({
        sourceId: block.sourceId,
        variantId: block.variantId,
        categoryId: block.categoryId,
      })),
    },
  });

  return {
    groupBindingId: groupBindingKey,
    results: [],
    blocks,
    lora1,
    lora2,
  };
}

export async function removeImportedPresetFromSection(
  sectionId: string,
  bindingId: string,
): Promise<{ deletedBlocks: number; removedLoras: { lora1: number; lora2: number } } | null> {
  const binding = await prisma.sectionPresetBinding.findUnique({
    where: {
      projectSectionId_bindingKey: {
        projectSectionId: sectionId,
        bindingKey: bindingId,
      },
    },
    select: { id: true, groupBindingKey: true },
  });
  if (!binding) return null;
  const bindings = binding.groupBindingKey
    ? await prisma.sectionPresetBinding.findMany({
        where: {
          projectSectionId: sectionId,
          groupBindingKey: binding.groupBindingKey,
        },
        select: { id: true },
      })
    : [binding];
  const bindingIds = bindings.map((item) => item.id);

  const promptRows = await prisma.sectionPromptBlock.findMany({
    where: { projectSectionId: sectionId, sectionBindingId: { in: bindingIds } },
    include: {
      sectionBinding: {
        select: { bindingKey: true },
      },
    },
  });
  const blocks = await Promise.all(promptRows.map(resolvePromptBlockDataForRow));
  const manualLoras = await prisma.sectionManualLoraEntry.findMany({
    where: { projectSectionId: sectionId, sectionBindingId: { in: bindingIds } },
    select: { stage: true },
  });
  const removed = {
    lora1: manualLoras.filter((entry) => entry.stage === "lora1").length,
    lora2: manualLoras.filter((entry) => entry.stage === "lora2").length,
  };

  await prisma.$transaction(async (tx) => {
    await tx.sectionManualLoraEntry.deleteMany({
      where: { projectSectionId: sectionId, sectionBindingId: { in: bindingIds } },
    });
    await tx.sectionPromptBlock.deleteMany({
      where: { projectSectionId: sectionId, sectionBindingId: { in: bindingIds } },
    });
    await tx.sectionPresetBinding.deleteMany({
      where: { projectSectionId: sectionId, id: { in: bindingIds } },
    });
  });

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
      before: manualLoras,
      after: null,
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
    if (!sectionBinding.preset) return null;
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

  return null;
}
