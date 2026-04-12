import { PromptBlockType } from "@/generated/prisma";
import { db } from "@/lib/db";

const BLOCK_SELECT = {
  id: true,
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
} as const;

export type PromptBlockRecord = {
  id: string;
  type: PromptBlockType;
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

export type PromptBlockCreateInput = {
  type: PromptBlockType;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  label: string;
  positive: string;
  negative?: string | null;
  sortOrder?: number;
};

export type PromptBlockUpdateInput = {
  label?: string;
  positive?: string;
  negative?: string | null;
  sortOrder?: number;
};

export async function listPromptBlocks(
  sectionId: string,
): Promise<PromptBlockRecord[]> {
  const blocks = await db.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: BLOCK_SELECT,
  });

  return blocks;
}

export async function createPromptBlock(
  sectionId: string,
  input: PromptBlockCreateInput,
): Promise<PromptBlockRecord> {
  const maxSortOrder = await db.promptBlock.aggregate({
    where: { projectSectionId: sectionId },
    _max: { sortOrder: true },
  });

  const sortOrder =
    input.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

  return db.promptBlock.create({
    data: {
      projectSectionId: sectionId,
      type: input.type,
      sourceId: input.sourceId ?? null,
      variantId: input.variantId ?? null,
      categoryId: input.categoryId ?? null,
      bindingId: input.bindingId ?? null,
      groupBindingId: input.groupBindingId ?? null,
      label: input.label,
      positive: input.positive,
      negative: input.negative ?? null,
      sortOrder,
    },
    select: BLOCK_SELECT,
  });
}

export async function batchCreatePromptBlocks(
  sectionId: string,
  inputs: PromptBlockCreateInput[],
): Promise<PromptBlockRecord[]> {
  if (inputs.length === 0) return [];

  return db.$transaction(
    inputs.map((input, index) =>
      db.promptBlock.create({
        data: {
          projectSectionId: sectionId,
          type: input.type,
          sourceId: input.sourceId ?? null,
          variantId: input.variantId ?? null,
          categoryId: input.categoryId ?? null,
          bindingId: input.bindingId ?? null,
          groupBindingId: input.groupBindingId ?? null,
          label: input.label,
          positive: input.positive,
          negative: input.negative ?? null,
          sortOrder: input.sortOrder ?? index,
        },
        select: BLOCK_SELECT,
      }),
    ),
  );
}

export async function updatePromptBlock(
  blockId: string,
  input: PromptBlockUpdateInput,
): Promise<PromptBlockRecord> {
  const block = await db.promptBlock.findUnique({
    where: { id: blockId },
    select: { id: true },
  });

  if (!block) {
    throw new Error("PROMPT_BLOCK_NOT_FOUND");
  }

  const data: Record<string, unknown> = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.positive !== undefined) data.positive = input.positive;
  if (input.negative !== undefined) data.negative = input.negative;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  return db.promptBlock.update({
    where: { id: blockId },
    data,
    select: BLOCK_SELECT,
  });
}

export async function deletePromptBlock(blockId: string): Promise<void> {
  const block = await db.promptBlock.findUnique({
    where: { id: blockId },
    select: { id: true },
  });

  if (!block) {
    throw new Error("PROMPT_BLOCK_NOT_FOUND");
  }

  await db.promptBlock.delete({ where: { id: blockId } });
}

/** Delete all prompt blocks with a given bindingId in a section */
export async function deletePromptBlocksByBinding(
  sectionId: string,
  bindingId: string,
): Promise<number> {
  const result = await db.promptBlock.deleteMany({
    where: { projectSectionId: sectionId, bindingId },
  });
  return result.count;
}

export async function reorderPromptBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockRecord[]> {
  if (blockIds.length === 0) return [];

  const existingBlocks = await db.promptBlock.findMany({
    where: {
      id: { in: blockIds },
      projectSectionId: sectionId,
    },
    select: { id: true },
  });

  const existingIds = new Set(existingBlocks.map((b) => b.id));
  for (const blockId of blockIds) {
    if (!existingIds.has(blockId)) {
      throw new Error("PROMPT_BLOCK_NOT_FOUND");
    }
  }

  const reordered = await db.$transaction(
    blockIds.map((blockId, index) =>
      db.promptBlock.update({
        where: { id: blockId },
        data: { sortOrder: index },
        select: BLOCK_SELECT,
      }),
    ),
  );

  return reordered;
}

/**
 * Compose the final positive/negative prompt strings from ordered PromptBlocks.
 */
export function composePromptFromBlocks(blocks: PromptBlockRecord[]): {
  positive: string;
  negative: string | null;
} {
  const positiveParts = blocks
    .map((b) => b.positive)
    .filter((v) => Boolean(v && v.trim()));
  const negativeParts = blocks
    .map((b) => b.negative)
    .filter((v): v is string => Boolean(v && v.trim()));

  return {
    positive: positiveParts.join(" BREAK "),
    negative: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : null,
  };
}
