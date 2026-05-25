import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@/generated/prisma";
import { env } from "@/lib/env";
import { CharacterLoraServiceError } from "@/server/services/character-lora-training/shared/service-error";
import {
  normalizeId as sharedNormalizeId,
  toInputJsonValue,
  readJsonRecord,
} from "@/server/services/character-lora-training/shared/service-utils";
import {
  characterLoraBenchmarkCompleteRequestSchema,
  characterLoraBenchmarkCleanupRequestSchema,
  characterLoraBenchmarkEnqueueRequestSchema,
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraBenchmarkCompleteRequest,
  type CharacterLoraBenchmarkCleanupRequest,
  type CharacterLoraBenchmarkEnqueueRequest,
} from "@/server/character-lora-training/contracts";
import {
  cleanupCharacterLoraBenchmarkTemporaryResourcesInRepository,
  completeCharacterLoraBenchmarkRunInRepository,
  countActiveComfyQueueRuns,
  createCharacterLoraBenchmarkRunWithTask,
  ensureCharacterLoraBenchmarkTemplateInRepository,
  findCharacterLoraBenchmarkTemplate,
  getCharacterLoraBenchmarkTemplateStatusInRepository,
  getCharacterLoraBenchmarkTemplateById,
  getCharacterLoraArtifact,
  getCharacterLoraBenchmarkRun,
  getCharacterLoraBenchmarkMatrixExpansionSummary,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingRunWithFinalArtifact,
  listActiveCharacterLoraGpuTaskLocks,
  listCharacterLoraBenchmarkRunsByJob,
  listCharacterLoraBenchmarkRunsByTrainingRun,
  upsertCharacterLoraAsset,
} from "@/server/repositories/character-lora-training-repository";
import {
  resolveCharacterLoraArtifactPath,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared constants (also used by promotion-service)
// ---------------------------------------------------------------------------

export const ROLE_CATEGORY_NAME = "角色";
export const ROLE_CATEGORY_SLUG = "character";

export const STANDARD_VARIANTS = [
  { name: "默认", slug: "default", promptSuffix: "" },
  { name: "内裤", slug: "underwear", promptSuffix: "underwear outfit" },
  { name: "内裤+脱鞋", slug: "underwear-shoes-off", promptSuffix: "underwear outfit, barefoot" },
  { name: "半脱", slug: "half-undressed", promptSuffix: "half undressed outfit", link: "halfUndressed" as const },
  { name: "半脱+上半身", slug: "half-undressed-upper", promptSuffix: "half undressed upper body", link: "halfUndressed" as const },
  { name: "半脱+脱鞋", slug: "half-undressed-shoes-off", promptSuffix: "half undressed outfit, barefoot", link: "halfUndressed" as const },
  { name: "裸", slug: "naked", promptSuffix: "nude body", link: "naked" as const },
] as const;

export const MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT = 7;
export const BLOCKING_BENCHMARK_COUNT_KEYS = ["failed", "missing", "queued", "running"] as const;

const REQUIRED_BENCHMARK_TEMPLATE_NAMES = [
  "角色 lora 测试",
  "角色 LoRA 测试",
  "character lora",
] as const;
const REQUIRED_BENCHMARK_TEMPLATE_SECTION_COUNT = 7;
const DEBUG_FALLBACK_BENCHMARK_WARNING =
  "Benchmark ProjectTemplate was not found; using fallback sections only because dryRun/skipQueue skipped the real benchmark queue. This debug fallback is not approved promotion evidence.";
const characterLoraBenchmarkTemplateEnsureRequestSchema = z.object({
  checkpointName: z.string().trim().min(1).nullable().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Shared types (also used by promotion-service)
// ---------------------------------------------------------------------------

export type MinimalCharacterLoraJob = {
  id: string;
  slug: string;
  characterName: string;
  triggerToken: string;
  artifactRoot: string;
  baseCheckpointName: string | null;
  baseCheckpointPath: string | null;
  baseCheckpointHash: string | null;
  baseFamily: string | null;
  selectedDatasetRevisionId: string | null;
};

// ---------------------------------------------------------------------------
// Shared error class
// ---------------------------------------------------------------------------

export class CharacterLoraBenchmarkPromotionServiceError extends CharacterLoraServiceError {
  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message, status, details);
    this.name = "CharacterLoraBenchmarkPromotionServiceError";
  }
}

// ---------------------------------------------------------------------------
// Shared error mapper
// ---------------------------------------------------------------------------

export function mapCharacterLoraBenchmarkPromotionError(error: unknown) {
  if (error instanceof CharacterLoraBenchmarkPromotionServiceError) {
    return { message: error.message, status: error.status, details: error.details };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { message: "Character LoRA benchmark or promotion record already exists", status: 409 };
    }
    if (error.code === "P2025") {
      return { message: "Character LoRA benchmark or promotion record not found", status: 404 };
    }
    if (error.code === "P2003") {
      return { message: "Character LoRA benchmark or promotion references missing data", status: 409 };
    }
  }

  if (error instanceof Error) {
    return { message: error.message, status: 400 };
  }

  return {
    message: "Unexpected character LoRA benchmark/promotion error",
    status: 500,
    details: "An internal error occurred",
  };
}

