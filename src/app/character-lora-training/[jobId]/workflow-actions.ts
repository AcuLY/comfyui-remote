"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { buildCanonicalRerunPrompt } from "@/lib/character-lora-canonical-views";
import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";
import {
  cancelCharacterLoraTrainingRun,
  createCharacterLoraPromptCardVersion,
  enqueueCharacterLoraCanonicalGenerationRun,
  enqueueCharacterLoraCanonicalViewGenerationRuns,
  enqueueCharacterLoraPromptCardDraft,
  enqueueCharacterLoraSectionGenerationRun,
  enqueueCharacterLoraTrainingRun,
  freezeCharacterLoraDataset,
  getCharacterLoraPromptCardDraftTask,
  getCharacterLoraWorkerTask,
  instantiateCharacterLoraJobSections,
  registerManualCharacterLoraCanonicalVersion,
  rejectCharacterLoraCanonicalVersion,
  reviewCharacterLoraImages,
  selectCharacterLoraCanonicalVersion,
  updateCharacterLoraImageCaption,
  uploadCharacterLoraSourceImage,
} from "@/lib/actions/character-lora-training";

export type WorkflowActionResult = {
  ok: boolean;
  message: string;
};

export type TaskEnqueueResult = WorkflowActionResult & {
  taskId?: string;
  runId?: string;
  workerType?: string;
};

