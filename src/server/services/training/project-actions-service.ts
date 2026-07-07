import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { z } from "zod";

import type {
  LoraTrainingDatasetRevision,
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingSection,
  TrainingImage,
} from "@/features/training/types";
import { toImageUrl } from "@/lib/image-url";
import {
  archiveTrainingProductionProject,
  cancelTrainingProductionGenerationRun,
  cancelTrainingProductionRun,
  createTrainingProductionProject,
  createTrainingPromptCardVersion,
  deleteTrainingProductionProject,
  deleteTrainingReferenceImageRecord,
  enqueueTrainingProductionRun,
  enqueueTrainingProductionSectionGenerationRun,
  freezeTrainingProductionDataset,
  getTrainingCandidateImage,
  getTrainingProductionProject,
  getTrainingProductionProjectOverview,
  getTrainingProductionProjectSection,
  getTrainingReferenceImageRecord,
  listTrainingProjectSections,
  listTrainingPromptCardVersions,
  listTrainingReferenceImagesForProject,
  mapTrainingGenerationError,
  mapTrainingProductionProjectError,
  mapTrainingPromptCardError,
  mapTrainingReferenceImageError,
  mapTrainingRunError,
  registerTrainingReferenceImageAsResult,
  registerTrainingReferenceImageFromArtifact as registerTrainingReferenceImageFromArtifactInRepository,
  replaceTrainingProjectSections,
  restoreTrainingProductionProject,
  updateTrainingProductionProject,
  updateTrainingReferenceImageRecord,
  uploadTrainingReferenceImage,
} from "@/server/repositories/training/projects";

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

const trainingProjectCreateSchema = z.object({
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

type TrainingProjectCreateInput = z.infer<typeof trainingProjectCreateSchema>;

export class TrainingProjectActionServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectActionServiceError";
    this.status = status;
    this.details = details;
  }
}

