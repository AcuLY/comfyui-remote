import { randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";

import { Prisma } from "@/generated/prisma";
import { CharacterLoraServiceError } from "@/server/services/character-lora-training/shared/service-error";
import {
  normalizeId as sharedNormalizeId,
  toInputJsonValue,
  asJsonRecord,
} from "@/server/services/character-lora-training/shared/service-utils";
import {
  characterLoraTrainingCompleteOutputSchema,
  characterLoraTrainingEnqueueRequestSchema,
  characterLoraTrainingCancelRequestSchema,
  characterLoraTrainingResolvedConfigSchema,
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraArtifactRef,
  type CharacterLoraBenchmarkEnqueueRequest,
  type CharacterLoraPostTrainingBenchmark,
  type CharacterLoraTrainingEnqueueRequest,
  type CharacterLoraTrainingResolvedConfig,
} from "@/server/character-lora-training/contracts";
import {
  cancelCharacterLoraTrainingRun as cancelTrainingRunInRepository,
  completeTrainingWorkerTask,
  countActiveComfyQueueRuns,
  createCharacterLoraJobArtifact,
  createCharacterLoraTrainingRunWithTask,
  failCharacterLoraWorkerTask,
  getCharacterLoraDatasetRevision,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingRun,
  getCharacterLoraWorkerTask,
  getCharacterLoraWorkerTaskForTarget,
  getCurrentCharacterLoraGpuTaskLock,
  listActiveCharacterLoraGpuTaskLocks,
  listCharacterLoraTrainingRuns as listTrainingRunsFromRepository,
} from "@/server/repositories/character-lora-training-repository";
import {
  resolveCharacterLoraArtifactPath,
  statCharacterLoraArtifact,
  writeCharacterLoraJsonArtifact,
  writeCharacterLoraTextArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { enqueueCharacterLoraBenchmarkRun } from "@/server/services/character-lora-training/benchmark-promotion-service";
import { z } from "zod";

const DEFAULT_LEASE_OWNER = "training-worker";
const DEFAULT_LEASE_SECONDS = 300;

export class CharacterLoraTrainingServiceError extends CharacterLoraServiceError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message, status, details);
    this.name = "CharacterLoraTrainingServiceError";
  }
}

