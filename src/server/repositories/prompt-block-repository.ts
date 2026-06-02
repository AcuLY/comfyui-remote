import { db } from "@/lib/db";
import {
  addPromptBlock,
  editPromptBlock,
  getPromptBlocks,
  removePromptBlock,
  setPromptBlockOrder,
  type PromptBlockCreateInput,
  type PromptBlockRecord,
  type PromptBlockUpdateInput,
} from "@/server/services/prompt-block-service";

export type {
  PromptBlockCreateInput,
  PromptBlockRecord,
  PromptBlockUpdateInput,
};

export async function listPromptBlocks(
  sectionId: string,
): Promise<PromptBlockRecord[]> {
  return getPromptBlocks(sectionId);
}

export async function createPromptBlock(
  sectionId: string,
  input: PromptBlockCreateInput,
): Promise<PromptBlockRecord> {
  return addPromptBlock(sectionId, input);
}

export async function batchCreatePromptBlocks(
  sectionId: string,
  inputs: PromptBlockCreateInput[],
): Promise<PromptBlockRecord[]> {
  const records: PromptBlockRecord[] = [];
  for (const [index, input] of inputs.entries()) {
    records.push(await addPromptBlock(sectionId, {
      ...input,
      sortOrder: input.sortOrder ?? index,
    }));
  }
  return records;
}

export async function updatePromptBlock(
  blockId: string,
  input: PromptBlockUpdateInput,
): Promise<PromptBlockRecord> {
  return editPromptBlock(blockId, input);
}

export async function deletePromptBlock(blockId: string): Promise<void> {
  await removePromptBlock(blockId);
}

/** Delete all normalized prompt rows with a given binding key in a section. */
export async function deletePromptBlocksByBinding(
  sectionId: string,
  bindingId: string,
): Promise<number> {
  const binding = await db.sectionPresetBinding.findUnique({
    where: {
      projectSectionId_bindingKey: {
        projectSectionId: sectionId,
        bindingKey: bindingId,
      },
    },
    select: { id: true },
  });
  if (!binding) return 0;

  return db.$transaction(async (tx) => {
    await tx.sectionManualLoraEntry.deleteMany({
      where: { projectSectionId: sectionId, sectionBindingId: binding.id },
    });
    const promptRows = await tx.sectionPromptBlock.deleteMany({
      where: { projectSectionId: sectionId, sectionBindingId: binding.id },
    });
    await tx.sectionPresetBinding.delete({ where: { id: binding.id } });
    return promptRows.count;
  });
}

export async function reorderPromptBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockRecord[]> {
  return setPromptBlockOrder(sectionId, blockIds);
}

/**
 * Compose the final positive/negative prompt strings from ordered prompt blocks.
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