// ---------------------------------------------------------------------------
// Shared helpers (exported for promotion-service)
// ---------------------------------------------------------------------------

export function normalizeId(value: string, fieldName: string) {
  return sharedNormalizeId(value, fieldName, CharacterLoraBenchmarkPromotionServiceError);
}

export function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new CharacterLoraBenchmarkPromotionServiceError("Invalid character LoRA benchmark/promotion request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  if (!job) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Character LoRA training job not found", 404);
  }
  return job;
}

export async function getExistingBenchmarkRun(benchmarkRunId: string) {
  const benchmark = await getCharacterLoraBenchmarkRun(benchmarkRunId);
  if (!benchmark) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run not found", 404);
  }
  return benchmark;
}

export function serializeIncludedJob(job: {
  id: string;
  slug: string;
  characterName: string;
  triggerToken: string;
  artifactRoot: string;
  baseCheckpointName: string | null;
  baseCheckpointPath: string | null;
  baseCheckpointHash: string | null;
  baseFamily: string | null;
  selectedDatasetRevisionId: string | null;
}) {
  return {
    id: job.id,
    slug: job.slug,
    characterName: job.characterName,
    triggerToken: job.triggerToken,
    artifactRoot: job.artifactRoot,
    baseCheckpointName: job.baseCheckpointName,
    baseCheckpointPath: job.baseCheckpointPath,
    baseCheckpointHash: job.baseCheckpointHash,
    baseFamily: job.baseFamily,
    selectedDatasetRevisionId: job.selectedDatasetRevisionId,
  };
}

export function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Benchmark template functions
// ---------------------------------------------------------------------------

export async function getCharacterLoraBenchmarkTemplateStatus() {
  return getCharacterLoraBenchmarkTemplateStatusInRepository();
}

export async function ensureCharacterLoraBenchmarkTemplate(input: unknown = {}) {
  const parsed = parseWithSchema(characterLoraBenchmarkTemplateEnsureRequestSchema, input ?? {});
  return ensureCharacterLoraBenchmarkTemplateInRepository({
    checkpointName: parsed.checkpointName ?? null,
  });
}

// ---------------------------------------------------------------------------
// Benchmark run lifecycle
// ---------------------------------------------------------------------------