export async function enqueueCharacterLoraTrainingRun(datasetRevisionId: string, input: unknown = {}) {
  const normalizedRevisionId = normalizeId(datasetRevisionId, "datasetRevisionId");
  const parsed = parseWithSchema(characterLoraTrainingEnqueueRequestSchema, input);
  const revision = await getExistingDatasetRevision(normalizedRevisionId);

  if (revision.status !== "frozen") {
    throw new CharacterLoraTrainingServiceError("Dataset revision must be frozen before training", 409, {
      datasetRevisionId: revision.id,
      status: revision.status,
    });
  }

  const job = await getExistingJob(revision.jobId);
  if (!job.baseCheckpointPath) {
    throw new CharacterLoraTrainingServiceError("Training job is missing baseCheckpointPath", 409, {
      jobId: job.id,
    });
  }

  await assertBaseCheckpointExists(job.baseCheckpointPath);

  const [queue, activeLocks] = await Promise.all([
    countActiveComfyQueueRuns(),
    listActiveCharacterLoraGpuTaskLocks(),
  ]);
  const busyDetails = {
    comfyQueue: queue,
    gpuTaskLocks: activeLocks,
  };
  const isBusy = queue.queued > 0 || queue.running > 0 || activeLocks.length > 0;
  const allowBusy = parsed.allowWhenComfyQueueBusy === true || parsed.queuePolicy !== "reject_when_busy";
  const warnings: string[] = [];

  if (isBusy && !allowBusy) {
    throw new CharacterLoraTrainingServiceError("GPU is busy; training enqueue rejected", 409, busyDetails);
  }

  if (queue.queued > 0 || queue.running > 0) {
    warnings.push(`ComfyUI queue is busy: queued=${queue.queued}, running=${queue.running}`);
  }
  if (activeLocks.length > 0) {
    warnings.push(`Active GPU task lock exists: ${activeLocks.map((lock) => lock.id).join(", ")}`);
  }

  const trainingRunId = randomUUID();
  const outputDir = `training-runs/${trainingRunId}`;
  const cancelSignalPath = `${outputDir}/${parsed.cancel?.signalFilename ?? "cancel-signal.json"}`;
  const resolvedConfig = resolveTrainingConfig(parsed, job.trainingTemplateSnapshot);
  warnings.push(...getTrainingConfigWarnings(resolvedConfig));
  const postTrainingBenchmarkSummary = summarizePostTrainingBenchmark(parsed.postTrainingBenchmark);
  const tomlPath = `${outputDir}/training.toml`;
  const dryRunSummaryPath = `${outputDir}/dry-run-summary.json`;
  const configArtifactStat = await writeCharacterLoraTextArtifact(
    job.artifactRoot,
    tomlPath,
    renderTrainingToml(resolvedConfig),
  );
  const dryRunSummary = {
    trainingRunId,
    jobId: job.id,
    datasetRevisionId: revision.id,
    launcher: parsed.launcher,
    baseCheckpointPath: job.baseCheckpointPath,
    baseCheckpointHash: job.baseCheckpointHash,
    outputDir,
    cancelSignalPath,
    queuePolicy: parsed.queuePolicy,
    postTrainingBenchmark: postTrainingBenchmarkSummary,
    warnings,
    resolvedConfig,
    createdAt: new Date().toISOString(),
  };
  const dryRunArtifactStat = await writeCharacterLoraJsonArtifact(job.artifactRoot, dryRunSummaryPath, dryRunSummary);
  const taskPayload = parseWithSchema(characterLoraWorkerTaskPayloadSchema, {
    taskType: "training",
    jobId: job.id,
    trainingRunId,
    datasetRevisionId: revision.id,
    baseCheckpointPath: job.baseCheckpointPath,
    baseCheckpointHash: job.baseCheckpointHash ?? undefined,
    baseFamily: job.baseFamily ?? undefined,
    launcher: parsed.launcher,
    resolvedConfig,
    outputDir,
    cancelSignalPath,
    postTrainingBenchmark: parsed.postTrainingBenchmark,
  });

  if (taskPayload.taskType !== "training") {
    throw new CharacterLoraTrainingServiceError("Invalid training task payload", 500);
  }

  return createCharacterLoraTrainingRunWithTask({
    trainingRunId,
    jobId: job.id,
    datasetRevisionId: revision.id,
    launcher: parsed.launcher,
    resolvedConfig: toInputJsonValue(resolvedConfig),
    outputDir,
    configArtifact: {
      relativePath: configArtifactStat.relativePath,
      absolutePath: configArtifactStat.absolutePath,
      sha256: configArtifactStat.sha256,
      byteSize: BigInt(configArtifactStat.byteSize),
      metadata: toInputJsonValue({
        trainingRunId,
        datasetRevisionId: revision.id,
        artifactRole: "training_toml",
      }),
    },
    dryRunSummaryArtifact: {
      relativePath: dryRunArtifactStat.relativePath,
      absolutePath: dryRunArtifactStat.absolutePath,
      sha256: dryRunArtifactStat.sha256,
      byteSize: BigInt(dryRunArtifactStat.byteSize),
      metadata: toInputJsonValue({
        trainingRunId,
        datasetRevisionId: revision.id,
        artifactRole: "dry_run_summary",
        warnings,
      }),
    },
    taskPayload,
    gpuLockMetadata: toInputJsonValue({
      trainingRunId,
      jobId: job.id,
      datasetRevisionId: revision.id,
      workerType: "training",
      leaseOwner: parsed.lease?.leaseOwner ?? DEFAULT_LEASE_OWNER,
      leaseDurationSeconds: parsed.lease?.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS,
      postTrainingBenchmark: postTrainingBenchmarkSummary,
      warnings,
    }),
  });
}

export async function listCharacterLoraTrainingRuns(jobId: string) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  await getExistingJob(normalizedJobId);
  return listTrainingRunsFromRepository(normalizedJobId);
}

export async function getCharacterLoraTrainingRunStatus(trainingRunId: string) {
  const normalizedTrainingRunId = normalizeId(trainingRunId, "trainingRunId");
  const run = await getCharacterLoraTrainingRun(normalizedTrainingRunId);

  if (!run) {
    throw new CharacterLoraTrainingServiceError("Character LoRA training run not found", 404);
  }

  return run;
}

