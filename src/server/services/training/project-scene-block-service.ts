import { z } from "zod";
import type { LoraTrainingSectionBlock } from "@/app/design-demos/data/lora-training-types";
import { getTrainingBlockContext, getTrainingSectionContext } from "@/server/services/training/read-service";
import { mapTrainingProjectSectionError, upsertTrainingProjectSection } from "@/server/services/training/project-section-service";

const createBlockSchema = z.object({
  source: z.enum(["预制", "本地"]).optional().default("本地"),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const updateBlockSchema = z.object({
  source: z.enum(["预制", "本地"]).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  text: z.string().trim().min(1).max(20_000).optional(),
}).strict();

const reorderBlocksSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
}).strict();

const detachBlockSchema = z.object({
  editedText: z.string().trim().min(1).max(20_000).optional(),
}).strict();

export class TrainingSceneBlockServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingSceneBlockServiceError";
    this.status = status;
    this.details = details;
  }
}

function createBlockId(sectionId: string) {
  return `${sectionId}-block-${Date.now()}`;
}

export async function createTrainingSectionBlock(sectionId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingSceneBlockServiceError("Invalid training section block request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { project, section } = await getTrainingSectionContext(sectionId, options.projectId);
  const nextBlock: LoraTrainingSectionBlock = {
    id: createBlockId(sectionId),
    source: parsed.data.source,
    title: parsed.data.title,
    text: parsed.data.text,
  };

  await upsertTrainingProjectSection(project.id, section.id, {
    title: section.title,
    enabled: section.enabled,
    blocks: [...section.blocks, nextBlock],
    resolvedScene: section.resolvedScene,
    imagePrompt: section.imagePrompt,
  }, project.sections).catch((error) => {
    const mapped = mapTrainingProjectSectionError(error);
    throw new TrainingSceneBlockServiceError(mapped.message, mapped.status, mapped.details);
  });

  return nextBlock;
}

export async function updateTrainingSectionBlock(blockId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = updateBlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingSceneBlockServiceError("Invalid training section block update request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { block, project, section } = await getTrainingBlockContext(blockId, options.projectId);
  const updatedBlock: LoraTrainingSectionBlock = {
    ...block,
    source: parsed.data.source ?? block.source,
    title: parsed.data.title ?? block.title,
    text: parsed.data.text ?? block.text,
  };

  await upsertTrainingProjectSection(project.id, section.id, {
    title: section.title,
    enabled: section.enabled,
    blocks: section.blocks.map((candidate) => candidate.id === blockId ? updatedBlock : candidate),
    resolvedScene: section.resolvedScene,
    imagePrompt: section.imagePrompt,
  }, project.sections).catch((error) => {
    const mapped = mapTrainingProjectSectionError(error);
    throw new TrainingSceneBlockServiceError(mapped.message, mapped.status, mapped.details);
  });

  return updatedBlock;
}

export async function detachTrainingSectionBlock(blockId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = detachBlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingSceneBlockServiceError("Invalid training section block detach request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return updateTrainingSectionBlock(blockId, {
    source: "本地",
    text: parsed.data.editedText,
  }, options);
}

export async function reorderTrainingSectionBlocks(sectionId: string, input: unknown, options: { projectId?: string | null } = {}) {
  const parsed = reorderBlocksSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingSceneBlockServiceError("Invalid training section block reorder request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { project, section } = await getTrainingSectionContext(sectionId, options.projectId);
  const blockMap = new Map(section.blocks.map((block) => [block.id, block]));
  const reorderedBlocks = parsed.data.ids
    .map((id) => blockMap.get(id))
    .filter((block): block is LoraTrainingSectionBlock => Boolean(block));

  if (reorderedBlocks.length !== section.blocks.length) {
    throw new TrainingSceneBlockServiceError("Training section block reorder is incomplete", 400, {
      expected: section.blocks.length,
      received: reorderedBlocks.length,
    });
  }

  await upsertTrainingProjectSection(project.id, section.id, {
    title: section.title,
    enabled: section.enabled,
    blocks: reorderedBlocks,
    resolvedScene: section.resolvedScene,
    imagePrompt: section.imagePrompt,
  }, project.sections).catch((error) => {
    const mapped = mapTrainingProjectSectionError(error);
    throw new TrainingSceneBlockServiceError(mapped.message, mapped.status, mapped.details);
  });

  return reorderedBlocks;
}

export async function deleteTrainingSectionBlock(blockId: string, options: { projectId?: string | null } = {}) {
  const { project, section } = await getTrainingBlockContext(blockId, options.projectId);
  if (section.blocks.length <= 1) {
    throw new TrainingSceneBlockServiceError("Training section must keep at least one block", 409, { blockId, sectionId: section.id });
  }

  await upsertTrainingProjectSection(project.id, section.id, {
    title: section.title,
    enabled: section.enabled,
    blocks: section.blocks.filter((candidate) => candidate.id !== blockId),
    resolvedScene: section.resolvedScene,
    imagePrompt: section.imagePrompt,
  }, project.sections).catch((error) => {
    const mapped = mapTrainingProjectSectionError(error);
    throw new TrainingSceneBlockServiceError(mapped.message, mapped.status, mapped.details);
  });

  return {
    id: blockId,
    success: true,
  };
}

export function mapTrainingSceneBlockError(error: unknown) {
  if (error instanceof TrainingSceneBlockServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training scene block error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
