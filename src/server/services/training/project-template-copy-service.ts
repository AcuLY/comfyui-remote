import { z } from "zod";
import type {
  LoraTrainingProject,
  LoraTrainingTemplate,
} from "@/features/training/types";
import {
  createTrainingProject,
  mapTrainingProjectError,
} from "@/server/services/training/project-actions-service";
import { loadTrainingSnapshot } from "@/server/services/training/snapshot-service";
import {
  createTrainingTemplate,
  mapTrainingTemplateError,
} from "@/server/services/training/template-service";

const templateProjectSectionBlockSchema = z.object({
  id: z.string().trim().min(1).optional(),
  source: z.enum(["预制", "本地"]).optional(),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const templateProjectSectionOverrideSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blockCount: z.coerce.number().int().min(0).optional(),
  blocks: z.array(templateProjectSectionBlockSchema).default([]),
  resolvedScene: z.string().trim().min(1).max(20_000),
  scenePreview: z.string().trim().min(1).max(20_000),
}).strict();

const createProjectFromTemplateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  characterName: z.string().trim().min(1).max(160).optional(),
  projectName: z.string().trim().min(1).max(160).optional(),
  triggerToken: z.string().trim().min(1).max(240).optional(),
  checkpointRelativePath: z.string().trim().min(1).max(1000),
  baseModel: z.string().trim().max(240).optional(),
  captionStrategy: z.string().trim().max(240).optional(),
  usagePrompt: z.string().trim().max(20_000).optional(),
  detailPrompt: z.string().trim().max(20_000).optional(),
  perSectionImageCount: z.string().trim().max(32).optional(),
  trainingSteps: z.string().trim().max(32).optional(),
  selectedReferenceIds: z.array(z.string().trim().min(1)).optional().default([]),
  sections: z.array(templateProjectSectionOverrideSchema).optional(),
  trainingDefaults: z.object({
    autoGenerateSamples: z.boolean().optional().default(true),
    autoFreezeDataset: z.boolean().optional().default(true),
  }).optional().default({ autoGenerateSamples: true, autoFreezeDataset: true }),
}).strict();

const saveProjectAsTemplateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(20_000).optional(),
  imageGuidance: z.string().trim().max(20_000).optional(),
  captionGuidance: z.string().trim().max(20_000).optional(),
  sections: z.array(z.object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(160),
    enabled: z.boolean(),
    blockCount: z.coerce.number().int().min(0).optional(),
    blocks: z.array(z.object({
      id: z.string().trim().min(1).optional(),
      source: z.enum(["预制", "本地"]).optional(),
      title: z.string().trim().min(1).max(160),
      text: z.string().trim().min(1).max(20_000),
    }).strict()).default([]),
    resolvedScene: z.string().trim().max(20_000).nullable().optional(),
    scenePreview: z.string().trim().max(20_000).nullable().optional(),
  }).strict()).optional(),
}).strict();

export class TrainingProjectTemplateCopyServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectTemplateCopyServiceError";
    this.status = status;
    this.details = details;
  }
}

function findTemplate(snapshot: Awaited<ReturnType<typeof loadTrainingSnapshot>>, templateId: string) {
  const template = snapshot.templates.find((item) => item.id === templateId);
  if (!template) {
    throw new TrainingProjectTemplateCopyServiceError("Training template not found", 404, { templateId });
  }
  return template;
}

function findProject(snapshot: Awaited<ReturnType<typeof loadTrainingSnapshot>>, projectId: string) {
  const project = snapshot.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new TrainingProjectTemplateCopyServiceError("Training project not found", 404, { projectId });
  }
  return project;
}

function deriveProjectTitle(template: LoraTrainingTemplate, input: z.infer<typeof createProjectFromTemplateSchema>) {
  return input.title?.trim()
    || input.name?.trim()
    || input.projectName?.trim()
    || input.characterName?.trim()
    || `${template.title} 项目`;
}

