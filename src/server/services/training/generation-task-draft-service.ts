import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { LoraTrainingRun } from "@/features/training/types";
import {
  trainingGenerationKindSchema,
  trainingGenerationTaskTypeSchema,
  type TrainingGenerationKind,
  type TrainingGenerationTaskType,
} from "@/lib/training/schemas";
import { TRAINING_IMAGE_GENERATION_PROVIDER_POLICY } from "@/lib/training/provider-policy";
import type { TrainingProviderInputImage } from "@/server/repositories/training/generation-tasks";
import {
  createTrainingProjectArtifact,
  enqueueTrainingSectionGenerationRun,
  getTrainingProductionProjectRecord,
  getTrainingProductionSectionRecord,
  mapTrainingGenerationError,
  writeTrainingBufferArtifact,
} from "@/server/repositories/training/generation-tasks";
import { getTrainingProject, mapTrainingReadError } from "@/server/services/training/read-service";
import { enqueueManagedTrainingSectionGenerationRun, getManagedTrainingProject, mapTrainingProjectError } from "@/server/services/training/project-service";

const TRAINING_GENERATION_TASK_DRAFTS_PATH = join(process.cwd(), "data", "training-generation-task-drafts.json");
const TRAINING_GENERATION_TASK_DRAFT_IMAGE_ROOT = join(process.cwd(), "data", "images", "training-managed");
let generationTaskDraftWriteQueue: Promise<unknown> = Promise.resolve();

type GenerationTaskDraftInput = {
  id: string;
  referenceId: string;
};

type GenerationTaskDraftSupplementalImage = {
  detail: string;
  id: string;
  relativePath: string;
  title: string;
};