function parseTrainingProjectCreateInput(input: unknown) {
  const result = trainingProjectCreateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingProjectActionServiceError("Invalid training project request", 400, {
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

function normalizeTrainingProjectTitle(input: TrainingProjectCreateInput) {
  return input.title?.trim() || input.characterName?.trim() || input.projectName?.trim() || "新角色 LoRA 项目";
}

function normalizeTrainingTemplateId(input: TrainingProjectCreateInput) {
  return input.trainingTemplateId?.trim() || input.templateId?.trim() || "";
}

function buildTrainingProjectTriggerToken(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");
  return normalized || "training_project";
}

function buildReferencePreviewImage(relativePath: string, label: string): TrainingImage | null {
  const url = toImageUrl(relativePath);
  if (!url) return null;
  return {
    id: `training-reference-preview-${randomUUID()}`,
    src: url,
    full: url,
    label,
    status: "pending",
    featured: false,
    featured2: false,
    cover: false,
    width: null,
    height: null,
  };
}

function imageUrlToRelativePath(url: string | null | undefined) {
  if (!url) return null;
  const normalized = url.split(/[?#]/, 1)[0] ?? url;
  if (!normalized.startsWith("/api/images/")) return null;
  const relative = decodeURIComponent(normalized.slice("/api/images/".length));
  return relative ? `data/images/${relative}` : null;
}

function imageMimeTypeFromPath(relativePath: string) {
  const extension = extname(relativePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

async function deriveReferenceImages(selectedReferenceIds: string[]): Promise<LoraTrainingReferenceImage[]> {
  const picked: Array<LoraTrainingReferenceImage | null> = await Promise.all(selectedReferenceIds.map(async (referenceId) => {
    if (referenceId.startsWith("project-")) {
      const projectId = referenceId.slice("project-".length);

      try {
        const [job, sourceImages] = await Promise.all([
          getTrainingProductionProject(projectId),
          listTrainingReferenceImagesForProject(projectId),
        ]);
        const firstSourceImage = sourceImages[0];
        if (!firstSourceImage) return null;
        const productionImage = buildReferencePreviewImage(firstSourceImage.relativePath, job.characterName);
        if (!productionImage) return null;
        return {
          id: `reference-${referenceId}`,
          kind: "auxiliary" as const,
          label: job.characterName,
          note: `${job.triggerToken} · 源图 ${job.counts.sourceImages} 张`,
          image: productionImage,
        };
      } catch {
        return null;
      }
    }

    if (referenceId.startsWith("result-")) {
      const resultId = referenceId.slice("result-".length);

      try {
        const candidate = await getTrainingCandidateImage(resultId);
        if (!candidate) return null;
        const [job, section] = await Promise.all([
          getTrainingProductionProject(candidate.jobId).catch(() => null),
          candidate.sectionId ? getTrainingProductionProjectSection(candidate.sectionId).catch(() => null) : Promise.resolve(null),
        ]);
        const label = job?.characterName
          ? `${job.characterName} / ${section?.name ?? "结果池"}`
          : section?.name ?? candidate.id;
        const image = buildReferencePreviewImage(candidate.relativePath, label);
        if (!image) return null;
        return {
          id: `reference-${referenceId}`,
          kind: "generated" as const,
          label,
          note: candidate.captionDraft?.trim() || "创建项目时从已保留结果显式加入。",
          image,
        };
      } catch {
        return null;
      }
    }

    return null;
  }));

  return picked.filter((item): item is LoraTrainingReferenceImage => Boolean(item));
}

async function syncSelectedReferenceImagesToTrainingProject(
  projectId: string,
  selectedReferenceImages: LoraTrainingReferenceImage[],
) {
  for (const [index, reference] of selectedReferenceImages.entries()) {
    const relativePath = imageUrlToRelativePath(reference.image.full) ?? imageUrlToRelativePath(reference.image.src);

    if (!relativePath) {
      throw new TrainingProjectActionServiceError("Selected training reference image could not be resolved to a local file", 400, {
        projectId,
        referenceId: reference.id,
        src: reference.image.src,
      });
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(join(process.cwd(), relativePath));
    } catch (error) {
      throw new TrainingProjectActionServiceError("Selected training reference image file was not found", 404, {
        projectId,
        referenceId: reference.id,
        relativePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array(buffer)], basename(relativePath), {
        type: imageMimeTypeFromPath(relativePath),
      }),
    );
    formData.append("role", "source");
    formData.append("sortOrder", String(index));

    const uploaded = await uploadTrainingReferenceImage(projectId, formData);
    await updateTrainingReferenceImageRecord(projectId, uploaded.id, {
      label: reference.label,
      note: reference.note,
      sortOrder: index,
    });
  }
}

function buildSeedSectionViews(input: TrainingProjectCreateInput): LoraTrainingSection[] {
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

function buildTrainingProjectView(
  input: TrainingProjectCreateInput,
  projectId: string,
  selectedReferenceImages: LoraTrainingReferenceImage[],
  persistedSections: Awaited<ReturnType<typeof listTrainingProjectSections>> = [],
): LoraTrainingProject {
  const title = normalizeTrainingProjectTitle(input);
  const sections = persistedSections.length
    ? persistedSections.map((section) => ({
      id: section.id,
      title: section.name,
      enabled: section.status !== "paused",
      updatedAt: formatUpdatedAt(new Date(section.updatedAt)),
      blocks: [
        {
          id: `${section.id}-scene-block`,
          source: "本地" as const,
          title: "训练场景说明",
          text: section.template.description,
        },
      ],
      resolvedScene: section.template.description,
      imagePrompt: input.usagePrompt?.trim() || "生成干净、可训练的角色样本。",
      images: [],
      resultStatus: "pending" as const,
    }))
    : buildSeedSectionViews(input);
  const readiness = selectedReferenceImages.length > 0 ? "完整" : "待补";
  return {
    id: projectId,
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

export async function createTrainingProject(input: unknown) {
  const parsed = parseTrainingProjectCreateInput(input);
  const title = normalizeTrainingProjectTitle(parsed);
  const trainingTemplateId = normalizeTrainingTemplateId(parsed);
  const triggerToken = parsed.triggerToken?.trim() || buildTrainingProjectTriggerToken(title);
  const checkpointRelativePath = parsed.checkpointRelativePath?.trim();

  if (!checkpointRelativePath) {
    throw new TrainingProjectActionServiceError("checkpointRelativePath is required", 400);
  }

  const selectedReferenceImages = await deriveReferenceImages(parsed.selectedReferenceIds);

  try {
    const created = await createTrainingProductionProject({
      characterName: title,
      projectName: title,
      triggerToken,
      checkpointRelativePath,
      trainingTemplateId: trainingTemplateId || undefined,
      usagePrompt: parsed.usagePrompt,
      detailPrompt: parsed.detailPrompt,
    });

    if (parsed.sections.length > 0) {
      await replaceTrainingProjectSections(created.id, parsed.sections);
    }
    if (selectedReferenceImages.length > 0) {
      await syncSelectedReferenceImagesToTrainingProject(created.id, selectedReferenceImages);
    }
    const persistedSections = await listTrainingProjectSections(created.id);

    return buildTrainingProjectView(parsed, created.id, selectedReferenceImages, persistedSections);
  } catch (error) {
    if (error instanceof TrainingProjectActionServiceError) {
      throw error;
    }
    const mapped = mapTrainingProductionProjectError(error);
    throw new TrainingProjectActionServiceError(mapped.message, mapped.status, mapped.details);
  }
}

export async function updateTrainingProject(projectId: string, input: unknown) {
  return updateTrainingProductionProject(projectId, input);
}

export async function archiveTrainingProject(projectId: string) {
  return archiveTrainingProductionProject(projectId);
}

export async function restoreTrainingProject(projectId: string) {
  return restoreTrainingProductionProject(projectId);
}

export async function deleteTrainingProject(projectId: string) {
  return deleteTrainingProductionProject(projectId);
}

export async function getTrainingProjectProfile(projectId: string) {
  const [overview, promptCardVersions] = await Promise.all([
    getTrainingProductionProjectOverview(projectId),
    listTrainingPromptCardVersions(projectId),
  ]);
  const latestPromptCard = promptCardVersions.at(-1) ?? null;

  return {
    projectId,
    triggerToken: overview.job.triggerToken,
    characterName: overview.job.characterName,
    loraUsagePrompt: latestPromptCard?.finalPromptDraft ?? null,
    characterDetailPrompt: latestPromptCard
      ? JSON.stringify(
          {
            identityTraits: latestPromptCard.identityTraits,
            outfitTraits: latestPromptCard.outfitTraits,
            negativeTraits: latestPromptCard.negativeTraits,
          },
          null,
          2,
        )
      : null,
    promptCardVersionId: latestPromptCard?.id ?? null,
    sourceImageCount: overview.sourceImages.count,
    canonicalVersionId: overview.personaReference.currentCanonicalVersionId,
  };
}

export async function updateTrainingProjectProfile(
  projectId: string,
  input: {
    loraUsagePrompt?: string | null;
    characterDetailPrompt?: string | null;
    profileSummary?: string | null;
  },
) {
  const loraUsagePrompt = input.loraUsagePrompt?.trim() ?? "";
  const characterDetailPrompt = input.characterDetailPrompt?.trim() ?? "";
  const [job, promptCardVersions] = await Promise.all([
    getTrainingProductionProject(projectId),
    listTrainingPromptCardVersions(projectId),
  ]);
  const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId)
    ?? promptCardVersions.at(-1)
    ?? null;

  let detailPayload: {
    identityTraits?: Record<string, unknown>;
    outfitTraits?: Record<string, unknown>;
    negativeTraits?: unknown[] | null;
  } = {};

  if (characterDetailPrompt) {
    try {
      const parsed = JSON.parse(characterDetailPrompt);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new TrainingProjectActionServiceError("characterDetailPrompt must be a JSON object string", 400);
      }
      detailPayload = parsed as typeof detailPayload;
    } catch (error) {
      if (error instanceof TrainingProjectActionServiceError) throw error;
      throw new TrainingProjectActionServiceError("characterDetailPrompt must be a JSON object string", 400);
    }
  }

  return createTrainingPromptCardVersion(projectId, {
    canonicalVersionId: currentPromptCard?.canonicalVersionId ?? job.currentCanonicalVersionId ?? null,
    triggerToken: job.triggerToken,
    identityTraits: detailPayload.identityTraits ?? currentPromptCard?.identityTraits ?? {},
    outfitTraits: detailPayload.outfitTraits ?? currentPromptCard?.outfitTraits ?? {},
    negativeTraits: detailPayload.negativeTraits ?? currentPromptCard?.negativeTraits ?? null,
    finalPromptDraft: loraUsagePrompt || currentPromptCard?.finalPromptDraft || job.triggerToken,
    changeReason: "Updated via training profile API",
  });
}

export async function listTrainingProjectReferenceImages(projectId: string) {
  return listTrainingReferenceImagesForProject(projectId);
}

export async function uploadTrainingProjectReferenceImage(projectId: string, formData: FormData) {
  return uploadTrainingReferenceImage(projectId, formData);
}

export async function registerTrainingReferenceImageFromArtifact(projectId: string, input: unknown) {
  return registerTrainingReferenceImageFromArtifactInRepository(projectId, input);
}

export async function updateTrainingReferenceImage(imageId: string, input: Record<string, unknown>) {
  const sourceImage = await getTrainingReferenceImageRecord(imageId);
  const projectId = sourceImage?.jobId ?? null;
  if (!projectId) {
    throw new TrainingProjectActionServiceError("Training reference image not found", 404, { imageId });
  }
  return updateTrainingReferenceImageRecord(projectId, imageId, input);
}

export async function deleteTrainingReferenceImage(imageId: string) {
  const sourceImage = await getTrainingReferenceImageRecord(imageId);
  const projectId = sourceImage?.jobId ?? null;
  if (!projectId) {
    throw new TrainingProjectActionServiceError("Training reference image not found", 404, { imageId });
  }
  return deleteTrainingReferenceImageRecord(projectId, imageId);
}

export async function addTrainingReferenceImageToResults(imageId: string, input: Record<string, unknown> = {}) {
  const sourceImage = await getTrainingReferenceImageRecord(imageId);
  if (!sourceImage) {
    throw new TrainingProjectActionServiceError("Training reference image not found", 404, { imageId });
  }

  return registerTrainingReferenceImageAsResult({
    jobId: sourceImage.jobId,
    sourceImageId: imageId,
    reviewStatus: typeof input.reviewStatus === "string" ? input.reviewStatus : undefined,
    captionDraft: typeof input.captionDraft === "string" ? input.captionDraft : null,
  });
}

export async function freezeTrainingDataset(projectId: string, input: unknown = {}) {
  void input;
  return freezeTrainingProductionDataset(projectId);
}

export async function enqueueTrainingSectionGenerationRun(sectionId: string, input: unknown = {}) {
  const generationRun = await enqueueTrainingProductionSectionGenerationRun(sectionId, input);
  const project = await getTrainingProductionProject(generationRun.jobId);
  return {
    ...generationRun,
    kind: "generation" as const,
    projectId: generationRun.jobId,
    projectTitle: project.characterName,
  };
}

export async function enqueueTrainingRun(projectId: string, input: Record<string, unknown> = {}) {
  const revisionId = typeof input.revisionId === "string" && input.revisionId.trim() ? input.revisionId.trim() : null;
  const config = typeof input.config === "object" && input.config ? input.config : {};
  const enqueueInput = {
    ...input,
    ...(typeof config === "object" && config ? config : {}),
  };
  delete enqueueInput.revisionId;
  delete enqueueInput.config;

  const resolvedRevisionId = revisionId ?? await (async () => {
    const frozen = await freezeTrainingProductionDataset(projectId);
    if (!("revision" in frozen) || !frozen.revision?.id) {
      throw new TrainingProjectActionServiceError("Dataset freeze did not return a revision id", 409);
    }
    return frozen.revision.id;
  })();

  const trainingRun = await enqueueTrainingProductionRun(resolvedRevisionId, enqueueInput);
  return {
    ...trainingRun,
    kind: "training" as const,
    projectId: trainingRun.jobId,
  };
}

export async function cancelTrainingRun(trainingRunId: string, input: unknown = {}) {
  void input;
  return cancelTrainingProductionRun(trainingRunId);
}

export async function cancelTrainingGenerationRun(taskId: string, input: unknown = {}) {
  void input;
  const generationRun = await cancelTrainingProductionGenerationRun(taskId);
  return {
    ...generationRun,
    kind: "generation" as const,
  };
}

export function mapTrainingProjectError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return mapTrainingProductionProjectError(error);
}

export function mapTrainingProjectMutationError(error: unknown) {
  return mapTrainingProjectError(error);
}

export function mapTrainingProjectProfileError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return mapTrainingProjectError(error);
  }

  const promptCardMapped = mapTrainingPromptCardError(error);
  if (promptCardMapped.status !== 500 || promptCardMapped.message !== "Unexpected training prompt card error") {
    return promptCardMapped;
  }

  return mapTrainingProjectError(error);
}

export function mapTrainingReferenceImageMutationError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return mapTrainingProjectError(error);
  }

  return mapTrainingReferenceImageError(error);
}

export function mapTrainingGenerationRunMutationError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return mapTrainingProjectError(error);
  }

  return mapTrainingGenerationError(error);
}

export function mapTrainingRunMutationError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return mapTrainingProjectError(error);
  }

  return mapTrainingRunError(error);
}

export function mapTrainingRunCreationError(error: unknown) {
  if (error instanceof TrainingProjectActionServiceError) {
    return mapTrainingProjectError(error);
  }

  const trainingMapped = mapTrainingRunError(error);
  if (trainingMapped.status !== 400 || trainingMapped.message !== "Unexpected training run error") {
    return trainingMapped;
  }

  return mapTrainingGenerationError(error);
}
