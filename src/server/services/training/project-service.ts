import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DemoImage } from "@/app/design-demos/data/types";
import type {
  LoraTrainingDatasetRevision,
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingSection,
} from "@/app/design-demos/data/lora-training-types";
import { buildLoraTrainingDemoData } from "@/app/design-demos/data/lora-training";
import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import {
  createCharacterLoraTrainingProject,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";
import { z } from "zod";

const TRAINING_PROJECT_FALLBACK_PATH = join(process.cwd(), "data", "training-projects.json");

const projectSectionBlockSchema = z.object({
  id: z.string().trim().min(1),
  source: z.enum(["预制", "本地"]),
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20_000),
}).strict();

const projectSeedSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  blockCount: z.coerce.number().int().min(0).optional(),
  blocks: z.array(projectSectionBlockSchema).default([]),
  resolvedScene: z.string().trim().min(1).max(20_000),
  scenePreview: z.string().trim().min(1).max(20_000),
}).strict();

const managedProjectCreateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  characterName: z.string().trim().min(1).max(160).optional(),
  projectName: z.string().trim().min(1).max(160).optional(),
  triggerToken: z.string().trim().min(1).max(240).optional(),
  templateId: z.string().trim().min(1).optional(),
  trainingTemplateId: z.string().trim().min(1).optional(),
  baseModel: z.string().trim().max(240).optional(),
  checkpointRelativePath: z.string().trim().max(1000).optional(),
  captionStrategy: z.string().trim().max(240).optional(),
  usagePrompt: z.string().trim().max(20_000).optional(),
  detailPrompt: z.string().trim().max(20_000).optional(),
  perSectionImageCount: z.string().trim().max(32).optional(),
  trainingSteps: z.string().trim().max(32).optional(),
  selectedReferenceIds: z.array(z.string().trim().min(1)).optional().default([]),
  sections: z.array(projectSeedSectionSchema).optional().default([]),
  trainingDefaults: z.object({
    autoGenerateSamples: z.boolean().optional().default(true),
    autoFreezeDataset: z.boolean().optional().default(true),
  }).optional().default({ autoGenerateSamples: true, autoFreezeDataset: true }),
}).strict();

type ManagedProjectCreateInput = z.infer<typeof managedProjectCreateSchema>;

export class TrainingProjectServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectServiceError";
    this.status = status;
    this.details = details;
  }
}

function shouldUseTrainingProjectFileFallback(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /MODEL_BASE_DIR is not configured|Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003/i.test(message);
}