type GenerationTaskDraftRecord = {
  id: string;
  projectId: string;
  sectionId: string;
  generationKind?: string;
  paramsJson?: Record<string, unknown> | null;
  taskType: string;
  supplementalPrompt: string;
  inputs: GenerationTaskDraftInput[];
  supplementalImages: GenerationTaskDraftSupplementalImage[];
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_GENERATION_TASK_TYPE: TrainingGenerationTaskType = "trainingset_generation";

const TRAINING_GENERATION_TASK_TYPE_LABELS: Record<TrainingGenerationTaskType, string> = {
  caption_generation: "说明文本补全",
  image_prompt_generation: "图片提示词生成",
  profile_text_generation: "角色描述生成",
  reference_image_generation: "参考图生成",
  scene_description_generation: "场景描述生成",
  trainingset_generation: "训练集图片生成",
};

const TRAINING_GENERATION_TASK_LABEL_TO_TYPE: Record<string, TrainingGenerationTaskType> = {
  参考图生成: "reference_image_generation",
  场景描述生成: "scene_description_generation",
  图片提示词生成: "image_prompt_generation",
  角色描述生成: "profile_text_generation",
  训练集图片生成: "trainingset_generation",
  说明文本补全: "caption_generation",
};

const TRAINING_GENERATION_KIND_BY_TASK_TYPE: Record<TrainingGenerationTaskType, TrainingGenerationKind> = {
  caption_generation: "text_generation",
  image_prompt_generation: "text_generation",
  profile_text_generation: "text_generation",
  reference_image_generation: "image_generation",
  scene_description_generation: "text_generation",
  trainingset_generation: "image_generation",
};

export class TrainingGenerationTaskDraftServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingGenerationTaskDraftServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readGenerationTaskDrafts() {
  try {
    const raw = await readFile(TRAINING_GENERATION_TASK_DRAFTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as GenerationTaskDraftRecord[];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return [] as GenerationTaskDraftRecord[];
}

async function writeGenerationTaskDrafts(drafts: GenerationTaskDraftRecord[]) {
  await mkdir(dirname(TRAINING_GENERATION_TASK_DRAFTS_PATH), { recursive: true });
  const tempPath = `${TRAINING_GENERATION_TASK_DRAFTS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_GENERATION_TASK_DRAFTS_PATH);
}

async function withGenerationTaskDraftWriteLock<T>(fn: () => Promise<T>) {
  const next = generationTaskDraftWriteQueue.then(fn, fn);
  generationTaskDraftWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

function formatTimestamp(value = new Date()) {
  return value.toISOString();
}

function formatRunTimestamp(value: string | null | undefined, prefix: "完成于" | "开始于" | "创建于" | "失败于" = "创建于") {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${hh}:${mm}`;
}

function mapLegacyGenerationStatus(status: string): LoraTrainingRun["status"] {
  if (status === "done") return "completed";
  if (status === "running") return "running";
  if (status === "queued") return "queued";
  return "failed";
}

export function normalizeGenerationTaskType(value: string | null | undefined): TrainingGenerationTaskType {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_GENERATION_TASK_TYPE;

  const canonicalResult = trainingGenerationTaskTypeSchema.safeParse(normalized);
  if (canonicalResult.success) return canonicalResult.data;

  return TRAINING_GENERATION_TASK_LABEL_TO_TYPE[normalized] ?? DEFAULT_GENERATION_TASK_TYPE;
}

function normalizeGenerationKind(
  value: string | null | undefined,
  taskType: TrainingGenerationTaskType,
): TrainingGenerationKind {
  const normalized = value?.trim();
  if (normalized) {
    const canonicalResult = trainingGenerationKindSchema.safeParse(normalized);
    if (canonicalResult.success) return canonicalResult.data;
  }

  return TRAINING_GENERATION_KIND_BY_TASK_TYPE[taskType];
}

function normalizeGenerationTaskMetadata(input: {
  generationKind?: string | null;
  taskType?: string | null;
}) {
  const taskType = normalizeGenerationTaskType(input.taskType);
  const generationKind = normalizeGenerationKind(input.generationKind, taskType);

  return {
    generationKind,
    taskType,
    taskTypeLabel: TRAINING_GENERATION_TASK_TYPE_LABELS[taskType],
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeGenerationParamsJson(
  value: unknown,
  fallback: Record<string, unknown> | null = null,
) {
  if (typeof value === "undefined") return fallback;
  if (value === null) return null;
  if (isJsonObject(value)) return value;

  throw new TrainingGenerationTaskDraftServiceError("paramsJson must be a JSON object", 400, {
    paramsJsonType: Array.isArray(value) ? "array" : typeof value,
  });
}

function mapLegacyGenerationRunToTrainingRun(input: {
  finalInput: string;
  generationKind?: TrainingGenerationKind;
  project: Awaited<ReturnType<typeof getTrainingProject>>;
  run: Awaited<ReturnType<typeof enqueueTrainingSectionGenerationRun>>;
  section: Awaited<ReturnType<typeof getTrainingProject>>["sections"][number];
  taskType?: TrainingGenerationTaskType;
  taskTypeLabel?: string;
}): LoraTrainingRun {
  return {
    id: input.run.id,
    kind: "generation",
    status: mapLegacyGenerationStatus(input.run.status),
    generationKind: input.generationKind,
    taskType: input.taskType,
    taskTypeLabel: input.taskTypeLabel,
    projectId: input.project.id,
    sectionId: input.section.id,
    projectTitle: input.project.title,
    title: `${input.section.title} 图片生成`,
    summary: `图片 · 小节 ${input.section.title}`,
    timestamp: input.run.finishedAt
      ? formatRunTimestamp(input.run.finishedAt, input.run.status === "failed" ? "失败于" : "完成于")
      : input.run.startedAt
        ? formatRunTimestamp(input.run.startedAt, "开始于")
        : formatRunTimestamp(input.run.createdAt, "创建于"),
    provider: input.run.imageModel ?? input.run.hostModel ?? input.run.provider ?? undefined,
    providerModel: input.generationKind === "image_generation"
      ? input.run.imageModel ?? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model
      : undefined,
    providerTool: input.generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.tool
      : undefined,
    usesComfyUiWorkflow: input.generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.usesComfyUiWorkflow
      : undefined,
    usesComfyUiQueue: input.generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.usesComfyUiQueue
      : undefined,
    finalInput: input.run.visualPrompt ?? input.run.hostInstruction ?? input.finalInput,
    outputLabel: input.run.counts.candidateImages > 0 ? `输出 ${input.run.counts.candidateImages} 张图片` : undefined,
    schedulerMessage: "已进入生成队列",
  };
}

function createDraftId() {
  return `draft-generation-task-${Date.now()}`;
}

function createDraftInputId(taskId: string) {
  return `${taskId}-input-${Date.now()}`;
}

function createDraftSupplementalImageId(taskId: string) {
  return `${taskId}-supplemental-image-${Date.now()}`;
}

function resolveReference(project: Awaited<ReturnType<typeof getTrainingProject>>, sectionId: string, referenceId: string) {
  if (referenceId === "profile-usage") {
    return {
      detail: project.usagePrompt,
      referenceId,
      title: "使用提示词",
      type: "text" as const,
    };
  }
  if (referenceId === "profile-detail") {
    return {
      detail: project.detailPrompt,
      referenceId,
      title: "角色细节",
      type: "text" as const,
    };
  }

  const section = project.sections.find((item) => item.id === sectionId);
  if (referenceId === "section-scene" && section) {
    return {
      detail: section.resolvedScene,
      referenceId,
      title: section.title,
      type: "text" as const,
    };
  }
  if (referenceId === "section-prompt" && section) {
    return {
      detail: section.imagePrompt,
      referenceId,
      title: "图片提示词",
      type: "text" as const,
    };
  }

  const referenceImage = project.referenceImages.find((reference) => reference.id === referenceId);
  if (referenceImage) {
    return {
      detail: referenceImage.note,
      referenceId,
      sourceImageId: referenceImage.id,
      title: referenceImage.label,
      type: "source-image" as const,
    };
  }

  const resultImage = project.resultPool.find((result) => result.id === referenceId);
  if (resultImage) {
    return {
      detail: resultImage.caption,
      previousCandidateImageId: resultImage.id,
      referenceId,
      title: resultImage.sourceLabel,
      type: "result-image" as const,
    };
  }

  throw new TrainingGenerationTaskDraftServiceError("Training generation task input reference not found", 404, {
    projectId: project.id,
    referenceId,
    sectionId,
  });
}

async function getDraftOrThrow(taskId: string) {
  const drafts = await readGenerationTaskDrafts();
  const draft = drafts.find((item) => item.id === taskId);
  if (!draft) {
    throw new TrainingGenerationTaskDraftServiceError("Training generation task draft not found", 404, { taskId });
  }
  return { draft, drafts };
}

async function buildGenerationTaskDraftView(draft: GenerationTaskDraftRecord) {
  const project = await getTrainingProject(draft.projectId);
  const section = project.sections.find((item) => item.id === draft.sectionId);
  if (!section) {
    throw new TrainingGenerationTaskDraftServiceError("Training section not found", 404, {
      projectId: draft.projectId,
      sectionId: draft.sectionId,
      taskId: draft.id,
    });
  }

  const resolvedInputs = draft.inputs.map((input) => ({
    id: input.id,
    ...resolveReference(project, section.id, input.referenceId),
  }));
  const taskMetadata = normalizeGenerationTaskMetadata(draft);

  const finalInput = [
    project.usagePrompt,
    section.resolvedScene,
    resolvedInputs.length
      ? `显式引用\n${resolvedInputs.map((input) => `- ${input.title}: ${input.detail}`).join("\n")}`
      : "",
    draft.supplementalImages.length
      ? `补充图片附件\n${draft.supplementalImages.map((image) => `- ${image.title}: ${image.detail}`).join("\n")}`
      : "",
    draft.supplementalPrompt,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  return {
    createdAt: draft.createdAt,
    finalInput,
    generationKind: taskMetadata.generationKind,
    id: draft.id,
    inputs: resolvedInputs,
    paramsJson: draft.paramsJson ?? null,
    projectId: draft.projectId,
    sectionId: draft.sectionId,
    supplementalImages: draft.supplementalImages,
    supplementalPrompt: draft.supplementalPrompt,
    taskType: taskMetadata.taskType,
    taskTypeLabel: taskMetadata.taskTypeLabel,
    updatedAt: draft.updatedAt,
  };
}

export async function getManagedGenerationTaskDraft(taskId: string) {
  const drafts = await readGenerationTaskDrafts();
  const draft = drafts.find((item) => item.id === taskId);
  if (!draft) return null;
  return buildGenerationTaskDraftView(draft);
}

export async function listManagedGenerationTaskDrafts(projectId: string, filters: {
  status?: string | null;
  taskType?: string | null;
} = {}) {
  if (filters.status?.trim() && filters.status.trim() !== "draft") {
    return [];
  }

  await getTrainingProject(projectId).catch((error) => {
    const mapped = mapTrainingReadError(error);
    throw new TrainingGenerationTaskDraftServiceError(mapped.message, mapped.status, mapped.details);
  });

  const taskType = filters.taskType?.trim() ? normalizeGenerationTaskType(filters.taskType) : null;
  const drafts = await readGenerationTaskDrafts();
  const projectDrafts = drafts.filter((draft) => draft.projectId === projectId);
  const views = await Promise.all(projectDrafts.map(buildGenerationTaskDraftView));

  return views
    .map((view) => ({ ...view, status: "draft" as const }))
    .filter((view) => !taskType || view.taskType === taskType);
}

export async function createManagedGenerationTaskDraft(projectId: string, input: {
  generationKind?: string | null;
  paramsJson?: unknown;
  sectionId?: string | null;
  taskType?: string | null;
  supplementalPrompt?: string | null;
}) {
  const project = await getTrainingProject(projectId);
  const sectionId = input.sectionId?.trim();
  const section = sectionId ? project.sections.find((item) => item.id === sectionId) : null;
  if (!section) {
    throw new TrainingGenerationTaskDraftServiceError("Training section not found", 404, {
      projectId,
      sectionId: sectionId ?? null,
    });
  }
  const taskMetadata = normalizeGenerationTaskMetadata(input);
  const paramsJson = normalizeGenerationParamsJson(input.paramsJson);

  const nextDraft: GenerationTaskDraftRecord = {
    createdAt: formatTimestamp(),
    generationKind: taskMetadata.generationKind,
    id: createDraftId(),
    inputs: [],
    paramsJson,
    projectId,
    sectionId: section.id,
    supplementalImages: [],
    supplementalPrompt: input.supplementalPrompt?.trim() || "",
    taskType: taskMetadata.taskType,
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    const drafts = await readGenerationTaskDrafts();
    await writeGenerationTaskDrafts([nextDraft, ...drafts]);
  });

  return buildGenerationTaskDraftView(nextDraft);
}

export async function updateManagedGenerationTaskDraft(taskId: string, input: {
  generationKind?: string | null;
  paramsJson?: unknown;
  taskType?: string | null;
  supplementalPrompt?: string | null;
}) {
  const { draft, drafts } = await getDraftOrThrow(taskId);
  const taskMetadata = normalizeGenerationTaskMetadata({
    generationKind: typeof input.generationKind === "string" ? input.generationKind : draft.generationKind,
    taskType: typeof input.taskType === "string" && input.taskType.trim() ? input.taskType : draft.taskType,
  });
  const paramsJson = normalizeGenerationParamsJson(input.paramsJson, draft.paramsJson ?? null);
  const nextDraft: GenerationTaskDraftRecord = {
    ...draft,
    generationKind: taskMetadata.generationKind,
    paramsJson,
    supplementalPrompt: typeof input.supplementalPrompt === "string" ? input.supplementalPrompt.trim() : draft.supplementalPrompt,
    taskType: taskMetadata.taskType,
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.map((item) => item.id === taskId ? nextDraft : item));
  });

  return buildGenerationTaskDraftView(nextDraft);
}

export async function deleteManagedGenerationTaskDraft(taskId: string) {
  const drafts = await readGenerationTaskDrafts();
  const exists = drafts.some((item) => item.id === taskId);
  if (!exists) return null;

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.filter((item) => item.id !== taskId));
  });

  return {
    id: taskId,
    success: true,
  };
}

