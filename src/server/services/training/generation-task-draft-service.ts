import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { LoraTrainingRun } from "@/features/training/types";
import { getTrainingProject } from "@/server/services/training/read-service";
import { enqueueManagedTrainingSectionGenerationRun, getManagedTrainingProject, mapTrainingProjectError } from "@/server/services/training/project-service";
import type { CharacterLoraProviderInputImage } from "@/server/services/training/legacy-compat-service";
import {
  createCharacterLoraJobArtifact,
  enqueueCharacterLoraSectionGenerationRun,
  getExistingJob,
  getExistingSection,
  mapCharacterLoraPhase3Error,
  writeCharacterLoraBufferArtifact,
} from "@/server/services/training/legacy-compat-service";

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
  taskType: string;
  supplementalPrompt: string;
  inputs: GenerationTaskDraftInput[];
  supplementalImages: GenerationTaskDraftSupplementalImage[];
  createdAt: string;
  updatedAt: string;
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

function mapLegacyGenerationRunToTrainingRun(input: {
  finalInput: string;
  project: Awaited<ReturnType<typeof getTrainingProject>>;
  run: Awaited<ReturnType<typeof enqueueCharacterLoraSectionGenerationRun>>;
  section: Awaited<ReturnType<typeof getTrainingProject>>["sections"][number];
}): LoraTrainingRun {
  return {
    id: input.run.id,
    kind: "generation",
    status: mapLegacyGenerationStatus(input.run.status),
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
    provider: input.run.imageModel ?? input.run.hostModel ?? input.run.provider,
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
    id: draft.id,
    inputs: resolvedInputs,
    projectId: draft.projectId,
    sectionId: draft.sectionId,
    supplementalImages: draft.supplementalImages,
    supplementalPrompt: draft.supplementalPrompt,
    taskType: draft.taskType,
    updatedAt: draft.updatedAt,
  };
}

export async function getManagedGenerationTaskDraft(taskId: string) {
  const drafts = await readGenerationTaskDrafts();
  const draft = drafts.find((item) => item.id === taskId);
  if (!draft) return null;
  return buildGenerationTaskDraftView(draft);
}

export async function createManagedGenerationTaskDraft(projectId: string, input: {
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

  const nextDraft: GenerationTaskDraftRecord = {
    createdAt: formatTimestamp(),
    id: createDraftId(),
    inputs: [],
    projectId,
    sectionId: section.id,
    supplementalImages: [],
    supplementalPrompt: input.supplementalPrompt?.trim() || "",
    taskType: input.taskType?.trim() || "训练集图片生成",
    updatedAt: formatTimestamp(),
  };

  await withGenerationTaskDraftWriteLock(async () => {
    const drafts = await readGenerationTaskDrafts();
    await writeGenerationTaskDrafts([nextDraft, ...drafts]);
  });

  return buildGenerationTaskDraftView(nextDraft);
}

export async function updateManagedGenerationTaskDraft(taskId: string, input: {
  taskType?: string | null;
  supplementalPrompt?: string | null;
}) {
  const { draft, drafts } = await getDraftOrThrow(taskId);
  const nextDraft: GenerationTaskDraftRecord = {
    ...draft,
    supplementalPrompt: typeof input.supplementalPrompt === "string" ? input.supplementalPrompt.trim() : draft.supplementalPrompt,
    taskType: typeof input.taskType === "string" && input.taskType.trim() ? input.taskType.trim() : draft.taskType,
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

async function buildCharacterLoraSupplementalInputImages(taskId: string, sectionId: string, supplementalImages: GenerationTaskDraftSupplementalImage[]) {
  if (supplementalImages.length === 0) {
    return [] as CharacterLoraProviderInputImage[];
  }

  const section = await getExistingSection(sectionId);
  const job = await getExistingJob(section.jobId);

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

    const artifactStat = await writeCharacterLoraBufferArtifact(job.artifactRoot, relativePath, buffer);
    const artifact = await createCharacterLoraJobArtifact({
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
    } satisfies CharacterLoraProviderInputImage;
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

  const managedRun = await enqueueManagedTrainingSectionGenerationRun(section.id, {
    previousCandidateImageIds,
    projectId: draft.projectId,
    sourceImageIds,
    supplementalImages,
    userInstruction: `${draft.taskType}\n\n${preview.finalInput}`,
  }).catch((error) => {
    const mapped = mapTrainingProjectError(error);
    throw new TrainingGenerationTaskDraftServiceError(mapped.message, mapped.status, mapped.details);
  });

  let run: LoraTrainingRun;

  if (managedRun) {
    run = managedRun;
  } else {
    const projectIsManaged = Boolean(await getManagedTrainingProject(draft.projectId));
    const legacyRun = await enqueueCharacterLoraSectionGenerationRun(section.id, {
      previousCandidateImageIds,
      supplementalInputImages: projectIsManaged
        ? []
        : await buildCharacterLoraSupplementalInputImages(taskId, section.id, draft.supplementalImages),
      sourceImageIds,
      userInstruction: `${draft.taskType}\n\n${preview.finalInput}`,
    }).catch((error) => {
      const mapped = mapCharacterLoraPhase3Error(error);
      throw new TrainingGenerationTaskDraftServiceError(mapped.message, mapped.status, mapped.details);
    });
    run = mapLegacyGenerationRunToTrainingRun({
      finalInput: preview.finalInput,
      project,
      run: legacyRun,
      section,
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