async function readFallbackTrainingProjects() {
  try {
    const raw = await readFile(TRAINING_PROJECT_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as LoraTrainingProject[];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return [] as LoraTrainingProject[];
}

async function writeFallbackTrainingProjects(projects: LoraTrainingProject[]) {
  await mkdir(dirname(TRAINING_PROJECT_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_PROJECT_FALLBACK_PATH, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
}

function parseManagedProjectCreateInput(input: unknown) {
  const result = managedProjectCreateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingProjectServiceError("Invalid training project request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function formatUpdatedAt(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normalizeTrainingProjectTitle(input: ManagedProjectCreateInput) {
  return input.title?.trim() || input.characterName?.trim() || input.projectName?.trim() || "新角色 LoRA 项目";
}

function normalizeTrainingTemplateId(input: ManagedProjectCreateInput) {
  return input.trainingTemplateId?.trim() || input.templateId?.trim() || "";
}

function buildTrainingProjectTriggerToken(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");
  return normalized || "training_project";
}

function deriveReferenceImages(
  selectedReferenceIds: string[],
  baseTraining: ReturnType<typeof buildLoraTrainingDemoData>,
  fallbackImages: DemoImage[],
): LoraTrainingReferenceImage[] {
  const results = baseTraining.projects.flatMap((project) => project.resultPool);
  const projects = baseTraining.projects;

  const picked = selectedReferenceIds.map((referenceId) => {
    if (referenceId.startsWith("project-")) {
      const project = projects.find((item) => item.id === referenceId.slice("project-".length));
      const image = project?.referenceImages[0]?.image;
      if (!project || !image) return null;
      return {
        id: `reference-${referenceId}`,
        kind: "auxiliary" as const,
        label: project.title,
        note: project.profileSummary,
        image,
      };
    }

    if (referenceId.startsWith("result-")) {
      const result = results.find((item) => item.id === referenceId.slice("result-".length));
      if (!result) return null;
      return {
        id: `reference-${referenceId}`,
        kind: "generated" as const,
        label: result.sourceLabel,
        note: result.caption,
        image: result.image,
      };
    }

    if (referenceId.startsWith("image-")) {
      const image = fallbackImages.find((item) => item.id === referenceId.slice("image-".length));
      if (!image) return null;
      return {
        id: `reference-${referenceId}`,
        kind: "auxiliary" as const,
        label: image.label,
        note: "创建项目时从资料候选显式加入。",
        image,
      };
    }

    return null;
  }).filter((item): item is LoraTrainingReferenceImage => Boolean(item));

  return picked;
}

function buildSeedSections(input: ManagedProjectCreateInput): LoraTrainingSection[] {
  return input.sections.map((section) => ({
    id: section.id,
    title: section.title,
    enabled: section.enabled,
    updatedAt: formatUpdatedAt(),
    blocks: section.blocks,
    resolvedScene: section.resolvedScene,
    imagePrompt: input.usagePrompt?.trim() || "生成干净、可训练的角色样本。",
    images: [],
    resultStatus: "pending",
  }));
}

function buildFallbackTrainingProject(
  input: ManagedProjectCreateInput,
  fallbackId: string,
  selectedReferenceImages: LoraTrainingReferenceImage[],
): LoraTrainingProject {
  const title = normalizeTrainingProjectTitle(input);
  const sections = buildSeedSections(input);
  const readiness = selectedReferenceImages.length > 0 ? "完整" : "待补";
  return {
    id: fallbackId,
    title,
    status: selectedReferenceImages.length > 0 ? "ready" : "draft",
    updatedAt: formatUpdatedAt(),
    sectionCount: sections.length,
    imageCount: 0,
    datasetVersion: "草稿",
    recentTraining: "待启动训练",
    profileSummary: input.detailPrompt?.trim() || "等待补充角色资料和训练目标。",
    usagePrompt: input.usagePrompt?.trim() || "",
    detailPrompt: input.detailPrompt?.trim() || "",
    readiness,
    keptCount: 0,
    captionMissingCount: 0,
    images: selectedReferenceImages.map((reference) => reference.image),
    referenceImages: selectedReferenceImages,
    resultPool: [] as LoraTrainingImageResult[],
    sections,
    datasetRevisions: [] as LoraTrainingDatasetRevision[],
  };
}

export async function listManagedTrainingProjects() {
  return readFallbackTrainingProjects();
}

export async function createManagedTrainingProject(input: unknown) {
  const parsed = parseManagedProjectCreateInput(input);
  const title = normalizeTrainingProjectTitle(parsed);
  const templateId = normalizeTrainingTemplateId(parsed);

  if (!templateId) {
    throw new TrainingProjectServiceError("trainingTemplateId or templateId is required", 400);
  }

  const demoData = await loadDesignDemoData();
  const baseTraining = buildLoraTrainingDemoData(demoData);
  const template = baseTraining.templates.find((item) =>
    item.id === templateId
    || item.title === templateId
    || (templateId === "character_identity_default" && item.title === "角色 LoRA 基础模板")
  );
  if (!template) {
    throw new TrainingProjectServiceError("Training template not found", 404, { templateId });
  }

  const triggerToken = parsed.triggerToken?.trim() || buildTrainingProjectTriggerToken(title);
  let createdId: string | null = null;

  try {
    const checkpointRelativePath = parsed.checkpointRelativePath?.trim();
    if (!checkpointRelativePath) {
      throw new TrainingProjectServiceError("checkpointRelativePath is required", 400);
    }
    const created = await createCharacterLoraTrainingProject({
      characterName: title,
      projectName: title,
      triggerToken,
      checkpointRelativePath,
      trainingTemplateId: template.id,
    });
    createdId = created.id;
  } catch (error) {
    if (!shouldUseTrainingProjectFileFallback(error)) {
      const mapped = mapCharacterLoraTrainingJobError(error);
      throw new TrainingProjectServiceError(mapped.message, mapped.status, mapped.details);
    }
  }

  const fallbackProjects = await readFallbackTrainingProjects();
  const selectedReferenceImages = deriveReferenceImages(parsed.selectedReferenceIds, baseTraining, demoData.images);
  const nextId = createdId ?? `training-project-${Date.now()}`;
  const project = buildFallbackTrainingProject(parsed, nextId, selectedReferenceImages);

  const currentIndex = fallbackProjects.findIndex((item) => item.id === nextId);
  const nextProjects = [...fallbackProjects];
  if (currentIndex === -1) nextProjects.unshift(project);
  else nextProjects[currentIndex] = project;
  await writeFallbackTrainingProjects(nextProjects);

  return project;
}

export function mapTrainingProjectError(error: unknown) {
  if (error instanceof TrainingProjectServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