export async function addManagedGenerationTaskInput(taskId: string, input: {
  referenceId?: string | null;
}) {
  const referenceId = input.referenceId?.trim();
  if (!referenceId) {
    throw new TrainingGenerationTaskDraftServiceError("referenceId is required", 400);
  }

  const { draft, drafts } = await getDraftOrThrow(taskId);
  await getTrainingProject(draft.projectId).then((project) => resolveReference(project, draft.sectionId, referenceId));

  const nextInput: GenerationTaskDraftInput = {
    id: createDraftInputId(taskId),
    referenceId,
  };
  const nextDraft: GenerationTaskDraftRecord = {
    ...draft,
    inputs: [...draft.inputs, nextInput],
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.map((item) => item.id === taskId ? nextDraft : item));
  });

  const project = await getTrainingProject(draft.projectId);
  const resolved = resolveReference(project, draft.sectionId, referenceId);
  return {
    id: nextInput.id,
    ...resolved,
  };
}

export async function deleteManagedGenerationTaskInput(inputId: string) {
  const drafts = await readGenerationTaskDrafts();
  const owner = drafts.find((draft) => draft.inputs.some((input) => input.id === inputId));
  if (!owner) return null;

  const nextDraft: GenerationTaskDraftRecord = {
    ...owner,
    inputs: owner.inputs.filter((input) => input.id !== inputId),
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.map((draft) => draft.id === owner.id ? nextDraft : draft));
  });

  return {
    id: inputId,
    success: true,
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

function imageMimeTypeFromExtension(extension: string) {
  const normalized = extension.toLowerCase();
  if (normalized === ".jpg" || normalized === ".jpeg") return "image/jpeg";
  if (normalized === ".webp") return "image/webp";
  if (normalized === ".gif") return "image/gif";
  return "image/png";
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

export async function addManagedGenerationTaskSupplementalImage(taskId: string, formData: FormData) {
  const { draft, drafts } = await getDraftOrThrow(taskId);
  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingGenerationTaskDraftServiceError("file is required", 400);
  }

  const safeName = sanitizeManagedUploadName(file.name);
  const extension = extname(file.name).toLowerCase() || ".png";
  const relativePath = `data/images/training-managed/${draft.projectId}/generation-drafts/${taskId}/${Date.now()}-${safeName}${extension}`;
  const absolutePath = join(TRAINING_GENERATION_TASK_DRAFT_IMAGE_ROOT, draft.projectId, "generation-drafts", taskId, `${Date.now()}-${safeName}${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const nextImage: GenerationTaskDraftSupplementalImage = {
    detail: typeof formData.get("detail") === "string" ? String(formData.get("detail")).trim() : "",
    id: createDraftSupplementalImageId(taskId),
    relativePath,
    title: typeof formData.get("title") === "string" && String(formData.get("title")).trim()
      ? String(formData.get("title")).trim()
      : file.name.replace(/\.[^.]+$/, "") || "补充图片",
  };
  const nextDraft: GenerationTaskDraftRecord = {
    ...draft,
    supplementalImages: [...draft.supplementalImages, nextImage],
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.map((item) => item.id === taskId ? nextDraft : item));
  });

  return nextImage;
}

export async function previewManagedGenerationTask(taskId: string) {
  const { draft } = await getDraftOrThrow(taskId);
  return buildGenerationTaskDraftView(draft);
}

function resolveDraftSupplementalImageAbsolutePath(relativePath: string) {
  return relativePath.startsWith("data/images/")
    ? join(process.cwd(), relativePath)
    : join(process.cwd(), "data", "images", relativePath);
}

async function buildTrainingSupplementalInputImages(taskId: string, sectionId: string, supplementalImages: GenerationTaskDraftSupplementalImage[]) {
  if (supplementalImages.length === 0) {
    return [] as TrainingProviderInputImage[];
  }

  const section = await getTrainingProductionSectionRecord(sectionId);
  const job = await getTrainingProductionProjectRecord(section.jobId);

  return Promise.all(supplementalImages.map(async (image, index) => {
    const extension = extname(image.relativePath).toLowerCase() || ".png";
    const safeName = sanitizeManagedUploadName(image.title || `supplemental-${index + 1}`);
    const relativePath = `generation-drafts/${taskId}/supplemental/${Date.now()}-${index + 1}-${safeName}${extension}`;
    let buffer: Buffer;

    try {
      buffer = await readFile(resolveDraftSupplementalImageAbsolutePath(image.relativePath));
    } catch (error) {
      throw new TrainingGenerationTaskDraftServiceError("Training supplemental image file not found", 404, {
        taskId,
        sectionId,
        relativePath: image.relativePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const artifactStat = await writeTrainingBufferArtifact(job.artifactRoot, relativePath, buffer);
    const artifact = await createTrainingProjectArtifact({
      absolutePath: artifactStat.absolutePath,
      byteSize: BigInt(artifactStat.byteSize),
      jobId: job.id,
      kind: "source_image",
      metadata: {
        origin: "training_generation_task_supplemental_upload",
        sectionId,
        taskId,
        title: image.title,
      },
      mimeType: imageMimeTypeFromExtension(extension),
      relativePath: artifactStat.relativePath,
      sha256: artifactStat.sha256,
    });

    return {
      artifactId: artifact.id,
      relativePath: artifactStat.relativePath,
      role: "local_reference",
      sha256: artifactStat.sha256,
    } satisfies TrainingProviderInputImage;
  }));
}

export async function runManagedGenerationTask(taskId: string) {
  const { draft, drafts } = await getDraftOrThrow(taskId);
  const project = await getTrainingProject(draft.projectId);
  const section = project.sections.find((item) => item.id === draft.sectionId);
  if (!section) {
    throw new TrainingGenerationTaskDraftServiceError("Training section not found", 404, {
      projectId: draft.projectId,
      sectionId: draft.sectionId,
      taskId,
    });
  }

  const preview = await buildGenerationTaskDraftView(draft);
  const resolvedInputs = draft.inputs.map((input) => resolveReference(project, section.id, input.referenceId));
  const sourceImageIds = [...new Set(resolvedInputs.flatMap((input) => input.type === "source-image" ? [input.sourceImageId] : []))];
  const previousCandidateImageIds = [...new Set(resolvedInputs.flatMap((input) => input.type === "result-image" ? [input.previousCandidateImageId] : []))];
  const supplementalImages = draft.supplementalImages.map((image) => ({
    relativePath: image.relativePath,
    title: image.title,
  }));
  const taskMetadata = normalizeGenerationTaskMetadata(draft);

  const managedRun = await enqueueManagedTrainingSectionGenerationRun(section.id, {
    previousCandidateImageIds,
    projectId: draft.projectId,
    sourceImageIds,
    supplementalImages,
    userInstruction: `${taskMetadata.taskTypeLabel}\n\n${preview.finalInput}`,
  }).catch((error) => {
    const mapped = mapTrainingProjectError(error);
    throw new TrainingGenerationTaskDraftServiceError(mapped.message, mapped.status, mapped.details);
  });

  let run: LoraTrainingRun;

  if (managedRun) {
    run = {
      ...managedRun,
      generationKind: taskMetadata.generationKind,
      taskType: taskMetadata.taskType,
      taskTypeLabel: taskMetadata.taskTypeLabel,
    };
  } else {
    const projectIsManaged = Boolean(await getManagedTrainingProject(draft.projectId));
    const productionRun = await enqueueTrainingSectionGenerationRun(section.id, {
      previousCandidateImageIds,
      supplementalInputImages: projectIsManaged
        ? []
        : await buildTrainingSupplementalInputImages(taskId, section.id, draft.supplementalImages),
      sourceImageIds,
      userInstruction: `${taskMetadata.taskTypeLabel}\n\n${preview.finalInput}`,
    }).catch((error) => {
      const mapped = mapTrainingGenerationError(error);
      throw new TrainingGenerationTaskDraftServiceError(mapped.message, mapped.status, mapped.details);
    });
    run = mapLegacyGenerationRunToTrainingRun({
      finalInput: preview.finalInput,
      generationKind: taskMetadata.generationKind,
      project,
      run: productionRun,
      section,
      taskType: taskMetadata.taskType,
      taskTypeLabel: taskMetadata.taskTypeLabel,
    });
  }

  await withGenerationTaskDraftWriteLock(async () => {
    await writeGenerationTaskDrafts(drafts.filter((item) => item.id !== taskId));
  });

  return run;
}

export function mapTrainingGenerationTaskDraftError(error: unknown) {
  if (error instanceof TrainingGenerationTaskDraftServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training generation task draft error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
