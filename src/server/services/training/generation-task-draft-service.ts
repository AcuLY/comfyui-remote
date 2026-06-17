import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { LoraTrainingRun } from "@/features/training/types";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TRAINING_IMAGE_GENERATION_PROVIDER_POLICY } from "@/lib/training/provider-policy";
import {
  trainingGenerationKindSchema,
  trainingGenerationTaskTypeSchema,
  type TrainingGenerationKind,
  type TrainingGenerationTaskType,
} from "@/lib/training/schemas";
import {
  getTrainingProject,
  mapTrainingReadError,
} from "@/server/services/training/read-service";
import { writeTrainingBufferArtifact } from "@/server/repositories/training/generation-tasks";

const DEFAULT_GENERATION_TASK_TYPE: TrainingGenerationTaskType = "trainingset_generation";
const DRAFT_STATUS = "draft";
const SECTION_CONTEXT_INPUT_KIND = "section_context";
const SUPPLEMENTAL_IMAGE_INPUT_KIND = "supplemental_image";
const PUBLIC_SECTION_ID_KEY = "publicSectionId";

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

const trainingGenerationTaskInclude = {
  inputs: {
    include: {
      artifact: true,
      snapshotArtifact: true,
    },
    orderBy: [
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
  outputs: true,
  sectionRuns: {
    include: {
      section: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
  },
} satisfies Prisma.TrainingGenerationTaskInclude;

type TrainingGenerationTaskRow = Prisma.TrainingGenerationTaskGetPayload<{
  include: typeof trainingGenerationTaskInclude;
}>;
type TrainingGenerationInputReferenceRow = TrainingGenerationTaskRow["inputs"][number];
type TrainingProject = Awaited<ReturnType<typeof getTrainingProject>>;
type TrainingSection = TrainingProject["sections"][number];

type ResolvedTrainingGenerationInputReference = {
  artifactId?: string | null;
  detail: string;
  inputKind: string;
  previousCandidateImageId?: string;
  purpose?: string | null;
  referenceId: string;
  role?: string | null;
  snapshotFilePath?: string | null;
  sourceEntityId?: string | null;
  sourceEntityType?: string | null;
  sourceField?: string | null;
  sourceImageId?: string;
  title: string;
  type: "result-image" | "source-image" | "text";
};

export class TrainingGenerationTaskServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingGenerationTaskServiceError";
    this.status = status;
    this.details = details;
  }
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

function getPublicSectionId(section: { id: string; sectionDefaultsJson?: unknown }) {
  const defaults = isJsonObject(section.sectionDefaultsJson) ? section.sectionDefaultsJson : {};
  const publicId = defaults[PUBLIC_SECTION_ID_KEY];
  return typeof publicId === "string" && publicId.trim() ? publicId.trim() : section.id;
}

async function getInternalSectionId(projectId: string, sectionId: string) {
  const sections = await prisma.trainingSection.findMany({
    where: { trainingProjectId: projectId },
    select: {
      id: true,
      sectionDefaultsJson: true,
    },
  });
  const section = sections.find((candidate) => candidate.id === sectionId || getPublicSectionId(candidate) === sectionId);
  if (!section) {
    throw new TrainingGenerationTaskServiceError("Training section not found", 404, { projectId, sectionId });
  }
  return section.id;
}

function normalizeGenerationParamsJson(
  value: unknown,
  fallback: Record<string, unknown> | null = null,
) {
  if (typeof value === "undefined") return fallback;
  if (value === null) return null;
  if (isJsonObject(value)) return value;

  throw new TrainingGenerationTaskServiceError("paramsJson must be a JSON object", 400, {
    paramsJsonType: Array.isArray(value) ? "array" : typeof value,
  });
}

function toPrismaJson(value: Record<string, unknown> | null) {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function fromPrismaJsonObject(value: unknown): Record<string, unknown> | null {
  return isJsonObject(value) ? value : null;
}

function formatRunTimestamp(
  value: string | null | undefined,
  prefix: "完成于" | "开始于" | "创建于" | "失败于" = "创建于",
) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${hh}:${mm}`;
}

function mapGenerationTaskStatus(status: string): LoraTrainingRun["status"] {
  if (status === "done" || status === "completed" || status === "succeeded") return "completed";
  if (status === "running") return "running";
  if (status === "queued" || status === DRAFT_STATUS) return "queued";
  return "failed";
}

async function getProjectOrThrow(projectId: string) {
  try {
    return await getTrainingProject(projectId);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    throw new TrainingGenerationTaskServiceError(mapped.message, mapped.status, mapped.details);
  }
}

function getSectionOrThrow(project: TrainingProject, sectionId: string | null | undefined, taskId?: string) {
  const normalizedSectionId = sectionId?.trim();
  const section = normalizedSectionId
    ? project.sections.find((item) => item.id === normalizedSectionId)
    : null;
  if (!section) {
    throw new TrainingGenerationTaskServiceError("Training section not found", 404, {
      projectId: project.id,
      sectionId: normalizedSectionId ?? null,
      taskId,
    });
  }
  return section;
}

function sectionContextInput(section: TrainingSection, sortOrder = -100) {
  return {
    inputKind: SECTION_CONTEXT_INPUT_KIND,
    sourceEntityType: "training_section",
    sourceEntityId: section.id,
    sourceField: "section_context",
    snapshotText: section.resolvedScene,
    role: "context",
    purpose: "section_context",
    sortOrder,
  };
}

function findTaskSectionId(row: TrainingGenerationTaskRow) {
  return (
    (row.sectionRuns[0]?.section ? getPublicSectionId(row.sectionRuns[0].section) : null)
    ?? row.sectionRuns[0]?.trainingSectionId
    ?? row.inputs.find((input) => (
      input.inputKind === SECTION_CONTEXT_INPUT_KIND
      && input.sourceEntityType === "training_section"
      && input.sourceEntityId
    ))?.sourceEntityId
    ?? null
  );
}

async function getTrainingGenerationTaskRow(taskId: string) {
  return prisma.trainingGenerationTask.findUnique({
    where: { id: taskId },
    include: trainingGenerationTaskInclude,
  });
}

async function getDraftTaskRowOrThrow(taskId: string) {
  const row = await getTrainingGenerationTaskRow(taskId);
  if (!row) {
    throw new TrainingGenerationTaskServiceError("Training generation task draft not found", 404, { taskId });
  }
  if (row.status !== DRAFT_STATUS) {
    throw new TrainingGenerationTaskServiceError("Training generation task is not a draft", 409, {
      status: row.status,
      taskId,
    });
  }
  return row;
}

async function resolveReference(
  project: TrainingProject,
  sectionId: string,
  referenceId: string,
): Promise<ResolvedTrainingGenerationInputReference> {
  if (referenceId === "profile-usage") {
    return {
      detail: project.usagePrompt,
      inputKind: "text",
      referenceId,
      sourceEntityId: project.id,
      sourceEntityType: "training_project",
      sourceField: referenceId,
      title: "使用提示词",
      type: "text",
    };
  }
  if (referenceId === "profile-detail") {
    return {
      detail: project.detailPrompt,
      inputKind: "text",
      referenceId,
      sourceEntityId: project.id,
      sourceEntityType: "training_project",
      sourceField: referenceId,
      title: "角色细节",
      type: "text",
    };
  }

  const section = project.sections.find((item) => item.id === sectionId);
  if (referenceId === "section-scene" && section) {
    return {
      detail: section.resolvedScene,
      inputKind: "text",
      referenceId,
      sourceEntityId: section.id,
      sourceEntityType: "training_section",
      sourceField: referenceId,
      title: section.title,
      type: "text",
    };
  }
  if (referenceId === "section-prompt" && section) {
    return {
      detail: section.imagePrompt,
      inputKind: "text",
      referenceId,
      sourceEntityId: section.id,
      sourceEntityType: "training_section",
      sourceField: referenceId,
      title: "图片提示词",
      type: "text",
    };
  }

  const referenceImage = project.referenceImages.find((reference) => reference.id === referenceId);
  if (referenceImage) {
    const row = await prisma.trainingCharacterImage.findFirst({
      where: {
        id: referenceImage.id,
        profile: {
          trainingProjectId: project.id,
        },
      },
      include: {
        artifact: true,
      },
    });

    return {
      artifactId: row?.artifactId ?? null,
      detail: referenceImage.note,
      inputKind: "source_image",
      referenceId,
      role: "source_image",
      snapshotFilePath: row?.artifact.filePath ?? row?.artifact.storageKey ?? null,
      sourceEntityId: referenceImage.id,
      sourceEntityType: "training_character_image",
      sourceField: referenceImage.label,
      sourceImageId: referenceImage.id,
      title: referenceImage.label,
      type: "source-image",
    };
  }

  const resultImage = project.resultPool.find((result) => result.id === referenceId);
  if (resultImage) {
    const row = await prisma.trainingImageResult.findFirst({
      where: {
        id: resultImage.id,
        trainingProjectId: project.id,
      },
      include: {
        artifact: true,
      },
    });

    return {
      artifactId: row?.artifactId ?? null,
      detail: resultImage.caption,
      inputKind: "result_image",
      previousCandidateImageId: resultImage.id,
      referenceId,
      role: "result_image",
      snapshotFilePath: row?.filePathSnapshot ?? row?.artifact.filePath ?? row?.artifact.storageKey ?? null,
      sourceEntityId: resultImage.id,
      sourceEntityType: "training_image_result",
      sourceField: resultImage.sourceLabel,
      title: resultImage.sourceLabel,
      type: "result-image",
    };
  }

  throw new TrainingGenerationTaskServiceError("Training generation task input reference not found", 404, {
    projectId: project.id,
    referenceId,
    sectionId,
  });
}

function visibleReferenceInputs(row: TrainingGenerationTaskRow) {
  return row.inputs.filter((input) => (
    input.inputKind !== SECTION_CONTEXT_INPUT_KIND
    && input.inputKind !== SUPPLEMENTAL_IMAGE_INPUT_KIND
  ));
}

function supplementalImageInputs(row: TrainingGenerationTaskRow) {
  return row.inputs.filter((input) => input.inputKind === SUPPLEMENTAL_IMAGE_INPUT_KIND);
}

function referenceIdForInput(input: TrainingGenerationInputReferenceRow) {
  if (
    input.sourceField === "profile-usage"
    || input.sourceField === "profile-detail"
    || input.sourceField === "section-scene"
    || input.sourceField === "section-prompt"
  ) {
    return input.sourceField;
  }
  return input.sourceEntityId ?? input.id;
}

function mapInputReferenceView(
  input: TrainingGenerationInputReferenceRow,
  project: TrainingProject,
) {
  const referenceId = referenceIdForInput(input);
  if (input.inputKind === "source_image") {
    const referenceImage = project.referenceImages.find((item) => item.id === input.sourceEntityId);
    return {
      detail: input.snapshotText ?? referenceImage?.note ?? "",
      id: input.id,
      referenceId,
      sourceImageId: input.sourceEntityId ?? undefined,
      title: referenceImage?.label ?? input.sourceField ?? "参考图",
      type: "source-image" as const,
    };
  }

  if (input.inputKind === "result_image") {
    const resultImage = project.resultPool.find((item) => item.id === input.sourceEntityId);
    return {
      detail: input.snapshotText ?? resultImage?.caption ?? "",
      id: input.id,
      previousCandidateImageId: input.sourceEntityId ?? undefined,
      referenceId,
      title: resultImage?.sourceLabel ?? input.sourceField ?? "生成结果",
      type: "result-image" as const,
    };
  }

  const textTitles: Record<string, string> = {
    "profile-detail": "角色细节",
    "profile-usage": "使用提示词",
    "section-prompt": "图片提示词",
    "section-scene": "训练小节",
  };

  return {
    detail: input.snapshotText ?? "",
    id: input.id,
    referenceId,
    title: textTitles[referenceId] ?? input.sourceField ?? "文本引用",
    type: "text" as const,
  };
}

function mapSupplementalImageView(input: TrainingGenerationInputReferenceRow) {
  const artifact = input.artifact ?? input.snapshotArtifact;
  return {
    detail: input.snapshotText ?? "",
    id: input.id,
    relativePath: input.snapshotFilePath ?? artifact?.filePath ?? artifact?.storageKey ?? "",
    title: input.sourceField ?? "补充图片",
  };
}

async function buildTrainingGenerationTaskView(row: TrainingGenerationTaskRow) {
  const project = await getProjectOrThrow(row.trainingProjectId);
  const sectionId = findTaskSectionId(row);
  const section = getSectionOrThrow(project, sectionId, row.id);
  const resolvedInputs = visibleReferenceInputs(row).map((input) => mapInputReferenceView(input, project));
  const supplementalImages = supplementalImageInputs(row).map(mapSupplementalImageView);
  const taskMetadata = normalizeGenerationTaskMetadata(row);

  const finalInput = [
    project.usagePrompt,
    section.resolvedScene,
    resolvedInputs.length
      ? `显式引用\n${resolvedInputs.map((input) => `- ${input.title}: ${input.detail}`).join("\n")}`
      : "",
    supplementalImages.length
      ? `补充图片附件\n${supplementalImages.map((image) => `- ${image.title}: ${image.detail}`).join("\n")}`
      : "",
    row.supplementalPrompt ?? "",
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  return {
    createdAt: row.createdAt.toISOString(),
    finalInput,
    generationKind: taskMetadata.generationKind,
    id: row.id,
    inputs: resolvedInputs,
    paramsJson: fromPrismaJsonObject(row.paramsJson),
    projectId: row.trainingProjectId,
    sectionId: section.id,
    status: row.status,
    supplementalImages,
    supplementalPrompt: row.supplementalPrompt ?? "",
    taskType: taskMetadata.taskType,
    taskTypeLabel: taskMetadata.taskTypeLabel,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapQueuedGenerationTaskToTrainingRun(input: {
  finalInput: string;
  project: TrainingProject;
  row: TrainingGenerationTaskRow;
  section: TrainingSection;
  taskTypeLabel: string;
}) {
  const sectionRun = input.row.sectionRuns[0] ?? null;
  const finishedAt = input.row.finishedAt?.toISOString() ?? sectionRun?.finishedAt?.toISOString() ?? null;
  const startedAt = input.row.startedAt?.toISOString() ?? sectionRun?.startedAt?.toISOString() ?? null;
  const createdAt = input.row.createdAt.toISOString();
  const status = mapGenerationTaskStatus(input.row.status);
  const generationKind = normalizeGenerationKind(input.row.generationKind, normalizeGenerationTaskType(input.row.taskType));

  return {
    id: input.row.id,
    kind: "generation",
    status,
    generationKind,
    taskType: normalizeGenerationTaskType(input.row.taskType),
    taskTypeLabel: input.taskTypeLabel,
    projectId: input.project.id,
    sectionId: input.section.id,
    projectTitle: input.project.title,
    title: `${input.section.title} 图片生成`,
    summary: `图片 · 小节 ${input.section.title}`,
    timestamp: finishedAt
      ? formatRunTimestamp(finishedAt, status === "failed" ? "失败于" : "完成于")
      : startedAt
        ? formatRunTimestamp(startedAt, "开始于")
        : formatRunTimestamp(createdAt, "创建于"),
    provider: input.row.provider ?? undefined,
    providerModel: generationKind === "image_generation"
      ? input.row.model ?? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model
      : undefined,
    providerTool: generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.tool
      : undefined,
    usesComfyUiWorkflow: generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.usesComfyUiWorkflow
      : undefined,
    usesComfyUiQueue: generationKind === "image_generation"
      ? TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.usesComfyUiQueue
      : undefined,
    finalInput: input.finalInput,
    outputLabel: input.row.outputs.length > 0 ? `输出 ${input.row.outputs.length} 张图片` : undefined,
    schedulerMessage: "已进入生成队列",
  } satisfies LoraTrainingRun;
}

export async function listTrainingGenerationTasks(projectId: string, filters: {
  status?: string | null;
  taskType?: string | null;
} = {}) {
  if (filters.status?.trim() && filters.status.trim() !== DRAFT_STATUS) {
    return [];
  }

  const project = await getProjectOrThrow(projectId);
  const taskType = filters.taskType?.trim() ? normalizeGenerationTaskType(filters.taskType) : null;
  const rows = await prisma.trainingGenerationTask.findMany({
    where: {
      trainingProjectId: project.id,
      status: DRAFT_STATUS,
      taskType: taskType ?? undefined,
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: trainingGenerationTaskInclude,
  });
  const views = await Promise.all(rows.map(buildTrainingGenerationTaskView));
  return views.map((view) => ({ ...view, status: "draft" as const }));
}

export async function listTrainingGenerationTaskRuns(projectId: string, filters: {
  status?: string | null;
  taskType?: string | null;
} = {}) {
  const project = await getProjectOrThrow(projectId);
  const taskType = filters.taskType?.trim() ? normalizeGenerationTaskType(filters.taskType) : null;
  const rows = await prisma.trainingGenerationTask.findMany({
    where: {
      trainingProjectId: project.id,
      hiddenAt: null,
      status: filters.status?.trim() || undefined,
      taskType: taskType ?? undefined,
      NOT: {
        status: DRAFT_STATUS,
      },
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: trainingGenerationTaskInclude,
  });

  return Promise.all(rows.map(async (row) => {
    const preview = await buildTrainingGenerationTaskView(row);
    const section = getSectionOrThrow(project, preview.sectionId, row.id);
    const taskMetadata = normalizeGenerationTaskMetadata(row);
    return mapQueuedGenerationTaskToTrainingRun({
      finalInput: preview.finalInput,
      project,
      row,
      section,
      taskTypeLabel: taskMetadata.taskTypeLabel,
    });
  }));
}

export async function getTrainingGenerationTask(taskId: string) {
  const row = await getTrainingGenerationTaskRow(taskId);
  if (!row || row.status !== DRAFT_STATUS) return null;
  return buildTrainingGenerationTaskView(row);
}

export async function isTrainingGenerationTaskDraftOrigin(taskId: string) {
  const row = await prisma.trainingGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      inputs: {
        where: {
          inputKind: SECTION_CONTEXT_INPUT_KIND,
          sourceEntityType: "training_section",
        },
        select: {
          id: true,
        },
        take: 1,
      },
      status: true,
      taskType: true,
    },
  });
  return Boolean(row && row.status !== DRAFT_STATUS && row.taskType !== "profile_text_generation" && row.inputs.length > 0);
}

export async function createTrainingGenerationTask(projectId: string, input: {
  generationKind?: string | null;
  paramsJson?: unknown;
  sectionId?: string | null;
  taskType?: string | null;
  supplementalPrompt?: string | null;
}) {
  const project = await getProjectOrThrow(projectId);
  const section = getSectionOrThrow(project, input.sectionId);
  const taskMetadata = normalizeGenerationTaskMetadata(input);
  const paramsJson = normalizeGenerationParamsJson(input.paramsJson);

  const row = await prisma.trainingGenerationTask.create({
    data: {
      trainingProjectId: project.id,
      generationKind: taskMetadata.generationKind,
      taskType: taskMetadata.taskType,
      supplementalPrompt: input.supplementalPrompt?.trim() || "",
      status: DRAFT_STATUS,
      paramsJson: toPrismaJson(paramsJson),
      inputs: {
        create: {
          ...sectionContextInput(section),
          sourceEntityId: section.id,
        },
      },
    },
    include: trainingGenerationTaskInclude,
  });

  return buildTrainingGenerationTaskView(row);
}

export async function updateTrainingGenerationTask(taskId: string, input: {
  generationKind?: string | null;
  paramsJson?: unknown;
  taskType?: string | null;
  supplementalPrompt?: string | null;
}) {
  const current = await getDraftTaskRowOrThrow(taskId);
  const taskMetadata = normalizeGenerationTaskMetadata({
    generationKind: typeof input.generationKind === "string" ? input.generationKind : current.generationKind,
    taskType: typeof input.taskType === "string" && input.taskType.trim() ? input.taskType : current.taskType,
  });
  const paramsJson = normalizeGenerationParamsJson(
    input.paramsJson,
    fromPrismaJsonObject(current.paramsJson),
  );

  const row = await prisma.trainingGenerationTask.update({
    where: { id: taskId },
    data: {
      generationKind: taskMetadata.generationKind,
      paramsJson: toPrismaJson(paramsJson),
      supplementalPrompt: typeof input.supplementalPrompt === "string"
        ? input.supplementalPrompt.trim()
        : current.supplementalPrompt,
      taskType: taskMetadata.taskType,
    },
    include: trainingGenerationTaskInclude,
  });

  return buildTrainingGenerationTaskView(row);
}

export async function deleteTrainingGenerationTask(taskId: string) {
  const deleted = await prisma.trainingGenerationTask.deleteMany({
    where: {
      id: taskId,
      status: DRAFT_STATUS,
    },
  });
  if (deleted.count === 0) return null;

  return {
    id: taskId,
    success: true,
  };
}

export async function addTrainingGenerationTaskInput(taskId: string, input: {
  referenceId?: string | null;
}) {
  const referenceId = input.referenceId?.trim();
  if (!referenceId) {
    throw new TrainingGenerationTaskServiceError("referenceId is required", 400);
  }

  const task = await getDraftTaskRowOrThrow(taskId);
  const project = await getProjectOrThrow(task.trainingProjectId);
  const sectionId = findTaskSectionId(task);
  const section = getSectionOrThrow(project, sectionId, task.id);
  const resolved = await resolveReference(project, section.id, referenceId);
  const sortOrder = visibleReferenceInputs(task).length + supplementalImageInputs(task).length + 1;

  const row = await prisma.trainingGenerationInputReference.create({
    data: {
      trainingGenerationTaskId: task.id,
      inputKind: resolved.inputKind,
      sourceEntityType: resolved.sourceEntityType ?? null,
      sourceEntityId: resolved.sourceEntityId ?? null,
      sourceField: resolved.sourceField ?? null,
      artifactId: resolved.artifactId ?? null,
      snapshotText: resolved.detail,
      snapshotFilePath: resolved.snapshotFilePath ?? null,
      role: resolved.role ?? null,
      purpose: resolved.purpose ?? resolved.inputKind,
      sortOrder,
    },
    include: {
      artifact: true,
      snapshotArtifact: true,
    },
  });
  await prisma.trainingGenerationTask.update({
    where: { id: task.id },
    data: { updatedAt: new Date() },
  });

  return {
    ...mapInputReferenceView(row, project),
    referenceId,
  };
}

export async function deleteTrainingGenerationTaskInput(inputId: string) {
  const input = await prisma.trainingGenerationInputReference.findUnique({
    where: { id: inputId },
    include: {
      task: true,
    },
  });
  if (!input || input.inputKind === SECTION_CONTEXT_INPUT_KIND || input.task.status !== DRAFT_STATUS) {
    return null;
  }

  await prisma.trainingGenerationInputReference.delete({
    where: { id: inputId },
  });
  await prisma.trainingGenerationTask.update({
    where: { id: input.trainingGenerationTaskId },
    data: { updatedAt: new Date() },
  });

  return {
    id: inputId,
    success: true,
  };
}

function sanitizeTrainingUploadName(name: string) {
  const extension = extname(name).toLowerCase() || ".png";
  const stem = name
    .slice(0, extension ? -extension.length : undefined)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${stem || "reference"}${extension}`;
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
): value is { name: string; arrayBuffer(): Promise<ArrayBuffer>; type?: string } {
  return Boolean(
    value
    && typeof value === "object"
    && "name" in value
    && typeof (value as { name?: unknown }).name === "string"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

export async function addTrainingGenerationTaskSupplementalImage(taskId: string, formData: FormData) {
  const task = await getDraftTaskRowOrThrow(taskId);
  const project = await getProjectOrThrow(task.trainingProjectId);
  const sectionId = findTaskSectionId(task);
  const section = getSectionOrThrow(project, sectionId, task.id);
  const file = formData.get("file");
  if (!isFileLike(file)) {
    throw new TrainingGenerationTaskServiceError("file is required", 400);
  }

  const title = typeof formData.get("title") === "string" && String(formData.get("title")).trim()
    ? String(formData.get("title")).trim()
    : file.name.replace(/\.[^.]+$/, "") || "补充图片";
  const detail = typeof formData.get("detail") === "string" ? String(formData.get("detail")).trim() : "";
  const safeName = sanitizeTrainingUploadName(file.name);
  const extension = extname(safeName).toLowerCase() || ".png";
  const relativePath = `data/images/training/${project.id}/generation-tasks/${task.id}/supplemental/${Date.now()}-${randomUUID()}-${safeName}`;
  const artifact = await writeTrainingBufferArtifact({
    buffer: Buffer.from(await file.arrayBuffer()),
    jobId: project.id,
    kind: "source_image",
    metadata: {
      origin: "training_generation_task_supplemental_upload",
      sectionId: section.id,
      taskId: task.id,
      title,
    },
    mimeType: file.type || imageMimeTypeFromExtension(extension),
    relativePath,
  });
  const sortOrder = visibleReferenceInputs(task).length + supplementalImageInputs(task).length + 1;
  const input = await prisma.trainingGenerationInputReference.create({
    data: {
      trainingGenerationTaskId: task.id,
      inputKind: SUPPLEMENTAL_IMAGE_INPUT_KIND,
      artifactId: artifact.id,
      snapshotFilePath: artifact.relativePath,
      snapshotText: detail,
      sourceField: title,
      role: "local_reference",
      purpose: "supplemental_image",
      sortOrder,
    },
    include: {
      artifact: true,
      snapshotArtifact: true,
    },
  });
  await prisma.trainingGenerationTask.update({
    where: { id: task.id },
    data: { updatedAt: new Date() },
  });

  return mapSupplementalImageView(input);
}

export async function previewTrainingGenerationTask(taskId: string) {
  const task = await getDraftTaskRowOrThrow(taskId);
  return buildTrainingGenerationTaskView(task);
}

function supplementalInputImages(row: TrainingGenerationTaskRow) {
  return supplementalImageInputs(row).flatMap((input) => {
    const artifact = input.artifact ?? input.snapshotArtifact;
    const relativePath = input.snapshotFilePath ?? artifact?.filePath ?? artifact?.storageKey;
    if (!relativePath) return [];
    return [{
      artifactId: input.artifactId ?? input.snapshotArtifactId ?? undefined,
      relativePath,
      role: input.role ?? "local_reference",
      sha256: artifact?.sha256 ?? null,
    }];
  });
}

export async function runTrainingGenerationTask(taskId: string) {
  const task = await getDraftTaskRowOrThrow(taskId);
  const preview = await buildTrainingGenerationTaskView(task);
  const project = await getProjectOrThrow(task.trainingProjectId);
  const section = getSectionOrThrow(project, preview.sectionId, task.id);
  const internalSectionId = await getInternalSectionId(project.id, section.id);
  const taskMetadata = normalizeGenerationTaskMetadata(task);
  const userInstruction = `${taskMetadata.taskTypeLabel}\n\n${preview.finalInput}`;
  const paramsJson = fromPrismaJsonObject(task.paramsJson);

  await prisma.$transaction(async (tx) => {
    const profile = await tx.trainingCharacterProfile.upsert({
      where: { trainingProjectId: project.id },
      create: { trainingProjectId: project.id },
      update: {},
    });
    const runIndex = await tx.trainingSectionRun.count({
      where: { trainingSectionId: section.id },
    }) + 1;
    const sectionRun = await tx.trainingSectionRun.create({
      data: {
        trainingProjectId: project.id,
        trainingSectionId: internalSectionId,
        trainingCharacterProfileId: profile.id,
        generationTaskId: task.id,
        runIndex,
        sceneDescriptionText: section.resolvedScene,
        imagePromptText: userInstruction,
        provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
        model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
        generationParamsJson: toPrismaJson(paramsJson),
        status: "queued",
      },
    });
    await tx.trainingSection.update({
      where: { id: internalSectionId },
      data: { latestRunId: sectionRun.id },
    });
    await tx.trainingGenerationTask.update({
      where: { id: task.id },
      data: {
        generationKind: taskMetadata.generationKind,
        taskType: taskMetadata.taskType,
        supplementalPrompt: userInstruction,
        status: "queued",
        provider: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.provider,
        model: TRAINING_IMAGE_GENERATION_PROVIDER_POLICY.model,
        paramsJson: toPrismaJson(paramsJson),
      },
    });
  });

  const row = await getTrainingGenerationTaskRow(task.id);
  if (!row) {
    throw new TrainingGenerationTaskServiceError("Training generation task not found after enqueue", 404, {
      taskId: task.id,
    });
  }

  return {
    ...mapQueuedGenerationTaskToTrainingRun({
      finalInput: userInstruction,
      project,
      row,
      section,
      taskTypeLabel: taskMetadata.taskTypeLabel,
    }),
    inputImages: supplementalInputImages(row).map((image) => ({
      id: image.artifactId ?? image.relativePath,
      src: image.relativePath,
      full: image.relativePath,
      label: image.role ?? "local_reference",
      status: "pending" as const,
      featured: false,
      featured2: false,
      cover: false,
      width: null,
      height: null,
    })),
  } satisfies LoraTrainingRun;
}

export function mapTrainingGenerationTaskError(error: unknown) {
  if (error instanceof TrainingGenerationTaskServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return {
      message: "Training generation task not found",
      status: 404,
      details: error.message,
    };
  }

  return {
    message: "Unexpected training generation task error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}

export const mapTrainingGenerationTaskDraftError = mapTrainingGenerationTaskError;