export async function getCharacterLoraGpuTaskLock() {
  const [current, activeLocks] = await Promise.all([
    getCurrentCharacterLoraGpuTaskLock(),
    listActiveCharacterLoraGpuTaskLocks(),
  ]);

  return {
    current,
    activeLocks,
  };
}

export async function completeCharacterLoraTrainingTask(taskId: string, input: {
  leaseOwner?: string;
  output: unknown;
}) {
  const normalizedTaskId = normalizeId(taskId, "taskId");
  const output = parseWithSchema(characterLoraTrainingCompleteOutputSchema, input.output);
  const task = await getTaskPayload(normalizedTaskId, input.leaseOwner);

  if (task.taskType !== "training") {
    throw new CharacterLoraTrainingServiceError("Worker task is not a training task", 409);
  }

  if (
    output.finalSha256 &&
    output.finalSafetensorsArtifact.sha256 &&
    output.finalSha256 !== output.finalSafetensorsArtifact.sha256
  ) {
    await failCharacterLoraWorkerTask({
      taskId: normalizedTaskId,
      leaseOwner: input.leaseOwner,
      errorSummary: "final safetensors payload sha256 mismatch",
      progressJson: toInputJsonValue({
        finalSha256: output.finalSha256,
        artifactSha256: output.finalSafetensorsArtifact.sha256,
      }),
    });
    throw new CharacterLoraTrainingServiceError("final safetensors payload sha256 mismatch", 409, {
      finalSha256: output.finalSha256,
      artifactSha256: output.finalSafetensorsArtifact.sha256,
    });
  }

  const job = await getExistingJob(task.jobId);
  const finalArtifact = await resolveCompletedArtifactOrFail({
    jobRoot: job.artifactRoot,
    taskId: normalizedTaskId,
    leaseOwner: input.leaseOwner,
    ref: output.finalSafetensorsArtifact,
    expectedSha256: output.finalSha256 ?? output.finalSafetensorsArtifact.sha256,
    errorLabel: "final safetensors",
  });
  await assertUsableSafetensorsArtifact({
    taskId: normalizedTaskId,
    leaseOwner: input.leaseOwner,
    finalArtifact,
    metadataSummary: output.metadataSummary,
  });
  const logArtifact = output.trainingLogArtifact
    ? await resolveOptionalCompletedArtifact({
        jobRoot: job.artifactRoot,
        ref: output.trainingLogArtifact,
        errorLabel: "training log",
      })
    : null;
  const checkpoints = [];

  for (const checkpoint of output.checkpoints) {
    const artifact = await resolveCompletedArtifactOrFail({
      jobRoot: job.artifactRoot,
      taskId: normalizedTaskId,
      leaseOwner: input.leaseOwner,
      ref: checkpoint.artifact,
      expectedSha256: checkpoint.artifact.sha256,
      errorLabel: `checkpoint ${checkpoint.step}`,
    });

    checkpoints.push({
      step: checkpoint.step,
      relativePath: artifact.relativePath,
      absolutePath: artifact.absolutePath,
      sha256: artifact.sha256,
      byteSize: artifact.byteSize,
      metrics: checkpoint.metrics ? toInputJsonValue(checkpoint.metrics) : null,
    });
  }

  if (output.hashes && Object.keys(output.hashes).length > 0) {
    const hashesArtifact = await writeCharacterLoraJsonArtifact(job.artifactRoot, `${task.outputDir}/hashes.json`, {
      trainingRunId: task.trainingRunId,
      hashes: output.hashes,
    });
    await createCharacterLoraJobArtifact({
      jobId: job.id,
      kind: "training_log",
      relativePath: hashesArtifact.relativePath,
      absolutePath: hashesArtifact.absolutePath,
      sha256: hashesArtifact.sha256,
      byteSize: BigInt(hashesArtifact.byteSize),
      mimeType: "application/json",
      metadata: toInputJsonValue({
        trainingRunId: task.trainingRunId,
        artifactRole: "hashes",
      }),
    });
  }

  const result = await completeTrainingWorkerTask({
    taskId: normalizedTaskId,
    leaseOwner: input.leaseOwner,
    output: {
      ...output,
      finalSha256: finalArtifact.sha256,
    },
    finalArtifact: {
      relativePath: finalArtifact.relativePath,
      absolutePath: finalArtifact.absolutePath,
      sha256: finalArtifact.sha256,
      byteSize: finalArtifact.byteSize,
      metadata: toInputJsonValue({
        trainingRunId: task.trainingRunId,
        datasetRevisionId: task.datasetRevisionId,
        metadataSummary: output.metadataSummary,
        hashes: output.hashes ?? {},
      }),
    },
    logArtifact: logArtifact
      ? {
          relativePath: logArtifact.relativePath,
          absolutePath: logArtifact.absolutePath,
          sha256: logArtifact.sha256,
          byteSize: logArtifact.byteSize,
          metadata: toInputJsonValue({
            trainingRunId: task.trainingRunId,
            artifactRole: "training_log",
          }),
        }
      : null,
    checkpoints,
  });

  if (!result) {
    throw new CharacterLoraTrainingServiceError("Worker task not found, not running, or lease owner mismatch", 404);
  }

  const postTrainingBenchmark = result.trainingRun
    ? await enqueuePostTrainingBenchmarkAfterCompletion(result.trainingRun.id, task.postTrainingBenchmark)
    : null;

  return postTrainingBenchmark
    ? {
        ...result,
        postTrainingBenchmark,
      }
    : result;
}

