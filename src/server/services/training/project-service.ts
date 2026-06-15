import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type {
  LoraTrainingDatasetRevision,
  LoraTrainingDatasetRevisionItem,
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingRun,
  LoraTrainingSection,
  TrainingImage,
} from "@/features/training/types";
import { toImageUrl } from "@/lib/image-url";
import {
  archiveLegacyTrainingProject,
  cancelLegacyTrainingGenerationRun,
  cancelLegacyTrainingRun,
  createLegacyTrainingPromptCardVersion,
  createLegacyTrainingProject,
  deleteLegacyTrainingReferenceImage,
  enqueueLegacyTrainingRun,
  enqueueLegacyTrainingSectionGenerationRun,
  freezeLegacyTrainingDataset,
  getLegacyTrainingCandidateImage,
  getLegacyTrainingProject,
  getLegacyTrainingProjectSection,
  getLegacyTrainingProjectOverview,
  getLegacyTrainingReferenceImage,
  getLegacyTrainingReferenceImageFromRepository,
  listLegacyTrainingPromptCardVersions,
  listLegacyTrainingReferenceImages,
  mapLegacyTrainingGenerationError,
  mapLegacyTrainingProjectError,
  mapLegacyTrainingPromptCardError,
  mapLegacyTrainingReferenceImageError,
  mapLegacyTrainingRunError,
  registerLegacyTrainingReferenceImageAsResult,
  registerLegacyTrainingReferenceImageFromArtifact,
  restoreLegacyTrainingProject,
  reviewLegacyTrainingImages,
  updateLegacyTrainingImageCaption,
  updateLegacyTrainingProject,
  updateLegacyTrainingReferenceImage,
  uploadLegacyTrainingReferenceImage,
} from "@/server/services/training/legacy-compat-service";
import { setTrainingProjectSectionCollection } from "@/server/services/training/project-section-service";
import { getManagedTrainingTemplate } from "@/server/services/training/template-service";
import { z } from "zod";

const TRAINING_PROJECT_FALLBACK_PATH = join(process.cwd(), "data", "training-projects.json");
const MANAGED_PROJECT_IMAGE_ROOT = join(process.cwd(), "data", "images", "training-managed");
const TRAINING_MANAGED_RUNS_PATH = join(process.cwd(), "data", "training-managed-runs.json");
let projectStoreWriteQueue: Promise<unknown> = Promise.resolve();
let runStoreWriteQueue: Promise<unknown> = Promise.resolve();

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

const managedProjectUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  characterName: z.string().trim().min(1).max(160).optional(),
  projectName: z.string().trim().min(1).max(160).optional(),
  usagePrompt: z.string().trim().max(20_000).optional(),
  detailPrompt: z.string().trim().max(20_000).optional(),
  profileSummary: z.string().trim().max(20_000).optional(),
}).strict();

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
  const tempPath = `${TRAINING_PROJECT_FALLBACK_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_PROJECT_FALLBACK_PATH);
}

async function withProjectStoreWriteLock<T>(fn: () => Promise<T>) {
  const next = projectStoreWriteQueue.then(fn, fn);
  projectStoreWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readFallbackTrainingRuns() {
  try {
    const raw = await readFile(TRAINING_MANAGED_RUNS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as LoraTrainingRun[];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return [] as LoraTrainingRun[];
}

async function writeFallbackTrainingRuns(runs: LoraTrainingRun[]) {
  await mkdir(dirname(TRAINING_MANAGED_RUNS_PATH), { recursive: true });
  const tempPath = `${TRAINING_MANAGED_RUNS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(runs, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_MANAGED_RUNS_PATH);
}

