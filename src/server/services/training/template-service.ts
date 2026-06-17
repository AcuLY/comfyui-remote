import type { LoraTrainingTemplate } from "@/features/training/types";
import {
  createTrainingTemplateRow,
  getTrainingTemplateRow,
  listTrainingTemplateRows,
  softDeleteTrainingTemplateRow,
  updateTrainingTemplateRow,
  type TrainingTemplateInput as TrainingTemplateRowInput,
  type TrainingTemplateRow,
} from "@/server/repositories/training/templates";
import { z } from "zod";

const DEFAULT_IMAGE_PROMPT_FORMAT = `Generate a finished anime character illustration.

Character:
{characterDetailPrompt}

Scene:
{sceneDescription}

Supplemental prompt:
{supplementalPrompt}

Guidance:
{imagePromptGuidance}`;
const DEFAULT_TRAINING_CAPTION_FORMAT = `Caption the provided image for a character LoRA dataset.

Required prefix:
{loraUsagePrompt}

Scene context:
{sceneDescription}

Image-specific supplemental prompt:
{imageSupplementalPrompt}

Task supplemental prompt:
{supplementalPrompt}

Guidance:
{captioningGuidance}`;

const templateBlockInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  source: z.enum(["预制", "本地"]).optional(),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const templateSectionInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blockCount: z.coerce.number().int().min(0).optional(),
  blocks: z.array(templateBlockInputSchema).default([]),
  resolvedScene: z.string().trim().max(20_000).nullable().optional(),
  scenePreview: z.string().trim().max(20_000).nullable().optional(),
}).strict();

const trainingTemplateInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(20_000).nullable().optional(),
  imageGuidance: z.string().trim().max(20_000).nullable().optional(),
  captionGuidance: z.string().trim().max(20_000).nullable().optional(),
  sections: z.array(templateSectionInputSchema).default([]),
}).strict();

type TrainingTemplateInput = z.infer<typeof trainingTemplateInputSchema>;

export class TrainingTemplateServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTemplateServiceError";
    this.status = status;
    this.details = details;
  }
}

