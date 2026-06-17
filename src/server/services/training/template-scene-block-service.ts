import { z } from "zod";
import type { LoraTrainingSectionBlock, LoraTrainingTemplate } from "@/features/training/types";
import {
  getTrainingTemplate,
  mapTrainingTemplateError,
  updateTrainingTemplate,
} from "@/server/services/training/template-service";

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

export class TrainingTemplateSceneBlockServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTemplateSceneBlockServiceError";
    this.status = status;
    this.details = details;
  }
}

function createBlockId(sectionId: string) {
  return `${sectionId}-block-${Date.now()}`;
}

function resolveTemplateScene(blocks: LoraTrainingSectionBlock[], fallback: string) {
  const text = blocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
  return text || fallback;
}

function mapTemplateError(error: unknown): never {
  const mapped = mapTrainingTemplateError(error);
  throw new TrainingTemplateSceneBlockServiceError(mapped.message, mapped.status, mapped.details);
}

async function getTemplateSectionContext(templateId: string, sectionId: string) {
  const template = await getTrainingTemplate(templateId);
  const section = template.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    throw new TrainingTemplateSceneBlockServiceError("Training template section not found", 404, { templateId, sectionId });
  }
  return { section, template };
}

async function getTemplateBlockContext(templateId: string, blockId: string) {
  const template = await getTrainingTemplate(templateId);
  for (const section of template.sections) {
    const block = section.blocks.find((candidate) => candidate.id === blockId);
    if (block) {
      return { block, section, template };
    }
  }
  throw new TrainingTemplateSceneBlockServiceError("Training template block not found", 404, { blockId, templateId });
}

function replaceTemplateSections(
  template: LoraTrainingTemplate,
  nextSections: LoraTrainingTemplate["sections"],
) {
  return updateTrainingTemplate(template.id, {
    title: template.title,
    description: template.description,
    imageGuidance: template.imageGuidance,
    captionGuidance: template.captionGuidance,
    sections: nextSections,
  }).catch(mapTemplateError);
}

export async function createTrainingTemplateSectionBlock(templateId: string, sectionId: string, input: unknown) {
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingTemplateSceneBlockServiceError("Invalid training template block request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { template } = await getTemplateSectionContext(templateId, sectionId);
  const nextBlock: LoraTrainingSectionBlock = {
    id: createBlockId(sectionId),
    source: parsed.data.source,
    title: parsed.data.title,
    text: parsed.data.text,
  };

  await replaceTemplateSections(template, template.sections.map((candidate) => {
    if (candidate.id !== sectionId) return candidate;
    const nextBlocks = [...candidate.blocks, nextBlock];
    return {
      ...candidate,
      blocks: nextBlocks,
      blockCount: nextBlocks.length,
      resolvedScene: resolveTemplateScene(nextBlocks, candidate.resolvedScene),
    };
  }));

  return nextBlock;
}

export async function updateTrainingTemplateSectionBlock(templateId: string, blockId: string, input: unknown) {
  const parsed = updateBlockSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingTemplateSceneBlockServiceError("Invalid training template block update request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { block, section, template } = await getTemplateBlockContext(templateId, blockId);
  const updatedBlock: LoraTrainingSectionBlock = {
    ...block,
    source: parsed.data.source ?? block.source,
    title: parsed.data.title ?? block.title,
    text: parsed.data.text ?? block.text,
  };

  await replaceTemplateSections(template, template.sections.map((candidate) => {
    if (candidate.id !== section.id) return candidate;
    const nextBlocks = candidate.blocks.map((item) => item.id === blockId ? updatedBlock : item);
    return {
      ...candidate,
      blocks: nextBlocks,
      resolvedScene: resolveTemplateScene(nextBlocks, candidate.resolvedScene),
    };
  }));

  return updatedBlock;
}

export async function reorderTrainingTemplateSectionBlocks(templateId: string, sectionId: string, input: unknown) {
  const parsed = reorderBlocksSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingTemplateSceneBlockServiceError("Invalid training template block reorder request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { section, template } = await getTemplateSectionContext(templateId, sectionId);
  const blockMap = new Map(section.blocks.map((block) => [block.id, block]));
  const reorderedBlocks = parsed.data.ids
    .map((id) => blockMap.get(id))
    .filter((block): block is LoraTrainingSectionBlock => Boolean(block));

  if (reorderedBlocks.length !== section.blocks.length) {
    throw new TrainingTemplateSceneBlockServiceError("Training template block reorder is incomplete", 400, {
      expected: section.blocks.length,
      received: reorderedBlocks.length,
    });
  }

  await replaceTemplateSections(template, template.sections.map((candidate) => {
    if (candidate.id !== sectionId) return candidate;
    return {
      ...candidate,
      blocks: reorderedBlocks,
      resolvedScene: resolveTemplateScene(reorderedBlocks, candidate.resolvedScene),
    };
  }));

  return reorderedBlocks;
}

export async function deleteTrainingTemplateSectionBlock(templateId: string, blockId: string) {
  const { section, template } = await getTemplateBlockContext(templateId, blockId);
  if (section.blocks.length <= 1) {
    throw new TrainingTemplateSceneBlockServiceError("Training template section must keep at least one block", 409, {
      blockId,
      sectionId: section.id,
      templateId,
    });
  }

  await replaceTemplateSections(template, template.sections.map((candidate) => {
    if (candidate.id !== section.id) return candidate;
    const nextBlocks = candidate.blocks.filter((item) => item.id !== blockId);
    return {
      ...candidate,
      blocks: nextBlocks,
      blockCount: nextBlocks.length,
      resolvedScene: resolveTemplateScene(nextBlocks, candidate.resolvedScene),
    };
  }));

  return {
    id: blockId,
    success: true,
  };
}

export function mapTrainingTemplateSceneBlockError(error: unknown) {
  if (error instanceof TrainingTemplateSceneBlockServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training template scene block error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