export async function enqueueCharacterLoraBenchmarkRun(trainingRunId: string, input: unknown = {}) {
  const normalizedTrainingRunId = normalizeId(trainingRunId, "trainingRunId");
  const parsed = parseWithSchema(characterLoraBenchmarkEnqueueRequestSchema, input);
  const trainingRun = await getCharacterLoraTrainingRunWithFinalArtifact(normalizedTrainingRunId);

  if (!trainingRun) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Training run not found", 404);
  }
  if (trainingRun.status !== "done" || !trainingRun.finalSafetensorsArtifactId) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Training run must be done with a final safetensors artifact", 409, {
      trainingRunId: trainingRun.id,
      status: trainingRun.status,
      finalSafetensorsArtifactId: trainingRun.finalSafetensorsArtifactId,
    });
  }

  const job = serializeIncludedJob(trainingRun.job);
  const finalArtifact = await getCharacterLoraArtifact(trainingRun.finalSafetensorsArtifactId);
  if (!finalArtifact) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Final safetensors artifact not found", 404);
  }

  const [queue, activeLocks] = await Promise.all([
    countActiveComfyQueueRuns(),
    listActiveCharacterLoraGpuTaskLocks(),
  ]);
  const busyDetails = {
    comfyQueue: queue,
    gpuTaskLocks: activeLocks,
  };
  const isBusy = queue.queued > 0 || queue.running > 0 || activeLocks.length > 0;
  const warnings: string[] = [];

  if (isBusy && parsed.queuePolicy === "reject_when_busy") {
    throw new CharacterLoraBenchmarkPromotionServiceError("GPU is busy; benchmark enqueue rejected", 409, busyDetails);
  }

  if (queue.queued > 0 || queue.running > 0) {
    warnings.push(`ComfyUI queue is busy: queued=${queue.queued}, running=${queue.running}`);
  }
  if (activeLocks.length > 0) {
    warnings.push(`Active GPU task lock exists: ${activeLocks.map((lock) => lock.id).join(", ")}`);
  }

  const benchmarkTemplate = await resolveBenchmarkTemplateForEnqueue(parsed, warnings);
  const loraRegistration = await registerBenchmarkLoraAsset({
    input: parsed,
    job,
    trainingRunId: trainingRun.id,
    finalArtifact,
    warnings,
  });
  const benchmarkRunId = randomUUID();
  const defaultWeight = parsed.weightMatrix[0] ?? 1;
  const loraPath = loraRegistration.relativePath;
  const loraBinding = { path: loraPath, weight: roundWeight(defaultWeight), enabled: true };
  const baseCheckpoint = buildBaseCheckpointSnapshot(job);

  const taskPayload = parsed.dryRun || parsed.skipQueue
    ? null
    : parseWithSchema(characterLoraWorkerTaskPayloadSchema, {
        taskType: "benchmark",
        jobId: job.id,
        benchmarkRunId,
        trainingRunId: trainingRun.id,
        finalSafetensorsArtifact: {
          artifactId: finalArtifact.id,
          kind: "safetensors",
          relativePath: finalArtifact.relativePath,
          sha256: finalArtifact.sha256 ?? trainingRun.finalSha256 ?? undefined,
        },
        baseCheckpoint,
        checkpointMatrix: parsed.checkpointMatrix,
        weightMatrix: parsed.weightMatrix,
        templateId: benchmarkTemplate?.id,
      });

  if (taskPayload && taskPayload.taskType !== "benchmark") {
    throw new CharacterLoraBenchmarkPromotionServiceError("Invalid benchmark task payload", 500);
  }
  const benchmarkTaskPayload = taskPayload?.taskType === "benchmark" ? taskPayload : null;

  const created = await createCharacterLoraBenchmarkRunWithTask({
    benchmarkRunId,
    jobId: job.id,
    trainingRunId: trainingRun.id,
    loraAssetId: loraRegistration.asset?.id ?? null,
    templateId: benchmarkTemplate?.id ?? null,
    checkpointMatrix: toInputJsonValue(parsed.checkpointMatrix),
    weightMatrix: toInputJsonValue(parsed.weightMatrix),
    taskPayload: benchmarkTaskPayload,
    gpuLockMetadata: benchmarkTaskPayload
      ? toInputJsonValue({
          jobId: job.id,
          trainingRunId: trainingRun.id,
          benchmarkRunId,
          workerType: "benchmark",
          baseCheckpoint,
          checkpointMatrix: parsed.checkpointMatrix,
          weightMatrix: parsed.weightMatrix,
          queuePolicy: parsed.queuePolicy,
          warnings,
          busy: busyDetails,
        })
      : null,
    tempPreset: {
      categoryName: ROLE_CATEGORY_NAME,
      categorySlug: ROLE_CATEGORY_SLUG,
      presetName: `[Benchmark] ${job.characterName}`,
      presetSlug: `benchmark-${job.slug}`,
      variantName: "Benchmark",
      variantSlug: "benchmark",
      prompt: `${job.triggerToken}, ${job.characterName}`,
      negativePrompt: null,
      lora1: toInputJsonValue([loraBinding]),
      lora2: toInputJsonValue([loraBinding]),
      notes: JSON.stringify({
        temporary: true,
        purpose: "character_lora_benchmark",
        jobId: job.id,
        trainingRunId: trainingRun.id,
        finalSha256: trainingRun.finalSha256,
        queuePolicy: parsed.queuePolicy,
        warnings,
        busy: busyDetails,
        baseCheckpoint,
      }, null, 2),
    },
    tempProject: {
      title: `[Benchmark] ${job.characterName} ${new Date().toISOString().slice(0, 10)}`,
      checkpointName: parsed.checkpointMatrix[0] ?? job.baseCheckpointName ?? null,
      checkpointMatrix: parsed.checkpointMatrix,
      weightMatrix: parsed.weightMatrix,
      loraPath,
      notes: JSON.stringify({
        temporary: true,
        purpose: "character_lora_benchmark",
        jobId: job.id,
        trainingRunId: trainingRun.id,
        benchmarkRunId,
        checkpointMatrix: parsed.checkpointMatrix,
        weightMatrix: parsed.weightMatrix,
        queuePolicy: parsed.queuePolicy,
        warnings,
        busy: busyDetails,
        baseCheckpoint,
      }, null, 2),
      sectionLoraConfig: toInputJsonValue({
        lora1: [makeSectionLoraEntry(loraPath, defaultWeight, "lora1")],
        lora2: [makeSectionLoraEntry(loraPath, defaultWeight, "lora2")],
      }),
      promptBlock: {
        label: "Character LoRA benchmark",
        positive: `${job.triggerToken}, ${job.characterName}, full body, clear face, benchmark test`,
        negative: "low quality, bad anatomy, text, watermark",
      },
      fallbackSections: buildBenchmarkFallbackSections(job),
    },
  });

  if (parsed.dryRun || parsed.skipQueue) {
    const matrixExpansion = await getCharacterLoraBenchmarkMatrixExpansionSummary(benchmarkRunId);
    const completed = await mockCompleteBenchmarkRun(benchmarkRunId, {
      recommendedWeight: defaultWeight,
      resultSummary: {
        dryRun: parsed.dryRun,
        skipQueue: parsed.skipQueue,
        queuePolicy: parsed.queuePolicy,
        warnings,
        busy: busyDetails,
        checkpointMatrix: parsed.checkpointMatrix,
        weightMatrix: parsed.weightMatrix,
        expectedSectionCount: matrixExpansion?.expectedSectionCount ?? null,
        baseSectionCount: matrixExpansion?.baseSectionCount ?? null,
        matrixExpansion,
      },
      diagnosticSuggestions: warnings.length > 0 ? warnings : ["Benchmark queue was skipped; review generated test project metadata manually."],
    });
    return { ...created, completedBenchmarkRun: completed };
  }

  return {
    ...created,
    loraAsset: loraRegistration.asset,
    warnings,
  };
}

