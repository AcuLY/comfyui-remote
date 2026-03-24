import { PromptBlockType } from "@/generated/prisma";
import { db } from "@/lib/db";

export type PromptBlockRecord = {
  id: string;
  type: PromptBlockType;
  sourceId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export type PromptBlockCreateInput = {
  type: PromptBlockType;
  sourceId?: string | null;
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
  jobPositionId: string,
): Promise<PromptBlockRecord[]> {
  const blocks = await db.promptBlock.findMany({
    where: { completeJobPositionId: jobPositionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      sourceId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });

  return blocks;
}

export async function createPromptBlock(
  jobPositionId: string,
  input: PromptBlockCreateInput,
): Promise<PromptBlockRecord> {
  const maxSortOrder = await db.promptBlock.aggregate({
    where: { completeJobPositionId: jobPositionId },
    _max: { sortOrder: true },
  });

  const sortOrder =
    input.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

  return db.promptBlock.create({
    data: {
      completeJobPositionId: jobPositionId,
      type: input.type,
      sourceId: input.sourceId ?? null,
      label: input.label,
      positive: input.positive,
      negative: input.negative ?? null,
      sortOrder,
    },
    select: {
      id: true,
      type: true,
      sourceId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
}

export async function batchCreatePromptBlocks(
  jobPositionId: string,
  inputs: PromptBlockCreateInput[],
): Promise<PromptBlockRecord[]> {
  if (inputs.length === 0) return [];

  return db.$transaction(
    inputs.map((input, index) =>
      db.promptBlock.create({
        data: {
          completeJobPositionId: jobPositionId,
          type: input.type,
          sourceId: input.sourceId ?? null,
          label: input.label,
          positive: input.positive,
          negative: input.negative ?? null,
          sortOrder: input.sortOrder ?? index,
        },
        select: {
          id: true,
          type: true,
          sourceId: true,
          label: true,
          positive: true,
          negative: true,
          sortOrder: true,
        },
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
    select: {
      id: true,
      type: true,
      sourceId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
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

export async function reorderPromptBlocks(
  jobPositionId: string,
  blockIds: string[],
): Promise<PromptBlockRecord[]> {
  if (blockIds.length === 0) return [];

  const existingBlocks = await db.promptBlock.findMany({
    where: {
      id: { in: blockIds },
      completeJobPositionId: jobPositionId,
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
        select: {
          id: true,
          type: true,
          sourceId: true,
          label: true,
          positive: true,
          negative: true,
          sortOrder: true,
        },
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
    positive: positiveParts.join(", "),
    negative: negativeParts.length > 0 ? negativeParts.join(", ") : null,
  };
}