function mapTemplateSectionsToProjectSections(template: LoraTrainingTemplate) {
  return template.sections.map((section) => ({
    id: section.id,
    title: section.title,
    enabled: section.enabled,
    blockCount: section.blockCount,
    blocks: section.blocks.map((block) => ({
      id: block.id,
      source: block.source,
      title: block.title,
      text: block.text,
    })),
    resolvedScene: section.resolvedScene,
    scenePreview: section.scenePreview,
  }));
}

function mapProjectSectionsToTemplateSections(project: LoraTrainingProject) {
  return project.sections.map((section) => ({
    id: section.id,
    title: section.title,
    enabled: section.enabled,
    blockCount: section.blocks.length,
    blocks: section.blocks.map((block) => ({
      id: block.id,
      source: block.source,
      title: block.title,
      text: block.text,
    })),
    resolvedScene: section.resolvedScene,
    scenePreview: section.resolvedScene || section.title,
  }));
}

export async function createTrainingProjectFromTemplate(templateId: string, input: unknown) {
  const parsed = createProjectFromTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingProjectTemplateCopyServiceError("Invalid training template project request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const snapshot = await loadTrainingSnapshot();
  const template = findTemplate(snapshot, templateId);
  const title = deriveProjectTitle(template, parsed.data);

  try {
    return await createTrainingProject({
      title,
      characterName: parsed.data.characterName?.trim() || title,
      projectName: parsed.data.projectName?.trim() || title,
      triggerToken: parsed.data.triggerToken?.trim() || title,
      templateId: template.id,
      trainingTemplateId: template.id,
      checkpointRelativePath: parsed.data.checkpointRelativePath,
      baseModel: parsed.data.baseModel,
      captionStrategy: parsed.data.captionStrategy,
      usagePrompt: parsed.data.usagePrompt ?? "",
      detailPrompt: parsed.data.detailPrompt ?? "",
      perSectionImageCount: parsed.data.perSectionImageCount,
      trainingSteps: parsed.data.trainingSteps,
      selectedReferenceIds: parsed.data.selectedReferenceIds,
      sections: parsed.data.sections?.length ? parsed.data.sections : mapTemplateSectionsToProjectSections(template),
      trainingDefaults: parsed.data.trainingDefaults,
    });
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    throw new TrainingProjectTemplateCopyServiceError(mapped.message, mapped.status, mapped.details);
  }
}

export async function saveTrainingProjectAsTemplate(projectId: string, input: unknown) {
  const parsed = saveProjectAsTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new TrainingProjectTemplateCopyServiceError("Invalid training project template request", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const snapshot = await loadTrainingSnapshot();
  const project = findProject(snapshot, projectId);
  const title = parsed.data.title?.trim() || parsed.data.name?.trim() || `${project.title} 训练模板`;
  const sections = parsed.data.sections?.map((section) => ({
    id: section.id ?? `${project.id}-template-section-${section.title}`,
    title: section.title,
    enabled: section.enabled,
    blockCount: section.blockCount ?? section.blocks.length,
    blocks: section.blocks.map((block) => ({
      id: block.id ?? `${section.id ?? section.title}-block-${block.title}`,
      source: block.source ?? "本地",
      title: block.title,
      text: block.text,
    })),
    resolvedScene: section.resolvedScene ?? section.scenePreview ?? section.title,
    scenePreview: section.scenePreview ?? section.resolvedScene ?? section.title,
  })) ?? mapProjectSectionsToTemplateSections(project);

  try {
    return await createTrainingTemplate({
      title,
      description: parsed.data.description ?? `从训练项目 ${project.title} 保存为模板。`,
      imageGuidance: parsed.data.imageGuidance ?? project.usagePrompt ?? "",
      captionGuidance: parsed.data.captionGuidance ?? project.detailPrompt ?? "",
      sections,
    });
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    throw new TrainingProjectTemplateCopyServiceError(mapped.message, mapped.status, mapped.details);
  }
}

export function mapTrainingProjectTemplateCopyError(error: unknown) {
  if (error instanceof TrainingProjectTemplateCopyServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project/template copy error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