export type PromptCardDraftTaskProgress = {
  status?: string;
  provider?: string;
  sourceImageCount?: number;
  canonicalImageCount?: number;
  imageCount?: number;
  sourceImageIds?: string[];
  canonicalVersionIds?: string[];
  draft?: PromptCardDraftFields;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type PromptCardDraftTaskSnapshot = {
  id: string;
  status: string;
  provider?: string;
  sourceImageCount?: number;
  canonicalImageCount?: number;
  imageCount?: number;
  progress?: PromptCardDraftTaskProgress | null;
  errorSummary?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  heartbeatAt?: string | null;
  finishedAt?: string | null;
};

export type PromptCardDraftActionResult = WorkflowActionResult & {
  draft?: PromptCardDraftFields;
  taskId?: string;
  task?: PromptCardDraftTaskSnapshot;
  provider?: string;
  sourceImageCount?: number;
  canonicalImageCount?: number;
  imageCount?: number;
  workerType?: string;
};

export type PromptCardDraftResult = {
  taskId: string;
  status: string;
  provider: string | null;
  draft: PromptCardDraftFields | null;
  errorSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export async function listPromptCardDraftResultsAction(jobId: string): Promise<PromptCardDraftResult[]> {
  const tasks = await db.characterLoraWorkerTask.findMany({
    where: { jobId, workerType: "prompt_card_draft", status: { in: ["done", "failed"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return tasks.map((task) => {
    const progress = isPlainRecord(task.progressJson) ? task.progressJson : null;
    const draft = progress ? normalizePromptCardDraftFields(progress.draft) ?? null : null;
    const provider = (progress && typeof progress.provider === "string" ? progress.provider : null);

    return {
      taskId: task.id,
      status: task.status,
      provider,
      draft,
      errorSummary: task.errorSummary ?? null,
      createdAt: (task.createdAt instanceof Date ? task.createdAt.toISOString() : String(task.createdAt)),
      finishedAt: task.finishedAt ? (task.finishedAt instanceof Date ? task.finishedAt.toISOString() : String(task.finishedAt)) : null,
    };
  });
}

export async function uploadSourceImageAction(jobId: string, formData: FormData): Promise<WorkflowActionResult & { sourceImageId?: string }> {
  try {
    const result = await uploadCharacterLoraSourceImage(jobId, formData);
    revalidateJob(jobId);
    return { ok: true, message: "已上传参考图。", sourceImageId: result.id };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function enqueueCanonicalAction(jobId: string, formData: FormData): Promise<TaskEnqueueResult> {
  try {
    const sourceImageIds = formData.getAll("sourceImageIds").map(String).filter(Boolean);
    const canonicalVersionIds = formData.getAll("canonicalVersionIds").map(String).filter(Boolean);
    const canonicalView = stringOrUndefined(formData.get("canonicalView"));
    const runs = await enqueueCharacterLoraCanonicalViewGenerationRuns(jobId, {
      provider: stringOrUndefined(formData.get("provider")),
      canonicalView,
      sourceImageIds: sourceImageIds.length > 0 ? sourceImageIds : undefined,
      canonicalVersionIds: canonicalVersionIds.length > 0 ? canonicalVersionIds : undefined,
      visualPrompt: stringOrUndefined(formData.get("visualPrompt")),
      characterDescription: stringOrUndefined(formData.get("characterDescription")),
      finalPromptDraft: stringOrUndefined(formData.get("finalPromptDraft")),
      negativePrompt: stringOrNull(formData.get("negativePrompt")),
    });
    revalidateJob(jobId);
    return {
      ok: true,
      message: canonicalView
        ? `已入队${canonicalView}人设图任务：${runs.map((run) => compactActionId(run.id)).join(" / ")}。`
        : `已分别入队正面/背面/左侧/右侧 4 条人设图任务：${runs.map((run) => `${run.canonicalView}:${compactActionId(run.id)}`).join(" / ")}。`,
      taskId: runs[0]?.workerTaskId,
      runId: runs[0]?.id,
      workerType: "image_generation",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rerunCanonicalAction(jobId: string, formData: FormData): Promise<TaskEnqueueResult> {
  try {
    const userInstruction = requiredString(formData.get("userInstruction"), "userInstruction");
    const artifactId = requiredString(formData.get("artifactId"), "artifactId");
    const relativePath = requiredString(formData.get("relativePath"), "relativePath");
    const sha256 = requiredString(formData.get("sha256"), "sha256");
    const uploadedSourceImageIds = await uploadReferenceFilesAsSourceImages(jobId, formData, "canonical_rerun_reference");
    const sourceImageIds = [
      ...formData.getAll("sourceImageIds").map(String).filter(Boolean),
      ...uploadedSourceImageIds,
    ];
    const canonicalVersionIds = formData.getAll("canonicalVersionIds").map(String).filter(Boolean);
    const run = await enqueueCharacterLoraCanonicalGenerationRun(jobId, {
      provider: stringOrUndefined(formData.get("provider")),
      canonicalView: stringOrUndefined(formData.get("canonicalView")),
      inputImages: [{
        artifactId,
        role: "canonical",
        relativePath,
        sha256,
      }],
      sourceImageIds: sourceImageIds.length > 0 ? sourceImageIds : undefined,
      canonicalVersionIds: canonicalVersionIds.length > 0 ? canonicalVersionIds : undefined,
      visualPrompt: buildCanonicalRerunPrompt({
        canonicalView: stringOrUndefined(formData.get("canonicalView")),
        userInstruction,
      }),
      negativePrompt: stringOrNull(formData.get("negativePrompt")),
    });
    revalidateJob(jobId);
    return {
      ok: true,
      message: `已入队人设图重生 run ${compactActionId(run.id)} / task ${compactActionId(run.workerTaskId)}。`,
      taskId: run.workerTaskId,
      runId: run.id,
      workerType: "image_generation",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function registerManualCanonicalAction(jobId: string, formData: FormData) {
  await registerManualCharacterLoraCanonicalVersion(jobId, {
    sourceImageId: requiredString(formData.get("sourceImageId"), "sourceImageId"),
    canonicalView: stringOrUndefined(formData.get("canonicalView")),
    notes: stringOrNull(formData.get("notes")),
  });
  revalidateJob(jobId);
}

export async function selectCanonicalAction(jobId: string, versionId: string) {
  await selectCharacterLoraCanonicalVersion(jobId, versionId);
  revalidateJob(jobId);
}

export async function rejectCanonicalAction(jobId: string, versionId: string) {
  await rejectCharacterLoraCanonicalVersion(jobId, versionId);
  revalidateJob(jobId);
}

export async function createPromptCardAction(jobId: string, formData: FormData) {
  await createCharacterLoraPromptCardVersion(jobId, {
    canonicalVersionId: stringOrNull(formData.get("canonicalVersionId")),
    triggerToken: stringOrUndefined(formData.get("triggerToken")),
    identityTraits: textPayload(formData.get("identityTraits")),
    outfitTraits: textPayload(formData.get("outfitTraits")),
    negativeTraits: optionalTextPayload(formData.get("negativeTraits")),
    finalPromptDraft: requiredString(formData.get("finalPromptDraft"), "finalPromptDraft"),
    changeReason: stringOrNull(formData.get("changeReason")),
  });
  revalidateJob(jobId);
}

export async function draftPromptCardAction(jobId: string, input: unknown): Promise<PromptCardDraftActionResult> {
  try {
    const result = await enqueueCharacterLoraPromptCardDraft(jobId, input ?? {});
    const task = toPromptCardDraftTaskSnapshot(result.task);
    return {
      ok: true,
      message: `AI 草拟任务已入队（${result.provider}，source ${result.sourceImageCount}，canonical ${result.canonicalImageCount}，task ${compactActionId(result.taskId)}）。下方会自动刷新状态。`,
      taskId: result.taskId,
      task,
      provider: result.provider,
      sourceImageCount: result.sourceImageCount,
      canonicalImageCount: result.canonicalImageCount,
      imageCount: result.imageCount,
      workerType: "prompt_card_draft",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getPromptCardDraftTaskAction(jobId: string, taskId: string): Promise<PromptCardDraftActionResult> {
  try {
    const task = toPromptCardDraftTaskSnapshot(await getCharacterLoraPromptCardDraftTask(jobId, taskId));
    const progress = task.progress;
    return {
      ok: true,
      message: task.status === "done"
        ? "AI 草稿已生成。请检查后再创建新版本。"
        : task.status === "failed"
          ? task.errorSummary ?? "AI 草拟任务失败。"
          : `AI 草拟任务状态：${progress?.status ?? task.status}`,
      draft: progress?.draft,
      taskId: task.id,
      task,
      provider: task.provider ?? progress?.provider,
      sourceImageCount: task.sourceImageCount ?? progress?.sourceImageCount,
      canonicalImageCount: task.canonicalImageCount ?? progress?.canonicalImageCount,
      imageCount: task.imageCount ?? progress?.imageCount,
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function instantiateSectionsAction(jobId: string) {
  await instantiateCharacterLoraJobSections(jobId, {});
  revalidateJob(jobId);
}

export async function enqueueSectionRunAction(sectionId: string, jobId: string, formData: FormData): Promise<TaskEnqueueResult> {
  try {
    const previousCandidateImageIds = formData.getAll("previousCandidateImageIds").map(String).filter(Boolean);
    const sourceImageIds = formData.getAll("sourceImageIds").map(String).filter(Boolean);
    const run = await enqueueCharacterLoraSectionGenerationRun(sectionId, {
      provider: stringOrUndefined(formData.get("provider")),
      userInstruction: stringOrNull(formData.get("userInstruction")),
      negativePrompt: stringOrNull(formData.get("negativePrompt")),
      parentRunId: stringOrUndefined(formData.get("parentRunId")),
      previousCandidateImageIds: previousCandidateImageIds.length > 0 ? previousCandidateImageIds : undefined,
      sourceImageIds: sourceImageIds.length > 0 ? sourceImageIds : undefined,
    });
    revalidateJob(jobId);
    return {
      ok: true,
      message: `已入队候选图 run ${compactActionId(run.id)} / task ${compactActionId(run.workerTaskId)}。`,
      taskId: run.workerTaskId,
      runId: run.id,
      workerType: "image_generation",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function reviewCandidateAction(jobId: string, imageId: string, reviewStatus: "pending" | "keep" | "reject" | "excluded", formData: FormData) {
  const rejectReasons = formData.getAll("rejectReasons").map(String).filter(Boolean);
  await reviewCharacterLoraImages({
    images: [{
      imageId,
      reviewStatus,
      rejectReasons: reviewStatus === "reject" ? rejectReasons.length > 0 ? rejectReasons : ["other"] : undefined,
      reviewNote: stringOrNull(formData.get("reviewNote")),
    }],
  });
  revalidateJob(jobId);
}

export async function updateCaptionAction(jobId: string, imageId: string, formData: FormData) {
  await updateCharacterLoraImageCaption(imageId, {
    captionDraft: requiredString(formData.get("captionDraft"), "captionDraft"),
  });
  revalidateJob(jobId);
}

export async function freezeDatasetAction(jobId: string, formData: FormData) {
  try {
    await freezeCharacterLoraDataset(jobId, {
      queue: formData.get("queue") === "true",
      captionStrategy: stringOrUndefined(formData.get("captionStrategy")),
      repeatCount: positiveNumberOrUndefined(formData.get("repeatCount")),
      sourceWeight: positiveNumberOrUndefined(formData.get("sourceWeight")),
    });
    revalidateJob(jobId);
    return { ok: true, message: "训练集版本已冻结。" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function enqueueTrainingAction(datasetRevisionId: string, jobId: string, formData: FormData) {
  try {
    const queuePolicy = stringOrUndefined(formData.get("queuePolicy")) ?? "reject_when_busy";
    await enqueueCharacterLoraTrainingRun(datasetRevisionId, {
      queuePolicy,
      allowWhenComfyQueueBusy: queuePolicy !== "reject_when_busy",
      configProfile: stringOrUndefined(formData.get("configProfile")) ?? "standard",
    });
    revalidateJob(jobId);
    return { ok: true, message: "训练任务已入队。" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function cancelTrainingAction(trainingRunId: string, jobId: string, formData: FormData) {
  try {
    await cancelCharacterLoraTrainingRun(trainingRunId, {
      reason: stringOrUndefined(formData.get("reason")) ?? "cancelled from workflow page",
      requestedBy: "workflow-ui",
    });
    revalidateJob(jobId);
    return { ok: true, message: "训练任务已取消。" };
  } catch (error) {
    return toActionResult(error);
  }
}

export type WorkerTaskStatus = {
  ok: boolean;
  taskId: string;
  status: string;
  workerType: string;
  progress: unknown;
  errorSummary: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
};

export async function getWorkerTaskStatusAction(jobId: string, taskId: string): Promise<WorkerTaskStatus> {
  const task = await getCharacterLoraWorkerTask(taskId);

  if (!task) {
    return {
      ok: false,
      taskId,
      status: "not_found",
      workerType: "",
      progress: null,
      errorSummary: "Worker task not found",
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
    };
  }

  if (task.jobId !== jobId) {
    return {
      ok: false,
      taskId,
      status: "not_found",
      workerType: "",
      progress: null,
      errorSummary: "Worker task does not belong to this job",
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
    };
  }

  return {
    ok: true,
    taskId: task.id,
    status: task.status,
    workerType: task.workerType,
    progress: task.progressJson,
    errorSummary: task.errorSummary ?? null,
    startedAt: task.startedAt ?? null,
    heartbeatAt: task.heartbeatAt ?? null,
    finishedAt: task.finishedAt ?? null,
  };
}

function revalidateJob(jobId: string) {
  revalidatePath(`/character-lora-training/${jobId}`);
  revalidatePath(`/character-lora-training/${jobId}/persona-reference`);
  revalidatePath(`/character-lora-training/${jobId}/prompt-card`);
  revalidatePath(`/character-lora-training/${jobId}/sections`);
  revalidatePath(`/character-lora-training/${jobId}/dataset`);
  revalidatePath(`/character-lora-training/${jobId}/training`);
}

function toPromptCardDraftTaskSnapshot(task: {
  id: string;
  status: string;
  payload: unknown;
  progressJson: unknown;
  errorSummary?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  heartbeatAt?: string | null;
  finishedAt?: string | null;
}): PromptCardDraftTaskSnapshot {
  const progress = normalizePromptCardDraftTaskProgress(task.progressJson);
  const payload = isPlainRecord(task.payload) ? task.payload : null;
  const request = isPlainRecord(payload?.request) ? payload.request : null;
  const provider = progress?.provider ?? readString(request, "provider");
  const sourceImageIds = progress?.sourceImageIds ?? readStringArray(request, "sourceImageIds");
  const canonicalVersionIds = progress?.canonicalVersionIds ?? readStringArray(request, "canonicalVersionIds");

  return {
    id: task.id,
    status: task.status,
    provider,
    sourceImageCount: progress?.sourceImageCount ?? sourceImageIds?.length,
    canonicalImageCount: progress?.canonicalImageCount ?? canonicalVersionIds?.length,
    imageCount: progress?.imageCount ?? (sourceImageIds || canonicalVersionIds ? (sourceImageIds?.length ?? 0) + (canonicalVersionIds?.length ?? 0) : undefined),
    progress,
    errorSummary: task.errorSummary ?? null,
    createdAt: task.createdAt,
    startedAt: task.startedAt ?? null,
    heartbeatAt: task.heartbeatAt ?? null,
    finishedAt: task.finishedAt ?? null,
  };
}

function normalizePromptCardDraftTaskProgress(value: unknown): PromptCardDraftTaskProgress | null {
  if (!isPlainRecord(value)) return null;
  const draft = normalizePromptCardDraftFields(value.draft);
  return {
    status: readString(value, "status"),
    provider: readString(value, "provider"),
    sourceImageCount: readNumber(value, "sourceImageCount"),
    canonicalImageCount: readNumber(value, "canonicalImageCount"),
    imageCount: readNumber(value, "imageCount"),
    sourceImageIds: readStringArray(value, "sourceImageIds"),
    canonicalVersionIds: readStringArray(value, "canonicalVersionIds"),
    draft,
    message: readString(value, "message"),
    startedAt: readString(value, "startedAt"),
    finishedAt: readString(value, "finishedAt"),
  };
}

function normalizePromptCardDraftFields(value: unknown): PromptCardDraftFields | undefined {
  if (!isPlainRecord(value)) return undefined;
  const characterDescription = readString(value, "characterDescription");
  const identityTraits = readString(value, "identityTraits");
  const outfitTraits = readString(value, "outfitTraits");
  const negativeTraits = readString(value, "negativeTraits");
  const finalPromptDraft = readString(value, "finalPromptDraft");
  if (!characterDescription || !identityTraits || !outfitTraits || !negativeTraits || !finalPromptDraft) {
    return undefined;
  }
  return { characterDescription, identityTraits, outfitTraits, negativeTraits, finalPromptDraft };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length > 0 ? strings : undefined;
}

function textPayload(value: FormDataEntryValue | null) {
  return jsonObjectPayload(requiredString(value, "text"));
}

async function uploadReferenceFilesAsSourceImages(jobId: string, formData: FormData, purpose: string) {
  const files = formData.getAll("referenceFiles").filter(isNonEmptyFile);
  const uploadedSourceImageIds: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const uploaded = await uploadCharacterLoraSourceImage(jobId, {
      file,
      role: "source",
      sortOrder: 10_000 + index,
      provenance: {
        purpose,
        uploadedFrom: "canonical_rerun_form",
        uploadedAt: new Date().toISOString(),
      },
    });
    uploadedSourceImageIds.push(uploaded.id);
  }

  return uploadedSourceImageIds;
}

function isNonEmptyFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function optionalTextPayload(value: FormDataEntryValue | null) {
  const text = stringOrUndefined(value);
  return text ? jsonObjectPayload(text) : null;
}

function jsonObjectPayload(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Plain text is accepted below.
  }

  return { text };
}

function stringOrUndefined(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const text = stringOrUndefined(value);
  return text ?? null;
}

function requiredString(value: FormDataEntryValue | null, fieldName: string) {
  const text = stringOrUndefined(value);
  if (!text) throw new Error(`${fieldName} is required`);
  return text;
}

function positiveNumberOrUndefined(value: FormDataEntryValue | null) {
  const text = stringOrUndefined(value);
  if (!text) return undefined;
  const numberValue = Number(text);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function compactActionId(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function toActionResult(error: unknown): WorkflowActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "操作失败。",
  };
}