export async function cancelTrainingRun(trainingRunId: string, input: unknown = {}) {
  const normalizedTrainingRunId = normalizeId(trainingRunId, "trainingRunId");
  const parsed = parseWithSchema(characterLoraTrainingCancelRequestSchema, input);
  const run = await getCharacterLoraTrainingRun(normalizedTrainingRunId);
  if (!run) {
    throw new CharacterLoraTrainingServiceError("Training run not found", 404);
  }

  if (run.status !== "queued" && run.status !== "running") {
    throw new CharacterLoraTrainingServiceError("Only queued or running training runs can be cancelled", 409, {
      trainingRunId: run.id,
      status: run.status,
    });
  }

  const job = await getExistingJob(run.jobId);
  const task = await getCharacterLoraWorkerTaskForTarget({
    targetType: "trainingRun",
    targetId: run.id,
  });
  const cancelSignalPath = task ? getCancelSignalPathFromTaskPayload(task.payload, run.outputDir) : null;
  const cancelSignalArtifact = cancelSignalPath
    ? await writeCharacterLoraJsonArtifact(job.artifactRoot, cancelSignalPath, {
        trainingRunId: run.id,
        requestedAt: new Date().toISOString(),
        requestedBy: parsed.requestedBy ?? null,
        reason: parsed.reason ?? null,
      })
    : null;

  const cancelled = await cancelTrainingRunInRepository({
    trainingRunId: run.id,
    reason: parsed.reason ?? null,
    requestedBy: parsed.requestedBy ?? null,
    cancelSignalArtifact: cancelSignalArtifact
      ? {
          relativePath: cancelSignalArtifact.relativePath,
          absolutePath: cancelSignalArtifact.absolutePath,
          sha256: cancelSignalArtifact.sha256,
          byteSize: BigInt(cancelSignalArtifact.byteSize),
          metadata: toInputJsonValue({
            trainingRunId: run.id,
            artifactRole: "cancel_signal",
          }),
        }
      : null,
  });

  if (!cancelled) {
    throw new CharacterLoraTrainingServiceError("Training run not found", 404);
  }

  return cancelled;
}

export function mapCharacterLoraTrainingError(error: unknown) {
  if (error instanceof CharacterLoraTrainingServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { message: "Character LoRA training record already exists", status: 409 };
    }
    if (error.code === "P2025") {
      return { message: "Character LoRA training record not found", status: 404 };
    }
    if (error.code === "P2003") {
      return { message: "Character LoRA training record references missing data", status: 409 };
    }
  }

  if (error instanceof Error) {
    return { message: error.message, status: 400 };
  }

  return {
    message: "Unexpected character LoRA training error",
    status: 500,
    details: "An internal error occurred",
  };
}

