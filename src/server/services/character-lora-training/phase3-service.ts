import { readFile } from "node:fs/promises";

import { Prisma } from "@/generated/prisma";
import { toInputJsonValue } from "@/server/services/character-lora-training/shared/service-utils";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import {
  characterLoraCaptionPatchRequestSchema,
  characterLoraDatasetFreezeRequestSchema,
  characterLoraImageGenerationOutputSchema,
  characterLoraImageReviewBatchRequestSchema,
  characterLoraImageReviewStatusSchema,
  characterLoraWorkerTaskCompleteRequestSchema,
  characterLoraWorkerTaskFailRequestSchema,
  characterLoraWorkerTaskHeartbeatRequestSchema,
  characterLoraWorkerTaskLeaseRequestSchema,
  characterLoraWorkerTaskPayloadSchema,
} from "@/server/character-lora-training/contracts";
import {
  completeImageGenerationWorkerTask,
  completePromptCardDraftWorkerTask,
  failCharacterLoraWorkerTask,
  getCharacterLoraWorkerQueueStatus as getWorkerQueueStatusFromRepository,
  getCharacterLoraWorkerTask,
  heartbeatCharacterLoraWorkerTask,
  leaseNextCharacterLoraWorkerTask,
  listCharacterLoraCandidateImages as listCandidateImagesFromRepository,
  listCharacterLoraDatasetRevisions as listDatasetRevisionsFromRepository,
  reviewCharacterLoraCandidateImages,
  updateCharacterLoraCandidateCaption,
} from "@/server/repositories/character-lora-training-repository";
import {
  redactCharacterLoraProviderPayload,
  resolveCharacterLoraArtifactPath,
  statCharacterLoraArtifact,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CharacterLoraTrainingServiceError,
  completeCharacterLoraTrainingTask,
} from "@/server/services/character-lora-training/training-service";
import {
  CharacterLoraPhase3ServiceError,
  getExistingCandidateImage,
  getExistingJob,
  normalizeCaptionTrigger,
  normalizeId,
  parseWithSchema,
} from "@/server/services/character-lora-training/phase3-internal";
import {
  buildDatasetFreezeTaskPayload,
  buildQueuedDatasetFreezeSummary,
  completeCharacterLoraDatasetFreezeTask,
  createCharacterLoraDatasetFreezeWorkerTask,
  createFrozenCharacterLoraDatasetRevision,
  materializeCharacterLoraDatasetFreeze,
  prepareDatasetFreezePlan,
} from "@/server/services/character-lora-training/dataset-freeze-service";
import { enqueueCharacterLoraSectionGenerationRun } from "@/server/services/character-lora-training/generation-run-service";
import { z } from "zod";

// Re-export for backward compatibility
export { CharacterLoraPhase3ServiceError } from "@/server/services/character-lora-training/phase3-internal";
export { enqueueCharacterLoraSectionGenerationRun } from "@/server/services/character-lora-training/generation-run-service";

const DEFAULT_LEASE_OWNER = "local-worker";
const DEFAULT_LEASE_SECONDS = 300;

export async function listCharacterLoraCandidateImages(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);
  const querySchema = z.object({
    sectionId: z.string().trim().min(1).optional(),
    generationRunId: z.string().trim().min(1).optional(),
    reviewStatus: characterLoraImageReviewStatusSchema.optional(),
  }).strict();
  const parsed = parseWithSchema(querySchema, input);

  return listCandidateImagesFromRepository({
    jobId: id,
    sectionId: parsed.sectionId,
    generationRunId: parsed.generationRunId,
    reviewStatus: parsed.reviewStatus as CharacterLoraImageReviewStatus | undefined,
  });
}

export async function reviewCharacterLoraImages(input: unknown) {
  const parsed = parseWithSchema(characterLoraImageReviewBatchRequestSchema, input);
  return reviewCharacterLoraCandidateImages({
    images: parsed.images.map((image) => ({
      imageId: image.imageId,
      reviewStatus: image.reviewStatus,
      rejectReasons: image.rejectReasons ? toInputJsonValue(image.rejectReasons) : null,
      reviewNote: image.reviewNote ?? null,
    })),
  });
}