export async function listCharacterLoraBenchmarkRuns(jobId: string) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  await getExistingJob(normalizedJobId);
  return listCharacterLoraBenchmarkRunsByJob(normalizedJobId);
}

export async function listCharacterLoraBenchmarkRunsForTrainingRun(trainingRunId: string) {
  const normalizedTrainingRunId = normalizeId(trainingRunId, "trainingRunId");
  return listCharacterLoraBenchmarkRunsByTrainingRun(normalizedTrainingRunId);
}

export async function completeBenchmarkRun(benchmarkRunId: string, input: unknown) {
  const normalizedBenchmarkRunId = normalizeId(benchmarkRunId, "benchmarkRunId");
  const parsed = parseWithSchema(characterLoraBenchmarkCompleteRequestSchema, input);
  return completeBenchmarkRunWithParsedInput(normalizedBenchmarkRunId, parsed);
}

export async function mockCompleteBenchmarkRun(benchmarkRunId: string, input: Partial<CharacterLoraBenchmarkCompleteRequest> = {}) {
  const normalizedBenchmarkRunId = normalizeId(benchmarkRunId, "benchmarkRunId");
  const benchmark = await getExistingBenchmarkRun(normalizedBenchmarkRunId);
  const matrixExpansion = await getCharacterLoraBenchmarkMatrixExpansionSummary(normalizedBenchmarkRunId);
  const weightMatrix = Array.isArray(benchmark.weightMatrix) ? benchmark.weightMatrix : [];
  const fallbackWeight = weightMatrix.find((value): value is number => typeof value === "number" && value > 0) ?? 1;
  const parsed = parseWithSchema(characterLoraBenchmarkCompleteRequestSchema, {
    recommendedWeight: input.recommendedWeight ?? benchmark.recommendedWeight ?? fallbackWeight,
    resultSummary: input.resultSummary ?? {
      mocked: true,
      checkpointMatrix: benchmark.checkpointMatrix,
      weightMatrix: benchmark.weightMatrix,
      expectedSectionCount: matrixExpansion?.expectedSectionCount ?? null,
      baseSectionCount: matrixExpansion?.baseSectionCount ?? null,
      matrixExpansion,
    },
    diagnosticSuggestions: input.diagnosticSuggestions ?? [
      "Mock benchmark completed; replace with reviewed image evidence before approving promotion.",
    ],
    report: input.report,
  });

  return completeBenchmarkRunWithParsedInput(normalizedBenchmarkRunId, parsed);
}