async function withRunStoreWriteLock<T>(fn: () => Promise<T>) {
  const next = runStoreWriteQueue.then(fn, fn);
  runStoreWriteQueue = next.then(() => undefined, () => undefined);
  return next;
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

function formatTimestamp(date = new Date(), prefix: "完成于" | "开始于" | "创建于" | "失败于" = "创建于") {
  return `${prefix} ${formatUpdatedAt(date)}`;
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

function buildManagedScopedId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID()}`;
}

function buildManagedUploadStem(safeName: string) {
  return `${Date.now()}-${randomUUID()}-${safeName}`;
}

function buildReferencePreviewImage(relativePath: string, label: string): TrainingImage | null {
  const url = toImageUrl(relativePath);
  if (!url) return null;
  return {
    id: buildManagedScopedId("managed-reference-preview"),
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

async function deriveReferenceImages(
  selectedReferenceIds: string[],
  sourceProjects: LoraTrainingProject[],
): Promise<LoraTrainingReferenceImage[]> {
  const results = sourceProjects.flatMap((project) => project.resultPool);
  const projects = sourceProjects;

  const picked: Array<LoraTrainingReferenceImage | null> = await Promise.all(selectedReferenceIds.map(async (referenceId) => {
    if (referenceId.startsWith("project-")) {
      const projectId = referenceId.slice("project-".length);
      const project = projects.find((item) => item.id === projectId);
      const image = project?.referenceImages[0]?.image;
      if (project && image) {
        return {
          id: `reference-${referenceId}`,
          kind: "auxiliary" as const,
          label: project.title,
          note: project.profileSummary,
          image,
        };
      }

      try {
        const [job, sourceImages] = await Promise.all([
          getLegacyTrainingProject(projectId),
          listLegacyTrainingReferenceImages(projectId),
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
      const result = results.find((item) => item.id === resultId);
      if (result) {
        return {
          id: `reference-${referenceId}`,
          kind: "generated" as const,
          label: result.sourceLabel,
          note: result.caption,
          image: result.image,
        };
      }

      try {
        const candidate = await getLegacyTrainingCandidateImage(resultId);
        if (!candidate) return null;
        const [job, section] = await Promise.all([
          getLegacyTrainingProject(candidate.jobId).catch(() => null),
          candidate.sectionId ? getLegacyTrainingProjectSection(candidate.sectionId).catch(() => null) : Promise.resolve(null),
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
  const seenRelativePaths = new Set<string>();

  for (const [index, reference] of selectedReferenceImages.entries()) {
    const relativePath = imageUrlToRelativePath(reference.image.full) ?? imageUrlToRelativePath(reference.image.src);

    if (!relativePath) {
      throw new TrainingProjectServiceError("Selected training reference image could not be resolved to a local file", 400, {
        projectId,
        referenceId: reference.id,
        src: reference.image.src,
      });
    }

    const dedupeKey = relativePath.toLowerCase();
    if (seenRelativePaths.has(dedupeKey)) {
      continue;
    }
    seenRelativePaths.add(dedupeKey);

    let buffer: Buffer;
    try {
      buffer = await readFile(join(process.cwd(), relativePath));
    } catch (error) {
      throw new TrainingProjectServiceError("Selected training reference image file was not found", 404, {
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

    const uploaded = await uploadLegacyTrainingReferenceImage(projectId, formData);
    await updateLegacyTrainingReferenceImage(projectId, uploaded.id, {
      label: reference.label,
      note: reference.note,
      sortOrder: index,
    });
  }
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

function nextManagedDatasetVersion(project: LoraTrainingProject) {
  const current = project.datasetRevisions[0]?.version ?? project.datasetVersion;
  const match = current.match(/v(\d+)/i);
  const nextVersion = match ? Number(match[1]) + 1 : 1;
  return `v${nextVersion}`;
}

function buildManagedDatasetSamples(project: LoraTrainingProject, revisionId: string): LoraTrainingDatasetRevisionItem[] {
  return project.resultPool
    .filter((result) => result.reviewStatus === "kept")
    .slice(0, 8)
    .map((result, index) => ({
      id: `${revisionId}-sample-${index + 1}`,
      label: String(index + 1).padStart(3, "0"),
      sectionTitle: result.sectionTitle,
      image: result.image,
      captionSnapshot: result.caption,
      filePathSnapshot: result.image.full,
    }));
}

export async function listManagedTrainingProjects() {
  return readFallbackTrainingProjects();
}

export async function listManagedTrainingRuns() {
  return readFallbackTrainingRuns();
}

function isActiveManagedTrainingRun(run: LoraTrainingRun) {
  return run.kind === "training" && (run.status === "queued" || run.status === "running");
}

export async function getManagedTrainingRun(runId: string) {
  const runs = await readFallbackTrainingRuns();
  return runs.find((run) => run.id === runId) ?? null;
}

export async function getManagedTrainingProject(projectId: string) {
  const projects = await readFallbackTrainingProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function updateManagedTrainingProject(projectId: string, input: unknown) {
  const result = managedProjectUpdateSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingProjectServiceError("Invalid training project update request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;
    const current = projects[currentIndex];
    const nextTitle =
      result.data.title?.trim()
      || result.data.characterName?.trim()
      || result.data.projectName?.trim()
      || current.title;
    const next = [...projects];
    next[currentIndex] = recomputeManagedProject({
      ...current,
      title: nextTitle,
      updatedAt: formatUpdatedAt(),
      usagePrompt: result.data.usagePrompt?.trim() ?? current.usagePrompt,
      detailPrompt: result.data.detailPrompt?.trim() ?? current.detailPrompt,
      profileSummary: result.data.profileSummary?.trim() ?? current.profileSummary,
    });
    await writeFallbackTrainingProjects(next);
    return next[currentIndex];
  });
}

export async function updateTrainingProject(projectId: string, input: unknown) {
  const managedProject = await updateManagedTrainingProject(projectId, input);
  if (managedProject) return managedProject;
  return updateLegacyTrainingProject(projectId, input);
}

export async function archiveManagedTrainingProject(projectId: string) {
  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;
    const current = projects[currentIndex];
    const next = [...projects];
    next[currentIndex] = {
      ...current,
      updatedAt: formatUpdatedAt(),
      status: "archived",
      recentTraining: current.recentTraining.includes("已归档") ? current.recentTraining : `${current.recentTraining} · 已归档`,
    };
    await writeFallbackTrainingProjects(next);
    return next[currentIndex];
  });
}

export async function archiveTrainingProject(projectId: string) {
  const managedProject = await archiveManagedTrainingProject(projectId);
  if (managedProject) return managedProject;
  return archiveLegacyTrainingProject(projectId);
}

export async function restoreManagedTrainingProject(projectId: string) {
  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;
    const current = projects[currentIndex];
    const next = [...projects];
    next[currentIndex] = recomputeManagedProject({
      ...current,
      updatedAt: formatUpdatedAt(),
      status: "ready",
      recentTraining: current.recentTraining.replace(/\s*·\s*已归档$/, ""),
    });
    await writeFallbackTrainingProjects(next);
    return next[currentIndex];
  });
}

export async function restoreTrainingProject(projectId: string) {
  const managedProject = await restoreManagedTrainingProject(projectId);
  if (managedProject) return managedProject;
  return restoreLegacyTrainingProject(projectId);
}

export async function deleteManagedTrainingProject(projectId: string) {
  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;

    const [deletedProject] = projects.splice(currentIndex, 1);
    await writeFallbackTrainingProjects(projects);

    await withRunStoreWriteLock(async () => {
      const runs = await readFallbackTrainingRuns();
      const nextRuns = runs.filter((run) => run.projectId !== projectId);
      await writeFallbackTrainingRuns(nextRuns);
    });

    await rm(join(MANAGED_PROJECT_IMAGE_ROOT, projectId), { force: true, recursive: true }).catch(() => {});

    return {
      deletedRunCount: deletedProject ? deletedProject.datasetRevisions.reduce((count, revision) => count + revision.relatedTrainingRunIds.length, 0) : 0,
      id: projectId,
      success: true,
    };
  });
}

async function findManagedProjectBySectionId(sectionId: string, projectId?: string | null) {
  const projects = await readFallbackTrainingProjects();
  const scopedProjects = projectId
    ? projects.filter((project) => project.id === projectId)
    : projects;
  for (const project of scopedProjects) {
    const section = project.sections.find((item) => item.id === sectionId);
    if (section) {
      return { project, section };
    }
  }
  return null;
}

export async function getManagedTrainingProjectProfile(projectId: string) {
  const project = await getManagedTrainingProject(projectId);
  if (!project) return null;
  return {
    projectId,
    triggerToken: buildTrainingProjectTriggerToken(project.title),
    characterName: project.title,
    loraUsagePrompt: project.usagePrompt,
    characterDetailPrompt: project.detailPrompt,
    profileSummary: project.profileSummary,
    promptCardVersionId: null,
    sourceImageCount: project.referenceImages.length,
    canonicalVersionId: null,
  };
}

export async function updateManagedTrainingProjectProfile(
  projectId: string,
  input: {
    loraUsagePrompt?: string | null;
    characterDetailPrompt?: string | null;
    profileSummary?: string | null;
  },
) {
  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;

    const current = projects[currentIndex];
    const next = [...projects];
    next[currentIndex] = {
      ...current,
      updatedAt: formatUpdatedAt(),
      usagePrompt: input.loraUsagePrompt?.trim() || current.usagePrompt,
      detailPrompt: input.characterDetailPrompt?.trim() || current.detailPrompt,
      profileSummary: input.profileSummary?.trim() || current.profileSummary,
    };
    await writeFallbackTrainingProjects(next);
    return next[currentIndex];
  });
}

export async function getTrainingProjectProfile(projectId: string) {
  const managedProfile = await getManagedTrainingProjectProfile(projectId);
  if (managedProfile) return managedProfile;

  const [overview, promptCardVersions] = await Promise.all([
    getLegacyTrainingProjectOverview(projectId),
    listLegacyTrainingPromptCardVersions(projectId),
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
  const managedProfile = await getManagedTrainingProjectProfile(projectId);
  if (managedProfile) {
    const data = await updateManagedTrainingProjectProfile(projectId, input);
    if (!data) {
      throw new TrainingProjectServiceError("Training project profile not found", 404, { projectId });
    }
    return data;
  }

  const loraUsagePrompt = input.loraUsagePrompt?.trim() ?? "";
  const characterDetailPrompt = input.characterDetailPrompt?.trim() ?? "";
  const [job, promptCardVersions] = await Promise.all([
    getLegacyTrainingProject(projectId),
    listLegacyTrainingPromptCardVersions(projectId),
  ]);
  const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;

  let detailPayload: {
    identityTraits?: Record<string, unknown>;
    outfitTraits?: Record<string, unknown>;
    negativeTraits?: unknown[] | null;
  } = {};

  if (characterDetailPrompt) {
    try {
      const parsed = JSON.parse(characterDetailPrompt);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new TrainingProjectServiceError("characterDetailPrompt must be a JSON object string", 400);
      }
      detailPayload = parsed as typeof detailPayload;
    } catch (error) {
      if (error instanceof TrainingProjectServiceError) throw error;
      throw new TrainingProjectServiceError("characterDetailPrompt must be a JSON object string", 400);
    }
  }

  return createLegacyTrainingPromptCardVersion(projectId, {
    canonicalVersionId: currentPromptCard?.canonicalVersionId ?? job.currentCanonicalVersionId ?? null,
    triggerToken: job.triggerToken,
    identityTraits: detailPayload.identityTraits ?? currentPromptCard?.identityTraits ?? {},
    outfitTraits: detailPayload.outfitTraits ?? currentPromptCard?.outfitTraits ?? {},
    negativeTraits: detailPayload.negativeTraits ?? currentPromptCard?.negativeTraits ?? null,
    finalPromptDraft: loraUsagePrompt || currentPromptCard?.finalPromptDraft || job.triggerToken,
    changeReason: "Updated via training profile API",
  });
}

function recomputeManagedProject(project: LoraTrainingProject): LoraTrainingProject {
  const keptCount = project.resultPool.filter((result) => result.reviewStatus === "kept").length;
  const captionMissingCount = project.resultPool.filter((result) => !result.caption?.trim()).length;
  const images = project.resultPool.length > 0
    ? project.resultPool.map((result) => result.image).slice(0, 8)
    : project.referenceImages.map((reference) => reference.image).slice(0, 8);
  const readiness = project.referenceImages.length > 0 && project.usagePrompt.trim() && project.detailPrompt.trim() ? "完整" : "待补";
  return {
    ...project,
    readiness,
    status: readiness === "完整" ? (project.status === "archived" ? "archived" : "ready") : "draft",
    keptCount,
    captionMissingCount,
    imageCount: project.resultPool.length,
    images,
  };
}

function sanitizeManagedUploadName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "reference";
}

function isFileLike(
  value: unknown,
): value is { name: string; arrayBuffer(): Promise<ArrayBuffer> } {
  return Boolean(
    value
    && typeof value === "object"
    && "name" in value
    && typeof (value as { name?: unknown }).name === "string"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

function buildManagedReferenceImage(relativePath: string, label: string, note: string, index: number): LoraTrainingReferenceImage {
  const url = toImageUrl(relativePath) ?? "";
  return {
    id: buildManagedScopedId(`managed-reference-${index + 1}`),
    kind: index === 0 ? "original" : "auxiliary",
    label,
    note,
    image: {
      id: buildManagedScopedId(`managed-reference-image-${index + 1}`),
      src: url,
      full: url,
      label,
      status: "pending",
      featured: index === 0,
      featured2: false,
      cover: index === 0,
      width: null,
      height: null,
    },
  };
}

function buildManagedResultImage(relativePath: string, label: string) {
  const url = toImageUrl(relativePath) ?? "";
  return {
    id: buildManagedScopedId("managed-result-image"),
    src: url,
    full: url,
    label,
    status: "pending" as const,
    featured: false,
    featured2: false,
    cover: false,
    width: null,
    height: null,
  };
}

function buildManagedRunInputImage(relativePath: string, label: string, index: number): TrainingImage {
  const url = toImageUrl(relativePath) ?? "";
  return {
    id: buildManagedScopedId(`managed-run-input-${index + 1}`),
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

export async function listManagedTrainingProjectReferenceImages(projectId: string) {
  const project = await getManagedTrainingProject(projectId);
  return project ? project.referenceImages : null;
}

export async function listTrainingProjectReferenceImages(projectId: string) {
  const managedImages = await listManagedTrainingProjectReferenceImages(projectId);
  if (managedImages) return managedImages;
  return listLegacyTrainingReferenceImages(projectId);
}

export async function uploadManagedTrainingImageResult(projectId: string, formData: FormData) {
  const project = await getManagedTrainingProject(projectId);
  if (!project) return null;

  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingProjectServiceError("file is required", 400);
  }

  const safeName = sanitizeManagedUploadName(file.name);
  const extension = extname(file.name).toLowerCase() || ".png";
  const uploadStem = buildManagedUploadStem(safeName);
  const relativePath = `data/images/training-managed/${projectId}/results/${uploadStem}${extension}`;
  const absolutePath = join(MANAGED_PROJECT_IMAGE_ROOT, projectId, "results", `${uploadStem}${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const sectionIdInput = typeof formData.get("sectionId") === "string" ? String(formData.get("sectionId")).trim() : "";
  const matchedSection = project.sections.find((section) => section.id === sectionIdInput) ?? project.sections[0] ?? null;
  const reviewStatus = typeof formData.get("reviewStatus") === "string" ? String(formData.get("reviewStatus")) : "pending";
  const captionDraft = typeof formData.get("captionDraft") === "string"
    ? String(formData.get("captionDraft")).trim()
    : typeof formData.get("supplementalPrompt") === "string"
      ? String(formData.get("supplementalPrompt")).trim()
      : "";
  const label = file.name.replace(/\.[^.]+$/, "") || `上传结果 ${project.resultPool.length + 1}`;
  const nextResult: LoraTrainingImageResult = {
    id: buildManagedScopedId("managed-upload-result"),
    sectionId: matchedSection?.id ?? "manual-upload",
    sectionTitle: matchedSection?.title ?? "手动上传",
    image: buildManagedResultImage(relativePath, label),
    reviewStatus: reviewStatus === "keep" ? "kept" : reviewStatus === "reject" ? "rejected" : "pending",
    caption: captionDraft || "未填写说明文本",
    sourceLabel: label,
  };

  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((item) => item.id === projectId);
    if (currentIndex === -1) return null;
    const next = [...projects];
    next[currentIndex] = recomputeManagedProject({
      ...projects[currentIndex],
      updatedAt: formatUpdatedAt(),
      resultPool: [nextResult, ...projects[currentIndex].resultPool],
    });
    await writeFallbackTrainingProjects(next);
    return next[currentIndex].resultPool.find((result) => result.id === nextResult.id) ?? null;
  });
}