export async function updateCharacterLoraImageCaption(imageId: string, input: unknown) {
  const id = normalizeId(imageId, "imageId");
  const parsed = parseWithSchema(characterLoraCaptionPatchRequestSchema, input);
  const image = await getExistingCandidateImage(id);
  const job = await getExistingJob(image.jobId);

  return updateCharacterLoraCandidateCaption({
    imageId: id,
    captionDraft: normalizeCaptionTrigger(job.triggerToken, parsed.captionDraft),
  });
}

export async function listCharacterLoraDatasetRevisions(jobId: string) {
  const id = normalizeId(jobId, "jobId");
  await getExistingJob(id);
  return listDatasetRevisionsFromRepository(id);
}

export async function freezeCharacterLoraDataset(jobId: string, input: unknown = {}) {
  const id = normalizeId(jobId, "jobId");
  const parsed = parseWithSchema(characterLoraDatasetFreezeRequestSchema, input);
  const plan = await prepareDatasetFreezePlan(id, parsed);

  if (parsed.queue) {
    const payload = buildDatasetFreezeTaskPayload(plan);
    const task = await createCharacterLoraDatasetFreezeWorkerTask({
      jobId: plan.job.id,
      revisionId: plan.revisionId,
      taskPayload: payload,
    });

    return {
      queued: true,
      taskId: task.id,
      task,
      datasetRevisionId: plan.revisionId,
      version: plan.version,
      summary: buildQueuedDatasetFreezeSummary(plan),
    };
  }

  const materialized = await materializeCharacterLoraDatasetFreeze(plan);
  const revision = await createFrozenCharacterLoraDatasetRevision(materialized.revision);

  return {
    revision,
    summary: materialized.summary,
  };
}

export async function leaseNextCharacterLoraTask(input: unknown) {
  const parsed = parseWithSchema(characterLoraWorkerTaskLeaseRequestSchema, input);
  const leaseOwner = parsed.leaseOwner ?? DEFAULT_LEASE_OWNER;
  return leaseNextCharacterLoraWorkerTask({
    workerType: parsed.workerType as CharacterLoraWorkerType,
    leaseOwner,
    leaseExpiresAt: new Date(Date.now() + (parsed.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS) * 1000),
  });
}

export async function getCharacterLoraWorkerQueueStatus() {
  return getWorkerQueueStatusFromRepository();
}

export async function heartbeatCharacterLoraTask(taskId: string, input: unknown = {}) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskHeartbeatRequestSchema, input);

  const task = await heartbeatCharacterLoraWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    leaseExpiresAt: parsed.leaseDurationSeconds
      ? new Date(Date.now() + parsed.leaseDurationSeconds * 1000)
      : undefined,
    progressJson: parsed.progressJson ? toInputJsonValue(parsed.progressJson) : undefined,
  });

  if (!task) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return task;
}