function resolveTrainingConfig(
  input: CharacterLoraTrainingEnqueueRequest,
  trainingTemplateSnapshot: unknown,
): CharacterLoraTrainingResolvedConfig {
  const profileDefaults = resolveProfileDefaults(input.configProfile);
  const recipeDefaults = readRecipeTrainingDefaults(trainingTemplateSnapshot);
  const candidate = {
    profile: input.configProfile,
    launcher: input.launcher,
    ordinary: {
      rank: 32,
      alpha: 16,
      resolution: 1024,
      bucket: true,
      precision: "bf16" as const,
      batchSize: 1,
      gradientAccumulation: 1,
      targetSteps: 2000,
      saveInterval: profileDefaults.saveInterval,
      ...recipeDefaults.ordinary,
      ...input.overrides?.ordinary,
    },
    advanced: {
      unetLearningRate: profileDefaults.unetLearningRate,
      textEncoderLearningRate: 0.00002,
      trainTextEncoder: true,
      networkModule: "networks.lora",
      optimizer: "adamw8bit",
      lrScheduler: "cosine",
      minBucketResolution: 512,
      maxBucketResolution: 1536,
      ...recipeDefaults.advanced,
      ...input.advanced,
      ...input.overrides?.advanced,
    },
    expert: {
      ...recipeDefaults.expert,
      ...(input.expert ?? {}),
      ...(input.overrides?.expert ?? {}),
    },
  };
  candidate.expert = normalizeExpertTrainingConfig(candidate.expert);

  if (!candidate.advanced.trainTextEncoder) {
    candidate.advanced.textEncoderLearningRate = null;
  }

  return parseWithSchema(characterLoraTrainingResolvedConfigSchema, candidate);
}

function readRecipeTrainingDefaults(snapshot: unknown) {
  const snapshotRecord = asJsonRecord(snapshot);
  const trainingDefaults = asJsonRecord(snapshotRecord.trainingDefaults);
  const configProfiles = asJsonRecord(trainingDefaults.configProfiles);
  const ordinarySource = mergeRecords(asJsonRecord(trainingDefaults.ordinary), asJsonRecord(configProfiles.ordinary));
  const advancedSource = mergeRecords(asJsonRecord(trainingDefaults.advanced), asJsonRecord(configProfiles.advanced));
  const expertSource = mergeRecords(asJsonRecord(trainingDefaults.expert), asJsonRecord(configProfiles.expert));
  const precision = readString(ordinarySource, "precision") ?? readString(advancedSource, "mixedPrecision");
  const learningRate = readNumber(ordinarySource, "learningRate") ?? readNumber(advancedSource, "learningRate");

  return {
    ordinary: stripUndefined({
      rank: readInteger(ordinarySource, "rank") ?? readInteger(ordinarySource, "networkDim"),
      alpha: readInteger(ordinarySource, "alpha") ?? readInteger(ordinarySource, "networkAlpha"),
      resolution: readInteger(ordinarySource, "resolution"),
      bucket: readBoolean(ordinarySource, "bucket"),
      precision: isTrainingPrecision(precision) ? precision : undefined,
      batchSize: readInteger(ordinarySource, "batchSize"),
      gradientAccumulation: readInteger(ordinarySource, "gradientAccumulation"),
      targetSteps: readInteger(ordinarySource, "targetSteps") ?? readInteger(ordinarySource, "steps"),
      saveInterval: readInteger(ordinarySource, "saveInterval"),
    }),
    advanced: stripUndefined({
      unetLearningRate: readNumber(advancedSource, "unetLearningRate") ?? learningRate,
      textEncoderLearningRate: readNullableNumber(advancedSource, "textEncoderLearningRate"),
      trainTextEncoder: readBoolean(advancedSource, "trainTextEncoder"),
      networkModule: readString(advancedSource, "networkModule"),
      optimizer: readString(advancedSource, "optimizer"),
      lrScheduler: readString(advancedSource, "lrScheduler"),
      minBucketResolution: readInteger(advancedSource, "minBucketResolution"),
      maxBucketResolution: readInteger(advancedSource, "maxBucketResolution"),
      seed: readInteger(advancedSource, "seed"),
    }),
    expert: expertSource,
  };
}

function mergeRecords(...records: Array<Record<string, unknown>>) {
  return Object.assign({}, ...records);
}

function stripUndefined<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readNullableNumber(record: Record<string, unknown>, key: string) {
  if (!(key in record)) return undefined;
  const value = record[key];
  return value === null || (typeof value === "number" && Number.isFinite(value)) ? value : undefined;
}