export async function cleanupBenchmarkRunTemporaryResources(benchmarkRunId: string, input: unknown = {}) {
  const normalizedBenchmarkRunId = normalizeId(benchmarkRunId, "benchmarkRunId");
  const parsed = parseWithSchema(characterLoraBenchmarkCleanupRequestSchema, input);
  const benchmark = await getExistingBenchmarkRun(normalizedBenchmarkRunId);
  const evidenceBlockers = await collectBenchmarkCleanupEvidenceBlockers(benchmark, parsed);

  if (!parsed.dryRun && evidenceBlockers.length > 0) {
    throw new CharacterLoraBenchmarkPromotionServiceError(
      "Benchmark temporary resources cannot be cleaned yet",
      409,
      {
        benchmarkRunId: benchmark.id,
        blockers: evidenceBlockers,
      },
    );
  }

  const result = await cleanupCharacterLoraBenchmarkTemporaryResourcesInRepository({
    benchmarkRunId: benchmark.id,
    cleanupProject: parsed.project,
    cleanupPreset: parsed.preset,
    dryRun: parsed.dryRun,
  });

  if (!result) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run not found", 404);
  }

  const blockers = [...evidenceBlockers, ...result.blockers];
  if (!parsed.dryRun && blockers.length > 0) {
    throw new CharacterLoraBenchmarkPromotionServiceError(
      "Benchmark temporary resources cannot be cleaned yet",
      409,
      {
        benchmarkRunId: benchmark.id,
        blockers,
        cleanup: result.cleanup,
      },
    );
  }

  return {
    ...result,
    blockers,
    canCleanup: blockers.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Private helpers — benchmark internals
// ---------------------------------------------------------------------------

async function collectBenchmarkCleanupEvidenceBlockers(
  benchmark: Awaited<ReturnType<typeof getExistingBenchmarkRun>>,
  request: CharacterLoraBenchmarkCleanupRequest,
) {
  const blockers: Array<{ code: string; message: string; details?: unknown }> = [];

  if (!request.project && !request.preset) {
    return blockers;
  }

  if (benchmark.status !== "done") {
    blockers.push({
      code: "benchmark_not_done",
      message: "Benchmark run must be done before cleanup",
      details: {
        benchmarkRunId: benchmark.id,
        status: benchmark.status,
      },
    });
  }

  if (!benchmark.reportArtifactId) {
    blockers.push({
      code: "benchmark_report_required",
      message: "Benchmark report artifact is required before cleanup",
      details: {
        benchmarkRunId: benchmark.id,
        reportArtifactId: null,
      },
    });
    return blockers;
  }

  const reportArtifact = await getCharacterLoraArtifact(benchmark.reportArtifactId);
  if (!reportArtifact) {
    blockers.push({
      code: "benchmark_report_missing",
      message: "Benchmark report artifact is missing before cleanup",
      details: {
        benchmarkRunId: benchmark.id,
        reportArtifactId: benchmark.reportArtifactId,
      },
    });
  }

  return blockers;
}

async function completeBenchmarkRunWithParsedInput(
  benchmarkRunId: string,
  parsed: CharacterLoraBenchmarkCompleteRequest,
) {
  const benchmark = await getExistingBenchmarkRun(benchmarkRunId);
  const job = await getExistingJob(benchmark.jobId);
  const reportPayload = {
    benchmarkRunId: benchmark.id,
    jobId: benchmark.jobId,
    trainingRunId: benchmark.trainingRunId,
    recommendedWeight: parsed.recommendedWeight,
    resultSummary: parsed.resultSummary,
    diagnosticSuggestions: parsed.diagnosticSuggestions,
    report: parsed.report ?? null,
    completedAt: new Date().toISOString(),
  };
  const reportArtifact = await writeCharacterLoraJsonArtifact(
    job.artifactRoot,
    `benchmark-runs/${benchmark.id}/benchmark-report.json`,
    reportPayload,
  );
  const completed = await completeCharacterLoraBenchmarkRunInRepository({
    benchmarkRunId: benchmark.id,
    recommendedWeight: parsed.recommendedWeight,
    resultSummary: toInputJsonValue({
      ...parsed.resultSummary,
      diagnosticSuggestions: parsed.diagnosticSuggestions,
      report: {
        artifactRelativePath: reportArtifact.relativePath,
        external: parsed.report ?? null,
      },
    }),
    reportArtifact: {
      relativePath: reportArtifact.relativePath,
      absolutePath: reportArtifact.absolutePath,
      sha256: reportArtifact.sha256,
      byteSize: BigInt(reportArtifact.byteSize),
      metadata: toInputJsonValue({
        benchmarkRunId: benchmark.id,
        artifactRole: "benchmark_report",
      }),
    },
  });

  if (!completed) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run not found", 404);
  }

  return completed;
}

