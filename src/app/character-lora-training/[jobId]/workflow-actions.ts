"use server";

import { revalidatePath } from "next/cache";

import { buildCanonicalRerunPrompt } from "@/lib/character-lora-canonical-views";
import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";
import {
  cancelCharacterLoraTrainingRun,
  createCharacterLoraPromptCardVersion,
  enqueueCharacterLoraCanonicalGenerationRun,
  enqueueCharacterLoraCanonicalViewGenerationRuns,
  enqueueCharacterLoraSectionGenerationRun,
  enqueueCharacterLoraTrainingRun,
  freezeCharacterLoraDataset,
  generateCharacterLoraPromptCardDraft,
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

export type PromptCardDraftActionResult = WorkflowActionResult & {
  draft?: PromptCardDraftFields;
  provider?: string;
  sourceImageCount?: number;
  canonicalImageCount?: number;
  imageCount?: number;
};

export async function uploadSourceImageAction(jobId: string, formData: FormData): Promise<WorkflowActionResult> {
  try {
    await uploadCharacterLoraSourceImage(jobId, formData);
    revalidateJob(jobId);
    return { ok: true, message: "已上传参考图。" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function enqueueCanonicalAction(jobId: string, formData: FormData): Promise<WorkflowActionResult> {
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
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function rerunCanonicalAction(jobId: string, formData: FormData): Promise<WorkflowActionResult> {
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
    return { ok: true, message: `已入队人设图重生 run ${compactActionId(run.id)} / task ${compactActionId(run.workerTaskId)}。` };
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
    const result = await generateCharacterLoraPromptCardDraft(jobId, input ?? {});
    return {
      ok: true,
      message: `AI 草稿已生成（${result.provider}，source ${result.sourceImageCount}，canonical ${result.canonicalImageCount}）。请检查后再创建新版本。`,
      draft: result.draft,
      provider: result.provider,
      sourceImageCount: result.sourceImageCount,
      canonicalImageCount: result.canonicalImageCount,
      imageCount: result.imageCount,
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function instantiateSectionsAction(jobId: string) {
  await instantiateCharacterLoraJobSections(jobId, {});
  revalidateJob(jobId);
}

export async function enqueueSectionRunAction(sectionId: string, jobId: string, formData: FormData): Promise<WorkflowActionResult> {
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
    return { ok: true, message: `已入队候选图 run ${compactActionId(run.id)} / task ${compactActionId(run.workerTaskId)}。` };
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

function revalidateJob(jobId: string) {
  revalidatePath(`/character-lora-training/${jobId}`);
  revalidatePath(`/character-lora-training/${jobId}/persona-reference`);
  revalidatePath(`/character-lora-training/${jobId}/prompt-card`);
  revalidatePath(`/character-lora-training/${jobId}/sections`);
  revalidatePath(`/character-lora-training/${jobId}/dataset`);
  revalidatePath(`/character-lora-training/${jobId}/training`);
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