function formatUpdatedAt(value: Date | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapTrainingTemplateRow(row: TrainingTemplateRow): LoraTrainingTemplate {
  return {
    id: row.id,
    title: row.name,
    status: row.isActive ? "active" : "archived",
    updatedAt: formatUpdatedAt(row.updatedAt),
    description: row.description ?? "",
    imageGuidance: row.imagePromptGuidance,
    captionGuidance: row.captioningGuidance,
    sectionCount: row.sections.length,
    sections: row.sections.map((section) => ({
      id: section.id,
      title: section.name ?? "未命名小节",
      enabled: section.enabled,
      blockCount: section.blocks.length,
      blocks: section.blocks.map((block) => ({
        id: block.id,
        source: block.sourceType === "preset" ? "预制" : "本地",
        title: block.title,
        text: block.localText ?? block.title,
      })),
      resolvedScene: section.blocks.map((block) => block.localText ?? block.title).filter(Boolean).join("\n\n") || section.name || "未填写场景描述",
      scenePreview: section.blocks[0]?.localText ?? section.name ?? "未填写场景摘要",
    })),
  };
}

function parseTrainingTemplateInput(input: unknown) {
  const result = trainingTemplateInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingTemplateServiceError("Invalid training template request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function normalizeTemplatePayload(
  input: TrainingTemplateInput,
  options: { preserveIds: boolean } = { preserveIds: true },
): TrainingTemplateRowInput {
  return {
    name: input.title,
    slug: null,
    description: input.description ?? null,
    imagePromptGuidance: input.imageGuidance ?? "",
    imagePromptFormat: DEFAULT_IMAGE_PROMPT_FORMAT,
    captioningGuidance: input.captionGuidance ?? "",
    trainingCaptionFormat: DEFAULT_TRAINING_CAPTION_FORMAT,
    sections: input.sections.map((section, sectionIndex) => ({
      id: options.preserveIds ? section.id : undefined,
      name: section.title,
      sortOrder: sectionIndex,
      enabled: section.enabled,
      blocks: section.blocks.map((block, blockIndex) => ({
        id: options.preserveIds ? block.id : undefined,
        sourceType: block.source === "预制" ? "preset" : "local",
        title: block.title,
        localText: block.text,
        sortOrder: blockIndex,
      })),
    })),
  };
}

function normalizeTrainingTemplateRowPayload(row: TrainingTemplateRow, sortOrder = row.sortOrder): TrainingTemplateRowInput {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imagePromptGuidance: row.imagePromptGuidance,
    imagePromptFormat: row.imagePromptFormat,
    captioningGuidance: row.captioningGuidance,
    trainingCaptionFormat: row.trainingCaptionFormat,
    trainingDefaultsJson: row.trainingDefaultsJson as TrainingTemplateRowInput["trainingDefaultsJson"],
    sortOrder,
    isActive: row.isActive,
    sections: row.sections.map((section, sectionIndex) => ({
      id: section.id,
      name: section.name ?? "未命名小节",
      sortOrder: sectionIndex,
      enabled: section.enabled,
      sectionDefaultsJson: section.sectionDefaultsJson as TrainingTemplateRowInput["sections"][number]["sectionDefaultsJson"],
      blocks: section.blocks.map((block, blockIndex) => ({
        id: block.id,
        sourceType: block.sourceType === "preset" ? "preset" : "local",
        title: block.title,
        localText: block.localText,
        sceneDescriptionPresetCategoryId: block.sceneDescriptionPresetCategoryId,
        sceneDescriptionPresetId: block.sceneDescriptionPresetId,
        sortOrder: blockIndex,
        enabled: block.enabled,
      })),
    })),
  };
}

function nextTemplateSectionOrdinal(sections: LoraTrainingTemplate["sections"], prefix: string) {
  const ordinals = sections
    .map((section) => (section.id.startsWith(prefix) ? Number(section.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function createDraftTemplateSection(
  current: LoraTrainingTemplate["sections"],
  templateId: string,
  titleSuffix: string,
): LoraTrainingTemplate["sections"][number] {
  const source = current[0];
  const sectionOrdinal = nextTemplateSectionOrdinal(current, `${templateId}-section-`);
  const sectionId = `${templateId}-section-${sectionOrdinal}`;
  const draftIndex = current.length + 1;
  if (source) {
    return {
      ...source,
      id: sectionId,
      title: `新模板小节 ${draftIndex}${titleSuffix}`,
      enabled: true,
      blocks: source.blocks.map((block, index) => ({
        ...block,
        id: `${sectionId}-block-${index + 1}`,
      })),
      scenePreview: "补充这个模板小节的训练场景摘要。",
    };
  }

  return {
    id: sectionId,
    title: `新模板小节 ${draftIndex}${titleSuffix}`,
    enabled: true,
    blockCount: 1,
    blocks: [
      {
        id: `${sectionId}-block-1`,
        source: "本地",
        title: "本地场景描述",
        text: "补充这个模板小节的训练场景描述。",
      },
    ],
    resolvedScene: "补充这个模板小节的训练场景描述。",
    scenePreview: "补充这个模板小节的训练场景摘要。",
  };
}

export async function listTrainingTemplates() {
  const rows = await listTrainingTemplateRows();
  return rows.map(mapTrainingTemplateRow);
}

export async function getTrainingTemplate(templateId: string) {
  const row = await getTrainingTemplateRow(templateId);
  if (!row || !row.isActive) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
  }
  return mapTrainingTemplateRow(row);
}

export async function createTrainingTemplate(input: unknown) {
  const parsed = parseTrainingTemplateInput(input);
  const row = await createTrainingTemplateRow(normalizeTemplatePayload(parsed, { preserveIds: false }));
  return mapTrainingTemplateRow(row);
}

export async function updateTrainingTemplate(templateId: string, input: unknown) {
  const parsed = parseTrainingTemplateInput(input);
  const current = await getTrainingTemplateRow(templateId);
  if (!current || !current.isActive) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
  }

  const row = await updateTrainingTemplateRow(current.id, normalizeTemplatePayload(parsed, { preserveIds: true }));
  if (!row) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
  }
  return mapTrainingTemplateRow(row);
}

export async function deleteTrainingTemplate(templateId: string) {
  const current = await getTrainingTemplateRow(templateId);
  if (!current || !current.isActive) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
  }

  const row = await softDeleteTrainingTemplateRow(current.id);
  if (!row) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
  }
  return { success: true };
}

export async function reorderTrainingTemplates(input: unknown) {
  const schema = z.object({
    orderedTemplateIds: z.array(z.string().trim().min(1)).min(1),
  }).strict();
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template reorder request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const orderedTemplateIds = result.data.orderedTemplateIds;
  const uniqueTemplateIds = new Set(orderedTemplateIds);
  if (uniqueTemplateIds.size !== orderedTemplateIds.length) {
    throw new TrainingTemplateServiceError("orderedTemplateIds must include every training template exactly once", 400, {
      duplicateTemplateIds: orderedTemplateIds.filter((templateId, index) => orderedTemplateIds.indexOf(templateId) !== index),
    });
  }

  const rows = await listTrainingTemplateRows();
  if (orderedTemplateIds.length !== rows.length) {
    throw new TrainingTemplateServiceError("orderedTemplateIds must include every training template exactly once", 400, {
      expected: rows.length,
      actual: orderedTemplateIds.length,
    });
  }

  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const missingTemplateIds = orderedTemplateIds.filter((templateId) => !rowMap.has(templateId));
  if (missingTemplateIds.length > 0) {
    throw new TrainingTemplateServiceError("Training template not found", 404, { missingTemplateIds });
  }

  const updatedRows: TrainingTemplateRow[] = [];
  for (const [index, templateId] of orderedTemplateIds.entries()) {
    const row = rowMap.get(templateId)!;
    const updated = await updateTrainingTemplateRow(row.id, normalizeTrainingTemplateRowPayload(row, index));
    if (!updated) {
      throw new TrainingTemplateServiceError("Training template not found", 404, { templateId });
    }
    updatedRows.push(updated);
  }

  return {
    orderedTemplateIds: updatedRows.map((row) => row.id),
    templates: updatedRows.map(mapTrainingTemplateRow),
  };
}