async function registerBenchmarkLoraAsset(input: {
  input: CharacterLoraBenchmarkEnqueueRequest;
  job: MinimalCharacterLoraJob;
  trainingRunId: string;
  finalArtifact: Awaited<ReturnType<typeof getCharacterLoraArtifact>> extends infer T ? NonNullable<T> : never;
  warnings: string[];
}) {
  const sourceAbsolutePath = input.finalArtifact.absolutePath
    ?? resolveCharacterLoraArtifactPath(input.job.artifactRoot, input.finalArtifact.relativePath).absolutePath;
  let targetAbsolutePath = sourceAbsolutePath;
  let targetRelativePath = input.finalArtifact.relativePath;
  let byteSize = parseOptionalBigInt(input.finalArtifact.byteSize);

  if (input.input.copyToCharacterDir) {
    const copied = await tryCopyToCharacterLoraDir({
      sourceAbsolutePath,
      sourceFileName: path.basename(sourceAbsolutePath),
      preferredFileName: input.input.loraAssetName,
      warnings: input.warnings,
    });
    if (copied) {
      targetAbsolutePath = copied.absolutePath;
      targetRelativePath = copied.relativePath;
      byteSize = copied.byteSize;
    }
  }

  if (!input.input.registerLoraAsset) {
    return {
      asset: null,
      absolutePath: targetAbsolutePath,
      relativePath: targetRelativePath,
    };
  }

  const fileName = path.basename(targetAbsolutePath);
  const asset = await upsertCharacterLoraAsset({
    name: input.input.loraAssetName ?? input.job.characterName,
    fileName,
    absolutePath: targetAbsolutePath,
    relativePath: targetRelativePath,
    size: byteSize,
    source: "character-lora-training",
    triggerWords: input.job.triggerToken,
    notes: JSON.stringify({
      source: "character_lora_training",
      jobId: input.job.id,
      trainingRunId: input.trainingRunId,
      finalSha256: input.finalArtifact.sha256,
      finalArtifactId: input.finalArtifact.id,
    }, null, 2),
  });

  return {
    asset,
    absolutePath: targetAbsolutePath,
    relativePath: targetRelativePath,
  };
}

