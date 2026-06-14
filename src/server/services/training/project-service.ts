import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { DemoImage } from "@/app/design-demos/data/types";
import type {
  LoraTrainingDatasetRevision,
  LoraTrainingDatasetRevisionItem,
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingRun,
  LoraTrainingSection,
} from "@/app/design-demos/data/lora-training-types";
import { buildLoraTrainingDemoData } from "@/app/design-demos/data/lora-training";
import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import { toImageUrl } from "@/lib/image-url";
import {
  createCharacterLoraTrainingProject,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";
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

export async function getManagedTrainingRun(runId: string) {
  const runs = await readFallbackTrainingRuns();
  return runs.find((run) => run.id === runId) ?? null;
}

export async function getManagedTrainingProject(projectId: string) {
  const projects = await readFallbackTrainingProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

async function findManagedProjectBySectionId(sectionId: string) {
  const projects = await readFallbackTrainingProjects();
  for (const project of projects) {
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
    id: `managed-reference-${Date.now()}-${index + 1}`,
    kind: index === 0 ? "original" : "auxiliary",
    label,
    note,
    image: {
      id: `managed-reference-image-${Date.now()}-${index + 1}`,
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

export async function listManagedTrainingProjectReferenceImages(projectId: string) {
  const project = await getManagedTrainingProject(projectId);
  return project ? project.referenceImages : null;
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
  const relativePath = `data/images/training-managed/${projectId}/references/${Date.now()}-${safeName}${extension}`;
  const absolutePath = join(MANAGED_PROJECT_IMAGE_ROOT, projectId, "references", `${Date.now()}-${safeName}${extension}`);
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

  const nextResultPool = existing
    ? owner.project.resultPool.map((result) => result.id === existing.id ? nextResult : result)
    : [...owner.project.resultPool, nextResult];

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

    const revisionId = `managed-revision-${Date.now()}`;
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

export async function enqueueManagedTrainingSectionGenerationRun(
  sectionId: string,
  input: Record<string, unknown> = {},
) {
  const match = await findManagedProjectBySectionId(sectionId);
  if (!match) return null;

  const selectedSourceIds = Array.isArray(input.sourceImageIds) ? input.sourceImageIds.filter((id): id is string => typeof id === "string") : [];
  const selectedResultIds = Array.isArray(input.previousCandidateImageIds) ? input.previousCandidateImageIds.filter((id): id is string => typeof id === "string") : [];
  const inputImages = [
    ...match.project.referenceImages.filter((reference) => selectedSourceIds.includes(reference.id)).map((reference) => reference.image),
    ...match.project.resultPool.filter((result) => selectedResultIds.includes(result.id)).map((result) => result.image),
  ];

  const run: LoraTrainingRun = {
    id: `managed-generation-${Date.now()}`,
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
    id: `managed-training-${Date.now()}`,
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

  await withRunStoreWriteLock(async () => {
    const runs = await readFallbackTrainingRuns();
    await writeFallbackTrainingRuns([run, ...runs]);
  });

  return run;
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

  return withProjectStoreWriteLock(async () => {
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