function readInteger(record: Record<string, unknown>, key: string) {
  const value = readNumber(record, key);
  return value !== undefined && Number.isInteger(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isTrainingPrecision(value: string | undefined): value is "bf16" | "fp16" | "fp32" {
  return value === "bf16" || value === "fp16" || value === "fp32";
}

function normalizeExpertTrainingConfig(expert: Record<string, unknown>) {
  if (expert.cacheTextEncoderOutputs !== true) {
    return expert;
  }

  return {
    ...expert,
    shuffleCaption: false,
    captionShuffle: false,
    captionDropoutRate: 0,
    captionTagDropoutRate: 0,
    tagDropoutRate: 0,
    textEncoderDropout: 0,
  };
}

function getTrainingConfigWarnings(config: CharacterLoraTrainingResolvedConfig) {
  if (config.expert.cacheTextEncoderOutputs !== true) {
    return [];
  }

  return [
    "cacheTextEncoderOutputs enabled; caption shuffle/dropout options were forced off in the resolved config.",
  ];
}

async function enqueuePostTrainingBenchmarkAfterCompletion(
  trainingRunId: string,
  config: CharacterLoraPostTrainingBenchmark,
) {
  if (!config.enabled) {
    return null;
  }

  const benchmarkInput = buildPostTrainingBenchmarkInput(config);
  try {
    return await enqueueCharacterLoraBenchmarkRun(trainingRunId, benchmarkInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CharacterLoraTrainingServiceError(`Post-training benchmark enqueue failed: ${message}`, getErrorStatus(error), {
      trainingRunId,
      postTrainingBenchmark: summarizePostTrainingBenchmark(config),
      causeDetails: getErrorDetails(error),
    });
  }
}

function buildPostTrainingBenchmarkInput(config: CharacterLoraPostTrainingBenchmark): CharacterLoraBenchmarkEnqueueRequest {
  if (!config.enabled || !config.checkpointMatrix || !config.weightMatrix) {
    throw new CharacterLoraTrainingServiceError("Post-training benchmark config is enabled but incomplete", 400, {
      postTrainingBenchmark: summarizePostTrainingBenchmark(config),
    });
  }

  return {
    checkpointMatrix: config.checkpointMatrix,
    weightMatrix: config.weightMatrix,
    templateId: config.templateId,
    registerLoraAsset: config.registerLoraAsset,
    copyToCharacterDir: config.copyToCharacterDir,
    loraAssetName: config.loraAssetName,
    queuePolicy: config.queuePolicy,
    dryRun: config.dryRun,
    skipQueue: config.skipQueue,
  };
}

function summarizePostTrainingBenchmark(config: CharacterLoraPostTrainingBenchmark) {
  return {
    enabled: config.enabled,
    checkpointCount: config.checkpointMatrix?.length ?? 0,
    weightCount: config.weightMatrix?.length ?? 0,
    templateId: config.templateId ?? null,
    registerLoraAsset: config.registerLoraAsset,
    copyToCharacterDir: config.copyToCharacterDir,
    loraAssetName: config.loraAssetName ?? null,
    queuePolicy: config.queuePolicy,
    dryRun: config.dryRun,
    skipQueue: config.skipQueue,
  };
}

function getErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) {
      return status;
    }
  }

  return 500;
}

function getErrorDetails(error: unknown) {
  if (typeof error === "object" && error !== null && "details" in error) {
    return (error as { details?: unknown }).details;
  }

  return undefined;
}

function resolveProfileDefaults(profile: CharacterLoraTrainingEnqueueRequest["configProfile"]) {
  if (profile === "conservative") {
    return { unetLearningRate: 0.00007, saveInterval: 500 };
  }
  if (profile === "strong") {
    return { unetLearningRate: 0.0001, saveInterval: 250 };
  }
  return { unetLearningRate: 0.0001, saveInterval: 500 };
}

function renderTrainingToml(config: CharacterLoraTrainingResolvedConfig) {
  const lines = [
    `profile = ${formatTomlValue(config.profile)}`,
    `launcher = ${formatTomlValue(config.launcher)}`,
    "",
    "[ordinary]",
    ...Object.entries(config.ordinary).map(([key, value]) => `${key} = ${formatTomlValue(value)}`),
    "",
    "[advanced]",
    ...Object.entries(config.advanced).map(([key, value]) => `${key} = ${formatTomlValue(value)}`),
    "",
    "[expert]",
    ...Object.entries(config.expert).map(([key, value]) => `${key} = ${formatTomlValue(value)}`),
  ];

  return `${lines.join("\n")}\n`;
}