export async function uploadManagedTrainingProjectReferenceImage(projectId: string, formData: FormData) {
  const project = await getManagedTrainingProject(projectId);
  if (!project) return null;

  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingProjectServiceError("file is required", 400);
  }

  const role = typeof formData.get("role") === "string" ? String(formData.get("role")) : "source";
  const safeName = sanitizeManagedUploadName(file.name);
  const extension = extname(file.name).toLowerCase() || ".png";
  const uploadStem = buildManagedUploadStem(safeName);
  const relativePath = `data/images/training-managed/${projectId}/references/${uploadStem}${extension}`;
  const absolutePath = join(MANAGED_PROJECT_IMAGE_ROOT, projectId, "references", `${uploadStem}${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const reference = buildManagedReferenceImage(
    relativePath,
    file.name.replace(/\.[^.]+$/, "") || `参考图 ${project.referenceImages.length + 1}`,
    role,
    project.referenceImages.length,
  );

  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((item) => item.id === projectId);
    if (currentIndex === -1) return null;
    const next = [...projects];
    next[currentIndex] = recomputeManagedProject({
      ...projects[currentIndex],
      updatedAt: formatUpdatedAt(),
      referenceImages: [...projects[currentIndex].referenceImages, reference],
    });
    await writeFallbackTrainingProjects(next);

    return {
      id: reference.id,
      role,
      relativePath,
      provenance: {
        originalName: file.name,
      },
    };
  });
}

export async function uploadTrainingProjectReferenceImage(projectId: string, formData: FormData) {
  const managedUpload = await uploadManagedTrainingProjectReferenceImage(projectId, formData);
  if (managedUpload) return managedUpload;
  return uploadLegacyTrainingReferenceImage(projectId, formData);
}

export async function registerTrainingReferenceImageFromArtifact(projectId: string, input: unknown) {
  return registerLegacyTrainingReferenceImageFromArtifact(projectId, input);
}

async function findManagedReferenceOwner(imageId: string) {
  const projects = await readFallbackTrainingProjects();
  for (const project of projects) {
    const reference = project.referenceImages.find((item) => item.id === imageId);
    if (reference) {
      return { project, reference, projects };
    }
  }
  return null;
}

async function findManagedResultOwner(imageResultId: string) {
  const projects = await readFallbackTrainingProjects();
  for (const project of projects) {
    const result = project.resultPool.find((item) => item.id === imageResultId);
    if (result) {
      return { project, result, projects };
    }
  }
  return null;
}

export async function getManagedTrainingImageResult(imageResultId: string) {
  const owner = await findManagedResultOwner(imageResultId);
  return owner?.result ?? null;
}

export async function getManagedTrainingImageResultContext(imageResultId: string) {
  const owner = await findManagedResultOwner(imageResultId);
  if (!owner) return null;
  return {
    project: owner.project,
    result: owner.result,
  };
}

function normalizeManagedReferenceKind(value: string | undefined, fallback: LoraTrainingReferenceImage["kind"]) {
  if (value === "original" || value === "generated" || value === "auxiliary") {
    return value;
  }
  return fallback;
}

export async function updateManagedTrainingReferenceImage(
  imageId: string,
  input: {
    kind?: string | null;
    label?: string | null;
    note?: string | null;
  },
) {
  const owner = await findManagedReferenceOwner(imageId);
  if (!owner) return null;

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedReferenceOwner(imageId);
    if (!refreshed) return null;

    const nextProjects = refreshed.projects.map((project) => {
      if (project.id !== refreshed.project.id) return project;

      return recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        referenceImages: project.referenceImages.map((reference) => reference.id === imageId
          ? {
            ...reference,
            kind: normalizeManagedReferenceKind(typeof input.kind === "string" ? input.kind : undefined, reference.kind),
            label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : reference.label,
            note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : reference.note,
          }
          : reference),
      });
    });

    await writeFallbackTrainingProjects(nextProjects);

    return nextProjects
      .find((project) => project.id === refreshed.project.id)
      ?.referenceImages.find((reference) => reference.id === imageId) ?? null;
  });
}

export async function updateTrainingReferenceImage(imageId: string, input: Record<string, unknown>) {
  const managedImage = await updateManagedTrainingReferenceImage(imageId, {
    kind: typeof input.kind === "string" ? input.kind : null,
    label: typeof input.label === "string" ? input.label : null,
    note: typeof input.note === "string" ? input.note : null,
  });
  if (managedImage) return managedImage;

  const sourceImage = await getLegacyTrainingReferenceImageFromRepository(imageId).catch(() => null);
  const productionProjectId = sourceImage?.jobId ?? null;
  if (!productionProjectId) {
    throw new TrainingProjectServiceError("Training reference image not found", 404, { imageId });
  }
  return updateLegacyTrainingReferenceImage(productionProjectId, imageId, input);
}

export async function applyManagedTrainingImageResultToReferenceImage(
  imageResultId: string,
  input: {
    kind?: string | null;
    label?: string | null;
    note?: string | null;
    targetProjectId?: string | null;
  } = {},
) {
  const owner = await findManagedResultOwner(imageResultId);
  if (!owner) return null;

  if (input.targetProjectId && input.targetProjectId !== owner.project.id) {
    throw new TrainingProjectServiceError("Managed generation output does not belong to the target project", 409, {
      imageResultId,
      projectId: owner.project.id,
      targetProjectId: input.targetProjectId,
    });
  }

  const referenceId = `managed-reference-from-output-${imageResultId}`;
  const existing = owner.project.referenceImages.find((reference) =>
    reference.id === referenceId || reference.image.full === owner.result.image.full,
  );
  if (existing) {
    return {
      created: false,
      reference: existing,
      projectId: owner.project.id,
    };
  }

  const nextReference: LoraTrainingReferenceImage = {
    id: referenceId,
    kind: normalizeManagedReferenceKind(typeof input.kind === "string" ? input.kind : undefined, "generated"),
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : owner.result.sourceLabel,
    note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : owner.result.caption,
    image: owner.result.image,
  };

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedResultOwner(imageResultId);
    if (!refreshed) return null;
    const refreshedExisting = refreshed.project.referenceImages.find((reference) =>
      reference.id === referenceId || reference.image.full === refreshed.result.image.full,
    );
    if (refreshedExisting) {
      return {
        created: false,
        reference: refreshedExisting,
        projectId: refreshed.project.id,
      };
    }

    const nextProjects = refreshed.projects.map((project) => project.id === refreshed.project.id
      ? recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        referenceImages: [...project.referenceImages, nextReference],
      })
      : project);
    await writeFallbackTrainingProjects(nextProjects);

    return {
      created: true,
      projectId: refreshed.project.id,
      reference: nextProjects
        .find((project) => project.id === refreshed.project.id)
        ?.referenceImages.find((reference) => reference.id === nextReference.id) ?? nextReference,
    };
  });
}

export async function deleteManagedTrainingReferenceImage(imageId: string) {
  const owner = await findManagedReferenceOwner(imageId);
  if (!owner) return null;

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedReferenceOwner(imageId);
    if (!refreshed) return null;

    const nextProjects = refreshed.projects.map((project) => {
      if (project.id !== refreshed.project.id) return project;

      return recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        referenceImages: project.referenceImages.filter((reference) => reference.id !== imageId),
      });
    });
    await writeFallbackTrainingProjects(nextProjects);

    return {
      id: imageId,
      success: true,
    };
  });
}

export async function deleteTrainingReferenceImage(imageId: string) {
  const managedImage = await deleteManagedTrainingReferenceImage(imageId);
  if (managedImage) return managedImage;

  const sourceImage = await getLegacyTrainingReferenceImageFromRepository(imageId).catch(() => null);
  const productionProjectId = sourceImage?.jobId ?? null;
  if (!productionProjectId) {
    throw new TrainingProjectServiceError("Training reference image not found", 404, { imageId });
  }
  return deleteLegacyTrainingReferenceImage(productionProjectId, imageId);
}

export async function addManagedTrainingReferenceImageToResults(
  imageId: string,
  input: { reviewStatus?: string; captionDraft?: string | null } = {},
) {
  const owner = await findManagedReferenceOwner(imageId);
  if (!owner) return null;

  const existing = owner.project.resultPool.find((result) => result.id === `managed-result-${imageId}`);
  const nextResult: LoraTrainingImageResult = existing ?? {
    id: `managed-result-${imageId}`,
    sectionId: "managed-reference-images",
    sectionTitle: "角色资料",
    image: owner.reference.image,
    reviewStatus: input.reviewStatus === "keep" ? "kept" : input.reviewStatus === "reject" ? "rejected" : "pending",
    caption: input.captionDraft ?? owner.reference.note ?? "未填写说明文本",
    sourceLabel: owner.reference.label,
  };

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedReferenceOwner(imageId);
    if (!refreshed) return null;
    const refreshedExisting = refreshed.project.resultPool.find((result) => result.id === `managed-result-${imageId}`);
    const refreshedPool = refreshedExisting
      ? refreshed.project.resultPool.map((result) => result.id === refreshedExisting.id ? nextResult : result)
      : [...refreshed.project.resultPool, nextResult];
    const nextProjects = refreshed.projects.map((project) => project.id === refreshed.project.id
      ? recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        resultPool: refreshedPool,
      })
      : project);
    await writeFallbackTrainingProjects(nextProjects);
    return nextResult;
  });
}

export async function addTrainingReferenceImageToResults(imageId: string, input: Record<string, unknown> = {}) {
  const managedResult = await addManagedTrainingReferenceImageToResults(imageId, {
    reviewStatus: typeof input.reviewStatus === "string" ? input.reviewStatus : undefined,
    captionDraft: typeof input.captionDraft === "string" ? input.captionDraft : null,
  });
  if (managedResult) return managedResult;

  const sourceImage = await getLegacyTrainingReferenceImage(imageId);
  if (!sourceImage) {
    throw new TrainingProjectServiceError("Training reference image not found", 404, { imageId });
  }

  return registerLegacyTrainingReferenceImageAsResult({
    jobId: sourceImage.jobId,
    sourceImageId: imageId,
    reviewStatus: typeof input.reviewStatus === "string" ? input.reviewStatus as never : undefined,
    captionDraft: typeof input.captionDraft === "string" ? input.captionDraft : null,
  });
}

export async function updateManagedTrainingImageResult(
  imageResultId: string,
  input: { reviewStatus?: string; captionDraft?: string | null },
) {
  const owner = await findManagedResultOwner(imageResultId);
  if (!owner) return null;

  const nextReviewStatus = input.reviewStatus === "keep"
    ? "kept"
    : input.reviewStatus === "reject"
      ? "rejected"
      : input.reviewStatus === "pending"
        ? "pending"
        : owner.result.reviewStatus;
  const nextCaption = typeof input.captionDraft === "string" ? input.captionDraft : owner.result.caption;

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedResultOwner(imageResultId);
    if (!refreshed) return null;
    const nextProjects = refreshed.projects.map((project) => project.id === refreshed.project.id
      ? recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        resultPool: project.resultPool.map((result) => result.id === imageResultId
          ? {
            ...result,
            reviewStatus: nextReviewStatus,
            caption: nextCaption,
          }
          : result),
      })
      : project);
    await writeFallbackTrainingProjects(nextProjects);

    return nextProjects
      .find((project) => project.id === refreshed.project.id)
      ?.resultPool.find((result) => result.id === imageResultId) ?? null;
  });
}

export async function updateTrainingImageResult(
  imageResultId: string,
  input: { reviewStatus?: string; captionDraft?: string | null },
) {
  const managedResult = await updateManagedTrainingImageResult(imageResultId, input);
  if (managedResult) return managedResult;

  const operations: unknown[] = [];
  if (typeof input.captionDraft === "string") {
    operations.push(updateLegacyTrainingImageCaption(imageResultId, { captionDraft: input.captionDraft }));
  }
  if (typeof input.reviewStatus === "string") {
    operations.push(reviewLegacyTrainingImages({
      images: [
        {
          imageId: imageResultId,
          reviewStatus: input.reviewStatus,
        },
      ],
    }));
  }
  if (operations.length === 0) {
    throw new TrainingProjectServiceError("At least one supported field is required", 400, {
      supportedFields: ["captionDraft", "reviewStatus"],
    });
  }

  const data = await Promise.all(operations);
  return data.length === 1 ? data[0] : data;
}

export async function reviewTrainingImageResult(imageResultId: string, input: { reviewStatus?: unknown }) {
  const reviewStatus = typeof input.reviewStatus === "string" ? input.reviewStatus : undefined;
  const managedResult = await updateManagedTrainingImageResult(imageResultId, { reviewStatus });
  if (managedResult) return managedResult;
  return reviewLegacyTrainingImages({
    images: [
      {
        imageId: imageResultId,
        reviewStatus: input.reviewStatus,
      },
    ],
  });
}

export async function deleteManagedTrainingImageResult(imageResultId: string) {
  const owner = await findManagedResultOwner(imageResultId);
  if (!owner) return null;

  return withProjectStoreWriteLock(async () => {
    const refreshed = await findManagedResultOwner(imageResultId);
    if (!refreshed) return null;

    const nextProjects = refreshed.projects.map((project) => {
      if (project.id !== refreshed.project.id) return project;

      return recomputeManagedProject({
        ...project,
        updatedAt: formatUpdatedAt(),
        resultPool: project.resultPool.filter((result) => result.id !== imageResultId),
      });
    });
    await writeFallbackTrainingProjects(nextProjects);

    return {
      id: imageResultId,
      success: true,
    };
  });
}

export async function freezeManagedTrainingDataset(projectId: string) {
  return withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((project) => project.id === projectId);
    if (currentIndex === -1) return null;

    const current = projects[currentIndex];
    const keptResults = current.resultPool.filter((result) => result.reviewStatus === "kept");
    if (keptResults.length === 0) {
      throw new TrainingProjectServiceError("Managed training dataset is not ready", 409, {
        projectId,
        reason: "no_kept_results",
      });
    }

    const revisionId = buildManagedScopedId("managed-revision");
    const version = nextManagedDatasetVersion(current);
    const samples = buildManagedDatasetSamples(current, revisionId);
    const revision: LoraTrainingDatasetRevision = {
      id: revisionId,
      version,
      status: "ready",
      createdAt: formatUpdatedAt(),
      itemCount: keptResults.length,
      captionMissingCount: keptResults.filter((result) => !result.caption?.trim()).length,
      manifestName: `managed_${version}.jsonl`,
      samples,
      manifestRows: samples.map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
      relatedTrainingRunIds: [],
    };

    const next = [...projects];
    next[currentIndex] = recomputeManagedProject({
      ...current,
      updatedAt: formatUpdatedAt(),
      datasetVersion: version,
      datasetRevisions: [revision, ...current.datasetRevisions],
    });
    await writeFallbackTrainingProjects(next);

    return {
      revision,
    };
  });
}

export async function freezeTrainingDataset(projectId: string, input: unknown = {}) {
  const managedRevision = await freezeManagedTrainingDataset(projectId);
  if (managedRevision) return managedRevision;
  return freezeLegacyTrainingDataset(projectId, input);
}

export async function enqueueManagedTrainingSectionGenerationRun(
  sectionId: string,
  input: Record<string, unknown> = {},
) {
  const scopedProjectId = typeof input.projectId === "string" && input.projectId.trim()
    ? input.projectId.trim()
    : null;
  const match = await findManagedProjectBySectionId(sectionId, scopedProjectId);
  if (!match) return null;

  const selectedSourceIds = Array.isArray(input.sourceImageIds) ? input.sourceImageIds.filter((id): id is string => typeof id === "string") : [];
  const selectedResultIds = Array.isArray(input.previousCandidateImageIds) ? input.previousCandidateImageIds.filter((id): id is string => typeof id === "string") : [];
  const supplementalImages = Array.isArray(input.supplementalImages)
    ? input.supplementalImages
      .map((image, index) => {
        if (!image || typeof image !== "object") return null;
        const relativePath = typeof (image as { relativePath?: unknown }).relativePath === "string"
          ? (image as { relativePath: string }).relativePath
          : null;
        if (!relativePath) return null;
        const label = typeof (image as { title?: unknown }).title === "string" && (image as { title: string }).title.trim()
          ? (image as { title: string }).title.trim()
          : `补充图片 ${index + 1}`;
        return buildManagedRunInputImage(relativePath, label, index);
      })
      .filter((image): image is TrainingImage => Boolean(image))
    : [];
  const inputImages = [
    ...match.project.referenceImages.filter((reference) => selectedSourceIds.includes(reference.id)).map((reference) => reference.image),
    ...match.project.resultPool.filter((result) => selectedResultIds.includes(result.id)).map((result) => result.image),
    ...supplementalImages,
  ];

  const run: LoraTrainingRun = {
    id: buildManagedScopedId("managed-generation"),
    kind: "generation",
    status: "queued",
    projectId: match.project.id,
    sectionId: match.section.id,
    projectTitle: match.project.title,
    title: `${match.section.title} 图片生成`,
    summary: "图片 · 手动创建",
    timestamp: formatTimestamp(new Date(), "创建于"),
    provider: "本地任务",
    finalInput: typeof input.userInstruction === "string" ? input.userInstruction : "",
    schedulerMessage: "等待生成队列处理",
    inputImages,
  };

  await withRunStoreWriteLock(async () => {
    const runs = await readFallbackTrainingRuns();
    await writeFallbackTrainingRuns([run, ...runs]);
  });

  return run;
}

export async function enqueueTrainingSectionGenerationRun(sectionId: string, input: unknown = {}) {
  const managedInput = typeof input === "object" && input ? input as Record<string, unknown> : {};
  const managedRun = await enqueueManagedTrainingSectionGenerationRun(sectionId, managedInput);
  if (managedRun) return managedRun;
  return enqueueLegacyTrainingSectionGenerationRun(sectionId, input);
}

export async function enqueueManagedTrainingRun(
  projectId: string,
  input: Record<string, unknown> = {},
) {
  const project = await getManagedTrainingProject(projectId);
  if (!project) return null;

  let revisionId = typeof input.revisionId === "string" && input.revisionId.trim() ? input.revisionId.trim() : null;
  let workingProject = project;

  if (!revisionId) {
    const frozen = await freezeManagedTrainingDataset(projectId);
    if (!frozen?.revision?.id) {
      throw new TrainingProjectServiceError("Managed training dataset is not ready", 409, { projectId });
    }
    revisionId = frozen.revision.id;
    workingProject = (await getManagedTrainingProject(projectId)) ?? project;
  }

  const revision = workingProject.datasetRevisions.find((item) => item.id === revisionId);
  if (!revision) {
    throw new TrainingProjectServiceError("Managed training dataset revision not found", 404, { projectId, revisionId });
  }

  const targetSteps = Number(
    (input.config as Record<string, unknown> | undefined)?.overrides
      && typeof (input.config as Record<string, unknown>).overrides === "object"
      ? ((input.config as {
        overrides?: { ordinary?: { targetSteps?: number } };
      }).overrides?.ordinary?.targetSteps ?? 2400)
      : 2400,
  );

  const run: LoraTrainingRun = {
    id: buildManagedScopedId("managed-training"),
    kind: "training",
    status: "queued",
    projectId,
    projectTitle: workingProject.title,
    title: `数据集版本 ${revision.version}`,
    summary: `数据集 ${revision.version}`,
    timestamp: formatTimestamp(new Date(), "创建于"),
    provider: "本地训练",
    datasetRevisionId: revision.id,
    schedulerMessage: "等待训练队列处理",
    targetSteps,
    trainingConfig: [
      { label: "目标步数", value: String(targetSteps) },
      { label: "数据集版本", value: revision.version },
    ],
    datasetSamples: revision.samples.map((sample) => ({
      id: sample.id,
      label: sample.label,
      sectionTitle: sample.sectionTitle,
      image: sample.image,
      caption: sample.captionSnapshot,
      status: "kept",
    })),
  };

  await withRunStoreWriteLock(async () => {
    const runs = await readFallbackTrainingRuns();
    const activeRun = runs.find((existingRun) => existingRun.projectId === projectId && isActiveManagedTrainingRun(existingRun));
    if (activeRun) {
      throw new TrainingProjectServiceError("Training project already has an active training run", 409, {
        projectId,
        activeRunId: activeRun.id,
        status: activeRun.status,
      });
    }
    await writeFallbackTrainingRuns([run, ...runs]);
  });

  await withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const currentIndex = projects.findIndex((item) => item.id === projectId);
    if (currentIndex !== -1) {
      const current = projects[currentIndex];
      const nextRevisions = current.datasetRevisions.map((item) => item.id === revision.id
        ? { ...item, relatedTrainingRunIds: [run.id, ...item.relatedTrainingRunIds] }
        : item);
      const next = [...projects];
      next[currentIndex] = {
        ...current,
        updatedAt: formatUpdatedAt(),
        recentTraining: `排队中 · ${revision.version}`,
        datasetVersion: revision.version,
        datasetRevisions: nextRevisions,
      };
      await writeFallbackTrainingProjects(next);
    }
  });

  return run;
}

export async function enqueueTrainingRun(projectId: string, input: Record<string, unknown> = {}) {
  const managedRun = await enqueueManagedTrainingRun(projectId, input);
  if (managedRun) return managedRun;

  const revisionId = typeof input.revisionId === "string" && input.revisionId.trim() ? input.revisionId.trim() : null;
  const config = typeof input.config === "object" && input.config ? input.config : {};
  const enqueueInput = {
    ...input,
    ...(typeof config === "object" && config ? config : {}),
  };
  delete enqueueInput.revisionId;
  delete enqueueInput.config;

  const resolvedRevisionId = revisionId ?? await (async () => {
    const frozen = await freezeLegacyTrainingDataset(projectId, {});
    if (!("revision" in frozen) || !frozen.revision?.id) {
      throw new TrainingProjectServiceError("Dataset freeze did not return a revision id", 409);
    }
    return frozen.revision.id;
  })();

  return enqueueLegacyTrainingRun(resolvedRevisionId, enqueueInput);
}

export async function cancelManagedTrainingRun(trainingRunId: string) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === trainingRunId && run.kind === "training");
  if (!currentRun) return null;

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === trainingRunId && run.kind === "training"
        ? {
          ...run,
          status: "failed" as const,
          errorMessage: "训练任务已取消",
          schedulerMessage: "训练任务已取消",
          timestamp: formatTimestamp(new Date(), "失败于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === trainingRunId) ?? null;
  });
}

export async function cancelTrainingRun(trainingRunId: string, input: unknown = {}) {
  const managedRun = await cancelManagedTrainingRun(trainingRunId);
  if (managedRun) return managedRun;
  return cancelLegacyTrainingRun(trainingRunId, input);
}

export async function cancelManagedGenerationRun(taskId: string) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === taskId && run.kind === "generation");
  if (!currentRun) return null;

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === taskId && run.kind === "generation"
        ? {
          ...run,
          status: "failed" as const,
          errorMessage: "生成任务已取消",
          schedulerMessage: "生成任务已取消",
          timestamp: formatTimestamp(new Date(), "失败于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === taskId) ?? null;
  });
}

export async function cancelTrainingGenerationRun(taskId: string, input: unknown = {}) {
  const managedRun = await cancelManagedGenerationRun(taskId);
  if (managedRun) return managedRun;
  return cancelLegacyTrainingGenerationRun(taskId, input);
}

export async function tickManagedTrainingScheduler() {
  return withRunStoreWriteLock(async () => {
    const runs = await readFallbackTrainingRuns();
    const queuedIndex = [...runs].map((run, index) => ({ run, index })).reverse().find(({ run }) => run.status === "queued");
    if (!queuedIndex) return null;

    const nextRuns = [...runs];
    const current = nextRuns[queuedIndex.index];
    nextRuns[queuedIndex.index] = {
      ...current,
      status: "running",
      progress: 0,
      currentStep: current.kind === "training" ? 0 : current.currentStep,
      schedulerMessage: current.kind === "training" ? "训练任务执行中" : "生成任务执行中",
      timestamp: formatTimestamp(new Date(), "开始于"),
    };
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns[queuedIndex.index];
  });
}

export async function completeManagedGenerationRun(taskId: string, input: {
  resultImageResultId?: string | null;
  captionDraft?: string | null;
  reviewStatus?: string | null;
}) {
  const runs = await readFallbackTrainingRuns();
  const run = runs.find((candidate) => candidate.id === taskId && candidate.kind === "generation");
  if (!run) return null;

  let outputResultId = typeof input.resultImageResultId === "string" && input.resultImageResultId.trim()
    ? input.resultImageResultId.trim()
    : null;

  await withProjectStoreWriteLock(async () => {
    const projects = await readFallbackTrainingProjects();
    const projectIndex = projects.findIndex((project) => project.id === run.projectId);
    if (projectIndex === -1) return;
    const project = projects[projectIndex];

    if (!outputResultId) {
      const sourceImage = project.referenceImages[0]?.image ?? project.images[0] ?? project.resultPool[0]?.image;
      if (sourceImage) {
        const nextResult: LoraTrainingImageResult = {
          id: buildManagedScopedId("managed-worker-result"),
          sectionId: run.sectionId ?? "managed-worker",
          sectionTitle: project.sections.find((section) => section.id === run.sectionId)?.title ?? "生成结果",
          image: sourceImage,
          reviewStatus: input.reviewStatus === "keep" ? "kept" : input.reviewStatus === "reject" ? "rejected" : "pending",
          caption: typeof input.captionDraft === "string" && input.captionDraft.trim() ? input.captionDraft.trim() : "生成任务结果",
          sourceLabel: run.title,
        };
        outputResultId = nextResult.id;
        projects[projectIndex] = recomputeManagedProject({
          ...project,
          updatedAt: formatUpdatedAt(),
          resultPool: [nextResult, ...project.resultPool],
        });
        await writeFallbackTrainingProjects(projects);
      }
      return;
    }

    if (!project.resultPool.some((result) => result.id === outputResultId)) {
      throw new TrainingProjectServiceError("Managed generation result not found", 404, {
        resultImageResultId: outputResultId,
        taskId,
      });
    }
  });

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((candidate) => (
      candidate.id === taskId && candidate.kind === "generation"
        ? {
          ...candidate,
          status: "completed" as const,
          progress: 100,
          outputLabel: outputResultId ? "输出 1 张图片" : candidate.outputLabel,
          outputResultIds: outputResultId ? [outputResultId] : candidate.outputResultIds,
          schedulerMessage: "生成任务已完成",
          timestamp: formatTimestamp(new Date(), "完成于"),
        }
        : candidate
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((candidate) => candidate.id === taskId) ?? null;
  });
}

export async function failManagedGenerationRun(taskId: string, input: { errorSummary?: string | null }) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === taskId && run.kind === "generation");
  if (!currentRun) return null;

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === taskId && run.kind === "generation"
        ? {
          ...run,
          status: "failed" as const,
          errorMessage: input.errorSummary?.trim() || "生成任务失败",
          schedulerMessage: input.errorSummary?.trim() || "生成任务失败",
          timestamp: formatTimestamp(new Date(), "失败于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === taskId) ?? null;
  });
}

export async function progressManagedTrainingRun(trainingRunId: string, input: {
  currentStep?: number | null;
  targetSteps?: number | null;
  schedulerMessage?: string | null;
}) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === trainingRunId && run.kind === "training");
  if (!currentRun) return null;

  const nextCurrentStep = typeof input.currentStep === "number" ? input.currentStep : currentRun.currentStep ?? 0;
  const nextTargetSteps = typeof input.targetSteps === "number" ? input.targetSteps : currentRun.targetSteps ?? 0;
  const nextProgress = nextTargetSteps > 0 ? Math.max(0, Math.min(100, Math.round((nextCurrentStep / nextTargetSteps) * 100))) : currentRun.progress ?? 0;

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === trainingRunId && run.kind === "training"
        ? {
          ...run,
          status: "running" as const,
          currentStep: nextCurrentStep,
          targetSteps: nextTargetSteps || run.targetSteps,
          progress: nextProgress,
          schedulerMessage: input.schedulerMessage?.trim() || run.schedulerMessage || "训练任务执行中",
          timestamp: formatTimestamp(new Date(), "开始于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === trainingRunId) ?? null;
  });
}

export async function completeManagedTrainingRun(trainingRunId: string, input: {
  artifactName?: string | null;
}) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === trainingRunId && run.kind === "training");
  if (!currentRun) return null;

  const artifactName = input.artifactName?.trim() || `${trainingRunId}.safetensors`;
  const artifactId = currentRun.finalLoraArtifactId || buildManagedScopedId("managed-final-lora");

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === trainingRunId && run.kind === "training"
        ? {
          ...run,
          status: "completed" as const,
          progress: 100,
          currentStep: run.targetSteps ?? run.currentStep ?? 0,
          artifactName,
          finalLoraArtifactId: artifactId,
          schedulerMessage: "训练任务已完成",
          timestamp: formatTimestamp(new Date(), "完成于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === trainingRunId) ?? null;
  });
}

export async function failManagedTrainingRun(trainingRunId: string, input: { errorSummary?: string | null }) {
  const runs = await readFallbackTrainingRuns();
  const currentRun = runs.find((run) => run.id === trainingRunId && run.kind === "training");
  if (!currentRun) return null;

  return withRunStoreWriteLock(async () => {
    const refreshedRuns = await readFallbackTrainingRuns();
    const nextRuns = refreshedRuns.map((run) => (
      run.id === trainingRunId && run.kind === "training"
        ? {
          ...run,
          status: "failed" as const,
          errorMessage: input.errorSummary?.trim() || "训练任务失败",
          schedulerMessage: input.errorSummary?.trim() || "训练任务失败",
          timestamp: formatTimestamp(new Date(), "失败于"),
        }
        : run
    ));
    await writeFallbackTrainingRuns(nextRuns);
    return nextRuns.find((run) => run.id === trainingRunId) ?? null;
  });
}

export async function createManagedTrainingProject(input: unknown) {
  const parsed = parseManagedProjectCreateInput(input);
  const title = normalizeTrainingProjectTitle(parsed);
  const templateId = normalizeTrainingTemplateId(parsed);

  const template = templateId ? await getManagedTrainingTemplate(templateId).catch(() => null) : null;
  if (templateId && !template) {
    throw new TrainingProjectServiceError("Training template not found", 404, { templateId });
  }

  const triggerToken = parsed.triggerToken?.trim() || buildTrainingProjectTriggerToken(title);
  let createdId: string | null = null;
  const managedReferenceSourceProjects = await listManagedTrainingProjects().catch(() => []);
  const selectedReferenceImages = await deriveReferenceImages(
    parsed.selectedReferenceIds,
    managedReferenceSourceProjects,
  );
  const responseProject = buildFallbackTrainingProject(parsed, createdId ?? `training-project-${Date.now()}`, selectedReferenceImages);

  try {
    const checkpointRelativePath = parsed.checkpointRelativePath?.trim();
    if (!checkpointRelativePath) {
      throw new TrainingProjectServiceError("checkpointRelativePath is required", 400);
    }
    const created = await createLegacyTrainingProject({
      characterName: title,
      projectName: title,
      triggerToken,
      checkpointRelativePath,
      trainingTemplateId: template?.id,
    });
    createdId = created.id;
    await setTrainingProjectSectionCollection(created.id, buildSeedSections(parsed));
    if (selectedReferenceImages.length > 0) {
      await syncSelectedReferenceImagesToTrainingProject(created.id, selectedReferenceImages);
    }
  } catch (error) {
    if (error instanceof TrainingProjectServiceError) {
      throw error;
    }
    if (!shouldUseTrainingProjectFileFallback(error)) {
      const mapped = mapLegacyTrainingProjectError(error);
      throw new TrainingProjectServiceError(mapped.message, mapped.status, mapped.details);
    }
  }

  if (createdId) {
    return {
      ...responseProject,
      id: createdId,
    };
  }

  return withProjectStoreWriteLock(async () => {
    const fallbackProjects = await readFallbackTrainingProjects();
    const nextId = `training-project-${Date.now()}`;
    const project = {
      ...responseProject,
      id: nextId,
    };

    const currentIndex = fallbackProjects.findIndex((item) => item.id === nextId);
    const nextProjects = [...fallbackProjects];
    if (currentIndex === -1) nextProjects.unshift(project);
    else nextProjects[currentIndex] = project;
    await writeFallbackTrainingProjects(nextProjects);

    return project;
  });
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

export function mapTrainingProjectMutationError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  return mapLegacyTrainingProjectError(error);
}

export function mapTrainingProjectProfileError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  const promptCardMapped = mapLegacyTrainingPromptCardError(error);
  if (promptCardMapped.status !== 500 || promptCardMapped.message !== "Unexpected character LoRA prompt card error") {
    return promptCardMapped;
  }

  return mapLegacyTrainingProjectError(error);
}

export function mapTrainingReferenceImageMutationError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  return mapLegacyTrainingReferenceImageError(error);
}

export function mapTrainingGenerationRunMutationError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  return mapLegacyTrainingGenerationError(error);
}

export function mapTrainingRunMutationError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  return mapLegacyTrainingRunError(error);
}

export function mapTrainingRunCreationError(error: unknown) {
  const mapped = mapTrainingProjectError(error);
  if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
    return mapped;
  }

  const trainingMapped = mapLegacyTrainingRunError(error);
  if (trainingMapped.status !== 400 || trainingMapped.message !== "Unexpected character LoRA training error") {
    return trainingMapped;
  }

  return mapLegacyTrainingGenerationError(error);
}