export async function completeCharacterLoraTask(taskId: string, input: unknown) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskCompleteRequestSchema, input);
  const payload = await getTaskPayload(id, parsed.leaseOwner);

  if (payload.taskType === "training") {
    if (!parsed.output) {
      throw new CharacterLoraPhase3ServiceError("Training worker completion requires output", 400);
    }

    return completeCharacterLoraTrainingTask(id, {
      leaseOwner: parsed.leaseOwner,
      output: parsed.output,
    });
  }

  if (payload.taskType === "dataset_freeze") {
    return completeCharacterLoraDatasetFreezeTask(id, parsed.leaseOwner, payload);
  }

  if (payload.taskType === "prompt_card_draft") {
    const result = await completePromptCardDraftWorkerTask({
      taskId: id,
      leaseOwner: parsed.leaseOwner,
    });
    if (!result) {
      throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
    }
    return { task: result };
  }

  if (payload.taskType !== "image_generation") {
    throw new CharacterLoraPhase3ServiceError("Worker task completion is not supported for this task type", 409);
  }

  if (!parsed.output) {
    throw new CharacterLoraPhase3ServiceError("Image generation worker completion requires output", 400);
  }

  const imageOutput = parseWithSchema(characterLoraImageGenerationOutputSchema, parsed.output);
  const job = await getExistingJob(payload.jobId);
  const [workerRequest, workerResponseSummary] = await Promise.all([
    readJsonArtifactIfExists(job.artifactRoot, imageOutput.requestRedactedPath),
    readJsonArtifactIfExists(job.artifactRoot, imageOutput.responseSummaryPath),
  ]);
  const responseSummaryPayload = redactCharacterLoraProviderPayload({
    completedAt: new Date().toISOString(),
    generationRunId: payload.generationRunId,
    requestRedactedPath: imageOutput.requestRedactedPath,
    responseSummaryPath: imageOutput.responseSummaryPath,
    workerRequest,
    workerResponseSummary,
    output: imageOutput,
  });
  const responseSummary = await writeCharacterLoraJsonArtifact(
    job.artifactRoot,
    imageOutput.responseSummaryPath,
    responseSummaryPayload,
  );
  const imageArtifacts = await Promise.all(
    imageOutput.images.map(async (image) => {
      const resolved = resolveCharacterLoraArtifactPath(job.artifactRoot, image.relativePath);
      const stat = await statArtifactIfExists(job.artifactRoot, image.relativePath);

      return {
        relativePath: resolved.relativePath,
        absolutePath: resolved.absolutePath,
        sha256: stat?.sha256 ?? image.sha256,
        width: image.width ?? null,
        height: image.height ?? null,
        byteSize: stat ? BigInt(stat.byteSize) : null,
        metadata: toInputJsonValue({
          generationRunId: payload.generationRunId,
          metadataPath: image.metadataPath ?? null,
        }),
      };
    }),
  );

  const result = await completeImageGenerationWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    output: imageOutput,
    responseSummary: toInputJsonValue(responseSummaryPayload),
    imageArtifacts,
    responseSummaryArtifact: {
      relativePath: responseSummary.relativePath,
      absolutePath: responseSummary.absolutePath,
      sha256: responseSummary.sha256,
      byteSize: BigInt(responseSummary.byteSize),
      metadata: toInputJsonValue({
        generationRunId: payload.generationRunId,
        artifactRole: "response_summary",
      }),
    },
  });

  if (!result) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return result;
}

export async function failCharacterLoraTask(taskId: string, input: unknown) {
  const id = normalizeId(taskId, "taskId");
  const parsed = parseWithSchema(characterLoraWorkerTaskFailRequestSchema, input);
  const task = await failCharacterLoraWorkerTask({
    taskId: id,
    leaseOwner: parsed.leaseOwner,
    errorSummary: parsed.errorSummary,
    progressJson: parsed.providerError ? toInputJsonValue({ providerError: parsed.providerError }) : undefined,
  });

  if (!task) {
    throw new CharacterLoraPhase3ServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  return task;
}

export function mapCharacterLoraPhase3Error(error: unknown) {
  if (error instanceof CharacterLoraTrainingServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof CharacterLoraPhase3ServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [];
      if (target.includes("jobId") && target.includes("version")) {
        return {
          message: "Dataset revision version already exists; enqueue a fresh dataset freeze to allocate a new version",
          status: 409,
        };
      }
      return { message: "Character LoRA Phase 3 record already exists", status: 409 };
    }
    if (error.code === "P2025") {
      return { message: "Character LoRA Phase 3 record not found", status: 404 };
    }
    if (error.code === "P2003") {
      return { message: "Character LoRA Phase 3 record references missing data", status: 409 };
    }
  }

  if (error instanceof Error) {
    return { message: error.message, status: 400 };
  }

  return {
    message: "Unexpected character LoRA Phase 3 error",
    status: 500,
    details: "An internal error occurred",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getTaskPayload(taskId: string, leaseOwner?: string) {
  const task = await getCharacterLoraWorkerTask(taskId);

  if (!task || task.status !== "running") {
    throw new CharacterLoraPhase3ServiceError("Worker task not found or not running", 404);
  }

  if (leaseOwner && task.leaseOwner !== leaseOwner) {
    throw new CharacterLoraPhase3ServiceError("Worker task lease owner mismatch", 404);
  }

  return parseWithSchema(characterLoraWorkerTaskPayloadSchema, task.payload);
}

async function statArtifactIfExists(jobRoot: string, relativePath: string) {
  try {
    return await statCharacterLoraArtifact(jobRoot, relativePath);
  } catch {
    return null;
  }
}

async function readJsonArtifactIfExists(jobRoot: string, relativePath: string) {
  const resolved = resolveCharacterLoraArtifactPath(jobRoot, relativePath);

  try {
    return JSON.parse(await readFile(resolved.absolutePath, "utf8")) as unknown;
  } catch (error) {
    if (isFileNotFoundError(error)) return null;
    throw error;
  }
}

function isFileNotFoundError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