function formatTomlValue(value: unknown): string {
  if (value === null) {
    return '""';
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatTomlValue).join(", ")}]`;
  }
  return JSON.stringify(value);
}

async function assertBaseCheckpointExists(baseCheckpointPath: string) {
  try {
    const fileStat = await stat(baseCheckpointPath);
    if (!fileStat.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new CharacterLoraTrainingServiceError("Training base checkpoint path does not exist", 409, {
      baseCheckpointPath,
    });
  }
}

async function getExistingDatasetRevision(datasetRevisionId: string) {
  const revision = await getCharacterLoraDatasetRevision(datasetRevisionId);
  if (!revision) {
    throw new CharacterLoraTrainingServiceError("Dataset revision not found", 404);
  }
  return revision;
}

async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  if (!job) {
    throw new CharacterLoraTrainingServiceError("Character LoRA training job not found", 404);
  }
  return job;
}

async function getTaskPayload(taskId: string, leaseOwner?: string) {
  const task = await getCharacterLoraWorkerTask(taskId);

  if (!task || task.status !== "running") {
    throw new CharacterLoraTrainingServiceError("Worker task not found or not running", 404);
  }

  if (leaseOwner && task.leaseOwner !== leaseOwner) {
    throw new CharacterLoraTrainingServiceError("Worker task lease owner mismatch", 404);
  }

  return parseWithSchema(characterLoraWorkerTaskPayloadSchema, task.payload);
}

async function resolveCompletedArtifactOrFail(input: {
  jobRoot: string;
  taskId: string;
  leaseOwner?: string;
  ref: CharacterLoraArtifactRef;
  expectedSha256?: string;
  errorLabel: string;
}) {
  const resolved = resolveCharacterLoraArtifactPath(input.jobRoot, input.ref.relativePath);
  const statResult = await statArtifactIfExists(input.jobRoot, input.ref.relativePath);
  const actualSha256 = statResult?.sha256 ?? input.expectedSha256;

  if (!actualSha256) {
    await failCharacterLoraWorkerTask({
      taskId: input.taskId,
      leaseOwner: input.leaseOwner,
      errorSummary: `${input.errorLabel} is missing sha256 and no file exists`,
    });
    throw new CharacterLoraTrainingServiceError(`${input.errorLabel} is missing sha256 and no file exists`, 409);
  }

  if (statResult && input.expectedSha256 && statResult.sha256 !== input.expectedSha256) {
    await failCharacterLoraWorkerTask({
      taskId: input.taskId,
      leaseOwner: input.leaseOwner,
      errorSummary: `${input.errorLabel} sha256 mismatch`,
      progressJson: toInputJsonValue({
        expectedSha256: input.expectedSha256,
        actualSha256: statResult.sha256,
      }),
    });
    throw new CharacterLoraTrainingServiceError(`${input.errorLabel} sha256 mismatch`, 409, {
      expectedSha256: input.expectedSha256,
      actualSha256: statResult.sha256,
    });
  }

  return {
    relativePath: resolved.relativePath,
    absolutePath: resolved.absolutePath,
    sha256: actualSha256,
    byteSize: statResult ? BigInt(statResult.byteSize) : null,
  };
}

async function resolveOptionalCompletedArtifact(input: {
  jobRoot: string;
  ref: CharacterLoraArtifactRef;
  errorLabel: string;
}) {
  const resolved = resolveCharacterLoraArtifactPath(input.jobRoot, input.ref.relativePath);
  const statResult = await statArtifactIfExists(input.jobRoot, input.ref.relativePath);
  const sha256 = statResult?.sha256 ?? input.ref.sha256;

  if (!sha256) {
    throw new CharacterLoraTrainingServiceError(`${input.errorLabel} is missing sha256 and no file exists`, 409);
  }

  return {
    relativePath: resolved.relativePath,
    absolutePath: resolved.absolutePath,
    sha256,
    byteSize: statResult ? BigInt(statResult.byteSize) : null,
  };
}

async function assertUsableSafetensorsArtifact(input: {
  taskId: string;
  leaseOwner?: string;
  finalArtifact: { relativePath: string; absolutePath: string };
  metadataSummary: { keyCount: number };
}) {
  if (input.metadataSummary.keyCount <= 0) {
    await failCharacterLoraWorkerTask({
      taskId: input.taskId,
      leaseOwner: input.leaseOwner,
      errorSummary: "final safetensors metadata keyCount must be greater than 0",
      progressJson: toInputJsonValue({
        relativePath: input.finalArtifact.relativePath,
        keyCount: input.metadataSummary.keyCount,
      }),
    });
    throw new CharacterLoraTrainingServiceError(
      "final safetensors metadata keyCount must be greater than 0",
      409,
      { relativePath: input.finalArtifact.relativePath, keyCount: input.metadataSummary.keyCount },
    );
  }

  const header = await readSafetensorsHeader(input.finalArtifact.absolutePath);
  if (header.keyCount <= 0) {
    await failCharacterLoraWorkerTask({
      taskId: input.taskId,
      leaseOwner: input.leaseOwner,
      errorSummary: "final safetensors header does not contain tensor keys",
      progressJson: toInputJsonValue({
        relativePath: input.finalArtifact.relativePath,
        header,
      }),
    });
    throw new CharacterLoraTrainingServiceError(
      "final safetensors header does not contain tensor keys",
      409,
      { relativePath: input.finalArtifact.relativePath, header },
    );
  }

  if (header.keyCount !== input.metadataSummary.keyCount) {
    await failCharacterLoraWorkerTask({
      taskId: input.taskId,
      leaseOwner: input.leaseOwner,
      errorSummary: "final safetensors metadata keyCount does not match file header",
      progressJson: toInputJsonValue({
        relativePath: input.finalArtifact.relativePath,
        reportedKeyCount: input.metadataSummary.keyCount,
        headerKeyCount: header.keyCount,
      }),
    });
    throw new CharacterLoraTrainingServiceError(
      "final safetensors metadata keyCount does not match file header",
      409,
      {
        relativePath: input.finalArtifact.relativePath,
        reportedKeyCount: input.metadataSummary.keyCount,
        headerKeyCount: header.keyCount,
      },
    );
  }
}

async function readSafetensorsHeader(filePath: string) {
  const handle = await open(filePath, "r");
  try {
    const prefix = Buffer.alloc(8);
    const prefixRead = await handle.read(prefix, 0, prefix.byteLength, 0);
    if (prefixRead.bytesRead !== prefix.byteLength) {
      throw new CharacterLoraTrainingServiceError("safetensors file is missing its header length prefix", 409, {
        filePath,
      });
    }

    const headerLength = Number(prefix.readBigUInt64LE(0));
    if (!Number.isSafeInteger(headerLength) || headerLength <= 0 || headerLength > 64 * 1024 * 1024) {
      throw new CharacterLoraTrainingServiceError("safetensors header length is invalid", 409, {
        filePath,
        headerLength,
      });
    }

    const headerBuffer = Buffer.alloc(headerLength);
    const headerRead = await handle.read(headerBuffer, 0, headerLength, 8);
    if (headerRead.bytesRead !== headerLength) {
      throw new CharacterLoraTrainingServiceError("safetensors file header is truncated", 409, {
        filePath,
        headerLength,
        bytesRead: headerRead.bytesRead,
      });
    }

    const parsed = JSON.parse(headerBuffer.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CharacterLoraTrainingServiceError("safetensors header is not a JSON object", 409, { filePath });
    }

    const keys = Object.keys(parsed).filter((key) => key !== "__metadata__");
    return {
      headerLength,
      keyCount: keys.length,
      metadataKeys: Object.keys((parsed as Record<string, unknown>).__metadata__ ?? {}),
    };
  } catch (error) {
    if (error instanceof CharacterLoraTrainingServiceError) {
      throw error;
    }
    throw new CharacterLoraTrainingServiceError("failed to read final safetensors metadata", 409, {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await handle.close();
  }
}

async function statArtifactIfExists(jobRoot: string, relativePath: string) {
  try {
    return await statCharacterLoraArtifact(jobRoot, relativePath);
  } catch {
    return null;
  }
}

function getCancelSignalPathFromTaskPayload(payload: unknown, fallbackOutputDir: string | null) {
  const parsed = characterLoraWorkerTaskPayloadSchema.safeParse(payload);
  if (parsed.success && parsed.data.taskType === "training") {
    return parsed.data.cancelSignalPath;
  }

  return fallbackOutputDir ? `${fallbackOutputDir}/cancel-signal.json` : null;
}

function normalizeId(value: string, fieldName: string) {
  return sharedNormalizeId(value, fieldName, CharacterLoraTrainingServiceError);
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new CharacterLoraTrainingServiceError("Invalid character LoRA training request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