async function tryCopyToCharacterLoraDir(input: {
  sourceAbsolutePath: string;
  sourceFileName: string;
  preferredFileName?: string;
  warnings: string[];
}) {
  if (!env.loraBaseDir) {
    input.warnings.push("MODEL_BASE_DIR is not configured; skipped copyToCharacterDir.");
    return null;
  }

  const targetDir = path.resolve(env.loraBaseDir, "character");
  const safeFileName = sanitizeFileName(input.preferredFileName ?? input.sourceFileName);
  const finalFileName = path.extname(safeFileName) ? safeFileName : `${safeFileName}.safetensors`;
  const targetAbsolutePath = path.resolve(targetDir, finalFileName);

  if (!isWithinBase(env.loraBaseDir, targetAbsolutePath)) {
    input.warnings.push("copyToCharacterDir target escaped MODEL_BASE_DIR/loras; skipped copy.");
    return null;
  }

  try {
    await mkdir(targetDir, { recursive: true });
    await copyFile(input.sourceAbsolutePath, targetAbsolutePath);
    const fileStat = await stat(targetAbsolutePath);
    return {
      absolutePath: targetAbsolutePath,
      relativePath: path.relative(env.loraBaseDir, targetAbsolutePath).replace(/\\/g, "/"),
      byteSize: BigInt(fileStat.size),
    };
  } catch (error) {
    input.warnings.push(`copyToCharacterDir failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function makeSectionLoraEntry(pathValue: string, weight: number, suffix: string) {
  return {
    id: `lora-${randomUUID()}`,
    path: pathValue,
    weight: roundWeight(weight),
    enabled: true,
    source: "preset",
    sourceLabel: ROLE_CATEGORY_NAME,
    sourceColor: "78 50% 55%",
    sourceName: "Character LoRA benchmark",
    bindingId: `bind-${suffix}-${randomUUID()}`,
  };
}

function buildBenchmarkFallbackSections(job: MinimalCharacterLoraJob) {
  return STANDARD_VARIANTS.map((variant, index) => ({
    name: variant.name,
    sortOrder: index,
    promptBlock: {
      label: `Benchmark ${variant.name}`,
      positive: [
        job.triggerToken,
        job.characterName,
        "full body",
        "clear face",
        "benchmark test",
        variant.promptSuffix,
      ]
        .filter((piece) => piece && piece.trim())
        .join(", "),
      negative: "low quality, bad anatomy, text, watermark",
    },
  }));
}

async function resolveBenchmarkTemplateForEnqueue(
  input: CharacterLoraBenchmarkEnqueueRequest,
  warnings: string[],
) {
  const allowDebugFallback = input.dryRun || input.skipQueue;

  if (input.templateId) {
    const template = await getCharacterLoraBenchmarkTemplateById(input.templateId);
    if (!template) {
      throw missingBenchmarkTemplateError(input, "explicit");
    }
    validateBenchmarkTemplateUsableForEnqueue(input, template, "explicit", warnings);
    return template;
  }

  const template = await findCharacterLoraBenchmarkTemplate();
  if (template) {
    validateBenchmarkTemplateUsableForEnqueue(input, template, "automatic", warnings);
    return template;
  }

  if (!allowDebugFallback) {
    throw missingBenchmarkTemplateError(input, "automatic");
  }

  warnings.push(DEBUG_FALLBACK_BENCHMARK_WARNING);
  return null;
}

function validateBenchmarkTemplateUsableForEnqueue(
  input: Pick<CharacterLoraBenchmarkEnqueueRequest, "templateId" | "dryRun" | "skipQueue">,
  template: {
    id: string;
    name: string;
    sectionCount: number;
    isUsable: boolean;
  },
  lookup: "explicit" | "automatic",
  warnings: string[],
) {
  if (template.isUsable && template.sectionCount >= REQUIRED_BENCHMARK_TEMPLATE_SECTION_COUNT) {
    return;
  }

  const warning =
    `Benchmark ProjectTemplate ${template.name} has ${template.sectionCount}/${REQUIRED_BENCHMARK_TEMPLATE_SECTION_COUNT} sections; ` +
    "it is allowed only for dryRun/skipQueue debug and is not approved promotion evidence.";
  if (input.dryRun || input.skipQueue) {
    warnings.push(warning);
    return;
  }

  throw unusableBenchmarkTemplateError(input, template, lookup);
}

function missingBenchmarkTemplateError(
  input: Pick<CharacterLoraBenchmarkEnqueueRequest, "templateId" | "dryRun" | "skipQueue">,
  lookup: "explicit" | "automatic",
) {
  return new CharacterLoraBenchmarkPromotionServiceError(
    "Character LoRA benchmark requires a valid ProjectTemplate",
    409,
    {
      templateId: input.templateId ?? null,
      dryRun: input.dryRun,
      skipQueue: input.skipQueue,
      requiredSectionCount: REQUIRED_BENCHMARK_TEMPLATE_SECTION_COUNT,
      requiredTemplateNames: [...REQUIRED_BENCHMARK_TEMPLATE_NAMES],
      lookup,
    },
  );
}

function unusableBenchmarkTemplateError(
  input: Pick<CharacterLoraBenchmarkEnqueueRequest, "templateId" | "dryRun" | "skipQueue">,
  template: {
    id: string;
    name: string;
    sectionCount: number;
  },
  lookup: "explicit" | "automatic",
) {
  return new CharacterLoraBenchmarkPromotionServiceError(
    "Character LoRA benchmark ProjectTemplate is not usable",
    409,
    {
      templateId: template.id,
      templateName: template.name,
      sectionCount: template.sectionCount,
      requiredSectionCount: REQUIRED_BENCHMARK_TEMPLATE_SECTION_COUNT,
      dryRun: input.dryRun,
      skipQueue: input.skipQueue,
      lookup,
      requiredTemplateNames: [...REQUIRED_BENCHMARK_TEMPLATE_NAMES],
    },
  );
}

function buildBaseCheckpointSnapshot(job: MinimalCharacterLoraJob) {
  return {
    name: job.baseCheckpointName,
    path: job.baseCheckpointPath,
    hash: job.baseCheckpointHash,
    baseFamily: job.baseFamily,
  };
}

function parseOptionalBigInt(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.max(0, Math.trunc(value)));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_");
}

function isWithinBase(baseDir: string, targetPath: string) {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}