export async function updateTrainingTemplateSection(templateId: string, sectionId: string, input: unknown) {
  const patchSchema = z.object({
    title: z.string().trim().min(1).max(160).optional(),
    enabled: z.boolean().optional(),
    blocks: z.array(templateBlockInputSchema).optional(),
    resolvedScene: z.string().trim().max(20_000).nullable().optional(),
    scenePreview: z.string().trim().max(20_000).nullable().optional(),
  }).strict();
  const result = patchSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template section request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getTrainingTemplate(templateId);
  const sections = current.sections.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      title: result.data.title ?? section.title,
      enabled: result.data.enabled ?? section.enabled,
      blocks: result.data.blocks
        ? result.data.blocks.map((block, index) => ({
          id: block.id ?? `${section.id}-block-${index + 1}`,
          source: block.source ?? "本地",
          title: block.title,
          text: block.text,
        }))
        : section.blocks,
      resolvedScene: result.data.resolvedScene ?? section.resolvedScene,
      scenePreview: result.data.scenePreview ?? section.scenePreview,
      blockCount: result.data.blocks ? result.data.blocks.length : section.blockCount,
    };
  });

  if (!sections.some((section) => section.id === sectionId)) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { templateId, sectionId });
  }

  return updateTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections,
  });
}

export async function createTrainingTemplateSection(templateId: string, input: unknown = {}) {
  const schema = z.object({
    sourceSectionId: z.string().trim().min(1).optional(),
  }).strict();
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template section create request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getTrainingTemplate(templateId);
  const sourceSectionId = result.data.sourceSectionId?.trim();
  const nextSection = sourceSectionId
    ? (() => {
        const source = current.sections.find((section) => section.id === sourceSectionId);
        if (!source) {
          throw new TrainingTemplateServiceError("Training template section not found", 404, { sourceSectionId, templateId });
        }
        const copyOrdinal = nextTemplateSectionOrdinal(current.sections, `${source.id}-copy-`);
        const sectionId = `${source.id}-copy-${copyOrdinal}`;
        return {
          ...source,
          id: sectionId,
          title: `${source.title} (副本)`,
          blocks: source.blocks.map((block, index) => ({
            ...block,
            id: `${sectionId}-block-${index + 1}`,
          })),
        };
      })()
    : createDraftTemplateSection(current.sections, templateId, "");

  const nextSections = sourceSectionId
    ? (() => {
        const sourceIndex = current.sections.findIndex((section) => section.id === sourceSectionId);
        if (sourceIndex === -1) return [...current.sections, nextSection];
        return [
          ...current.sections.slice(0, sourceIndex + 1),
          nextSection,
          ...current.sections.slice(sourceIndex + 1),
        ];
      })()
    : [...current.sections, nextSection];

  return updateTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: nextSections,
  });
}

export async function deleteTrainingTemplateSection(templateId: string, sectionId: string) {
  const current = await getTrainingTemplate(templateId);
  if (!current.sections.some((section) => section.id === sectionId)) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { templateId, sectionId });
  }

  return updateTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: current.sections.filter((section) => section.id !== sectionId),
  });
}

export async function reorderTrainingTemplateSections(templateId: string, input: unknown) {
  const schema = z.object({
    orderedSectionIds: z.array(z.string().trim().min(1)).min(1),
  }).strict();
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TrainingTemplateServiceError("Invalid training template reorder request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const current = await getTrainingTemplate(templateId);
  const orderedSectionIds = [...new Set(result.data.orderedSectionIds)];
  if (orderedSectionIds.length !== current.sections.length) {
    throw new TrainingTemplateServiceError("orderedSectionIds must include every template section exactly once", 400, {
      expected: current.sections.length,
      actual: orderedSectionIds.length,
    });
  }

  const sectionMap = new Map(current.sections.map((section) => [section.id, section]));
  const missingSectionIds = orderedSectionIds.filter((sectionId) => !sectionMap.has(sectionId));
  if (missingSectionIds.length > 0) {
    throw new TrainingTemplateServiceError("Training template section not found", 404, { missingSectionIds, templateId });
  }

  const nextSections = orderedSectionIds.map((sectionId) => sectionMap.get(sectionId)!);
  return updateTrainingTemplate(templateId, {
    title: current.title,
    description: current.description,
    imageGuidance: current.imageGuidance,
    captionGuidance: current.captionGuidance,
    sections: nextSections,
  });
}

export function mapTrainingTemplateError(error: unknown) {
  if (error instanceof TrainingTemplateServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training template error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
