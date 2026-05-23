import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@/generated/prisma";
import { env } from "@/lib/env";
import {
  characterLoraBenchmarkCompleteRequestSchema,
  characterLoraBenchmarkEnqueueRequestSchema,
  characterLoraPromotionDecisionCreateRequestSchema,
  characterLoraPromoteRequestSchema,
  characterLoraWorkerTaskPayloadSchema,
  type CharacterLoraBenchmarkCompleteRequest,
  type CharacterLoraBenchmarkEnqueueRequest,
  type CharacterLoraPromoteRequest,
} from "@/server/character-lora-training/contracts";
import {
  completeCharacterLoraBenchmarkRunInRepository,
  countActiveComfyQueueRuns,
  createCharacterLoraBenchmarkRunWithTask,
  createCharacterLoraPromotionDecisionInRepository,
  findBreastSizeSliderLoraAsset,
  findCharacterLoraBenchmarkTemplate,
  findCharacterLoraPromotionLinkedVariant,
  getCharacterLoraArtifact,
  getCharacterLoraBenchmarkRun,
  getCharacterLoraBenchmarkMatrixExpansionSummary,
  getCharacterLoraPromotionDecisionForPromotion,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingRunWithFinalArtifact,
  getLoraAssetById,
  listActiveCharacterLoraGpuTaskLocks,
  listCharacterLoraBenchmarkRunsByJob,
  listCharacterLoraBenchmarkRunsByTrainingRun,
  listCharacterLoraPromotionDecisions as listPromotionDecisionsFromRepository,
  promoteCharacterLoraDecisionInRepository,
  upsertCharacterLoraAsset,
} from "@/server/repositories/character-lora-training-repository";
import {
  resolveCharacterLoraArtifactPath,
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import { z } from "zod";

const ROLE_CATEGORY_NAME = "角色";
const ROLE_CATEGORY_SLUG = "character";

const STANDARD_VARIANTS = [
  { name: "默认", slug: "default", promptSuffix: "" },
  { name: "内裤", slug: "underwear", promptSuffix: "underwear outfit" },
  { name: "内裤+脱鞋", slug: "underwear-shoes-off", promptSuffix: "underwear outfit, barefoot" },
  { name: "半脱", slug: "half-undressed", promptSuffix: "half undressed outfit", link: "halfUndressed" as const },
  { name: "半脱+上半身", slug: "half-undressed-upper", promptSuffix: "half undressed upper body", link: "halfUndressed" as const },
  { name: "半脱+脱鞋", slug: "half-undressed-shoes-off", promptSuffix: "half undressed outfit, barefoot", link: "halfUndressed" as const },
  { name: "裸", slug: "naked", promptSuffix: "nude body", link: "naked" as const },
] as const;

const MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT = 7;
const BLOCKING_BENCHMARK_COUNT_KEYS = ["failed", "missing", "queued", "running"] as const;

type MinimalCharacterLoraJob = {
  id: string;
  slug: string;
  characterName: string;
  triggerToken: string;
  artifactRoot: string;
  baseCheckpointName: string | null;
  selectedDatasetRevisionId: string | null;
};

export class CharacterLoraBenchmarkPromotionServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CharacterLoraBenchmarkPromotionServiceError";
  }
}

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
  const benchmarkTemplate = parsed.templateId
    ? { id: parsed.templateId, name: "explicit template" }
    : await findCharacterLoraBenchmarkTemplate();
  if (!benchmarkTemplate) {
    warnings.push("Benchmark template not found; created the standard 7-section fallback benchmark project.");
  }

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

export async function createPromotionDecision(benchmarkRunId: string, input: unknown) {
  const normalizedBenchmarkRunId = normalizeId(benchmarkRunId, "benchmarkRunId");
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? { ...input as Record<string, unknown>, benchmarkRunId: normalizedBenchmarkRunId }
    : { benchmarkRunId: normalizedBenchmarkRunId };
  const parsed = parseWithSchema(characterLoraPromotionDecisionCreateRequestSchema, raw);
  const benchmark = await getExistingBenchmarkRun(parsed.benchmarkRunId);

  if (benchmark.status !== "done") {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run must be done before a promotion decision", 409, {
      benchmarkRunId: benchmark.id,
      status: benchmark.status,
    });
  }
  if (benchmark.loraAssetId && benchmark.loraAssetId !== parsed.selectedLoraAssetId) {
    throw new CharacterLoraBenchmarkPromotionServiceError("selectedLoraAssetId must match the benchmark LoRA asset", 409, {
      benchmarkLoraAssetId: benchmark.loraAssetId,
      selectedLoraAssetId: parsed.selectedLoraAssetId,
    });
  }
  if (parsed.status === "approved") {
    assertBenchmarkHasApprovedPromotionEvidence(benchmark, parsed.selectedCheckpoint);
  }

  const decision = await createCharacterLoraPromotionDecisionInRepository({
    benchmarkRunId: benchmark.id,
    status: parsed.status,
    selectedLoraAssetId: parsed.selectedLoraAssetId,
    selectedCheckpoint: parsed.selectedCheckpoint ?? null,
    defaultRecommendedWeight: parsed.defaultRecommendedWeight,
    perVariantWeightOverrides: parsed.perVariantWeightOverrides
      ? toInputJsonValue(parsed.perVariantWeightOverrides)
      : null,
    variantPromptDrafts: toInputJsonValue(parsed.variantPromptDrafts),
    decisionReason: parsed.decisionReason ?? null,
    rejectedReturnPoint: parsed.status === "rejected" ? parsed.returnPoint ?? "benchmark_review" : null,
  });

  if (!decision) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run not found", 404);
  }

  return decision;
}

export async function listCharacterLoraPromotionDecisions(jobId: string) {
  const normalizedJobId = normalizeId(jobId, "jobId");
  await getExistingJob(normalizedJobId);
  return listPromotionDecisionsFromRepository(normalizedJobId);
}

export async function promoteCharacterLoraPreset(decisionId: string, input: unknown = {}) {
  const normalizedDecisionId = normalizeId(decisionId, "decisionId");
  const parsed = parseWithSchema(characterLoraPromoteRequestSchema, input);
  const promotionPlan = await buildPromotionPlan(normalizedDecisionId, parsed);

  if (parsed.dryRun) {
    return {
      dryRun: true,
      ...promotionPlan.preview,
    };
  }

  const reportArtifact = await writeCharacterLoraJsonArtifact(
    promotionPlan.job.artifactRoot,
    `promotion-decisions/${normalizedDecisionId}/promotion-report.json`,
    promotionPlan.report,
  );
  const result = await promoteCharacterLoraDecisionInRepository({
    decisionId: normalizedDecisionId,
    categoryName: ROLE_CATEGORY_NAME,
    categorySlug: ROLE_CATEGORY_SLUG,
    presetName: promotionPlan.presetName,
    presetSlug: promotionPlan.presetSlug,
    presetNotes: promotionPlan.presetNotes,
    variants: promotionPlan.variants.map((variant) => ({
      name: variant.name,
      slug: variant.slug,
      prompt: variant.prompt,
      negativePrompt: null,
      lora1: toInputJsonValue(variant.lora1),
      lora2: toInputJsonValue(variant.lora2),
      linkedVariants: variant.linkedVariants.length > 0 ? toInputJsonValue(variant.linkedVariants) : null,
      sortOrder: variant.sortOrder,
    })),
    overwriteExisting: parsed.overwriteExisting,
    reportArtifact: {
      relativePath: reportArtifact.relativePath,
      absolutePath: reportArtifact.absolutePath,
      sha256: reportArtifact.sha256,
      byteSize: BigInt(reportArtifact.byteSize),
      metadata: toInputJsonValue({
        decisionId: normalizedDecisionId,
        benchmarkRunId: promotionPlan.decision.benchmarkRunId,
        artifactRole: "promotion_report",
      }),
    },
  });

  if (!result) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Promotion decision not found", 404);
  }

  return {
    ...result,
    report: promotionPlan.report,
  };
}

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

function assertBenchmarkHasApprovedPromotionEvidence(
  benchmark: {
    id: string;
    resultSummary: unknown;
  },
  selectedCheckpoint: string | undefined,
) {
  const { blockers, evidence } = inspectApprovedPromotionEvidence(benchmark.resultSummary, selectedCheckpoint);
  if (blockers.length === 0) {
    return;
  }

  throw new CharacterLoraBenchmarkPromotionServiceError(
    "Approved promotion decision requires completed benchmark evidence",
    409,
    {
      benchmarkRunId: benchmark.id,
      blockers,
      evidence,
    },
  );
}

function inspectApprovedPromotionEvidence(resultSummary: unknown, selectedCheckpoint: string | undefined) {
  const summary = readRecord(resultSummary);
  const counts = readRecord(summary?.counts);
  const matrixExpansion = readRecord(summary?.matrixExpansion);
  const sections = Array.isArray(summary?.sections) ? summary.sections : [];
  const runIds = readStringArray(summary?.runIds);
  const sectionEvidenceCount = countBenchmarkSectionEvidence(sections);
  const countEvidence = {
    totalRuns: readNumber(counts?.totalRuns),
    done: readNumber(counts?.done),
    failed: readNumber(counts?.failed),
    missing: readNumber(counts?.missing),
    queued: readNumber(counts?.queued),
    running: readNumber(counts?.running),
  };
  const matrixEvidence = {
    expectedSectionCount: readNumber(matrixExpansion?.expectedSectionCount),
    actualSectionCount: readNumber(matrixExpansion?.actualSectionCount),
    baseSectionCount: readNumber(matrixExpansion?.baseSectionCount),
  };
  const flags = {
    mocked: summary?.mocked === true,
    dryRun: summary?.dryRun === true,
    skipQueue: summary?.skipQueue === true,
    skipWait: summary?.skipWait === true,
  };
  const evidence = {
    selectedCheckpoint: selectedCheckpoint?.trim() || null,
    resultSummaryPresent: Boolean(summary),
    flags,
    counts: countEvidence,
    matrixExpansion: matrixEvidence,
    sectionEvidenceCount,
    runEvidenceCount: runIds.length,
    minimumEvidenceCount: MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT,
  };
  const blockers: Array<{ code: string; message: string; value?: unknown }> = [];

  if (!evidence.selectedCheckpoint) {
    blockers.push({
      code: "selected_checkpoint_required",
      message: "approved promotion decisions require an explicit selectedCheckpoint",
    });
  }
  if (!summary) {
    blockers.push({
      code: "result_summary_missing",
      message: "benchmark resultSummary is required before approval",
    });
  }
  for (const [flag, enabled] of Object.entries(flags)) {
    if (enabled) {
      blockers.push({
        code: `${flag}_not_approvable`,
        message: `${flag} benchmark evidence cannot be approved`,
      });
    }
  }
  if (!counts) {
    blockers.push({
      code: "counts_missing",
      message: "benchmark resultSummary.counts is required before approval",
    });
  } else {
    for (const key of BLOCKING_BENCHMARK_COUNT_KEYS) {
      const value = countEvidence[key];
      if (value !== null && value > 0) {
        blockers.push({
          code: `${key}_runs_present`,
          message: `benchmark counts.${key} must be 0 before approval`,
          value,
        });
      }
    }
    if (countEvidence.totalRuns === null || countEvidence.done === null) {
      blockers.push({
        code: "run_counts_missing",
        message: "benchmark counts.totalRuns and counts.done are required before approval",
      });
    } else {
      if (countEvidence.done < countEvidence.totalRuns) {
        blockers.push({
          code: "runs_not_complete",
          message: "benchmark counts.done must be greater than or equal to counts.totalRuns before approval",
          value: countEvidence,
        });
      }
      if (countEvidence.totalRuns < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT) {
        blockers.push({
          code: "run_evidence_insufficient",
          message: `at least ${MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT} benchmark runs are required before approval`,
          value: countEvidence.totalRuns,
        });
      }
    }
  }
  if (!matrixExpansion) {
    blockers.push({
      code: "matrix_expansion_missing",
      message: "benchmark resultSummary.matrixExpansion is required before approval",
    });
  } else if (matrixEvidence.expectedSectionCount === null || matrixEvidence.actualSectionCount === null) {
    blockers.push({
      code: "matrix_section_counts_missing",
      message: "benchmark matrixExpansion expectedSectionCount and actualSectionCount are required before approval",
    });
  } else if (matrixEvidence.actualSectionCount < matrixEvidence.expectedSectionCount) {
    blockers.push({
      code: "matrix_sections_incomplete",
      message: "benchmark matrixExpansion actualSectionCount must cover expectedSectionCount before approval",
      value: matrixEvidence,
    });
  }
  if (sectionEvidenceCount < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT) {
    blockers.push({
      code: "section_evidence_insufficient",
      message: `at least ${MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT} benchmark section results are required before approval`,
      value: sectionEvidenceCount,
    });
  }
  if (runIds.length < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT) {
    blockers.push({
      code: "run_id_evidence_insufficient",
      message: `at least ${MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT} benchmark run ids are required before approval`,
      value: runIds.length,
    });
  }

  return { blockers, evidence };
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

async function buildPromotionPlan(decisionId: string, input: CharacterLoraPromoteRequest) {
  const decision = await getCharacterLoraPromotionDecisionForPromotion(decisionId);
  if (!decision) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Promotion decision not found", 404);
  }
  if (decision.status !== "approved") {
    throw new CharacterLoraBenchmarkPromotionServiceError("Only approved promotion decisions can be promoted", 409, {
      decisionId,
      status: decision.status,
    });
  }
  if (decision.promotedPresetId) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Promotion decision has already been promoted", 409, {
      decisionId,
      promotedPresetId: decision.promotedPresetId,
    });
  }

  const [loraAsset, breastSlider, halfUndressedVariant, nakedVariant] = await Promise.all([
    getLoraAssetById(decision.selectedLoraAssetId),
    findBreastSizeSliderLoraAsset(),
    findCharacterLoraPromotionLinkedVariant("halfUndressed"),
    findCharacterLoraPromotionLinkedVariant("naked"),
  ]);
  if (!loraAsset) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Selected LoRA asset not found", 404);
  }

  const job = serializeIncludedJob(decision.job);
  const benchmark = serializeIncludedBenchmark(decision.benchmarkRun);
  const warnings: string[] = [];
  if (!breastSlider) warnings.push("Breast size slider LoRA asset was not found; lora2 contains only the character LoRA.");
  if (!halfUndressedVariant) warnings.push("Half-undressed clothing linked variant was not found.");
  if (!nakedVariant) warnings.push("Naked clothing linked variant was not found.");

  const perVariantWeightOverrides = parseRecord(decision.perVariantWeightOverrides);
  const variantPromptDrafts = parseRecord(decision.variantPromptDrafts);
  const variants = STANDARD_VARIANTS.map((variant, index) => {
    const resolvedWeight = roundWeight(resolveVariantWeight(
      variant.slug,
      variant.name,
      decision.defaultRecommendedWeight,
      perVariantWeightOverrides,
    ));
    const prompt = resolveVariantPrompt(variant.slug, variant.name, job, variant.promptSuffix, variantPromptDrafts);
    const lora1 = [{ path: loraAsset.relativePath, weight: resolvedWeight, enabled: true }];
    const lora2 = [
      { path: loraAsset.relativePath, weight: resolvedWeight, enabled: true },
      ...(breastSlider ? [{ path: breastSlider.relativePath, weight: 0, enabled: true }] : []),
    ];
    const linkedVariants =
      "link" in variant && variant.link === "halfUndressed" && halfUndressedVariant
        ? [{ presetId: halfUndressedVariant.presetId, variantId: halfUndressedVariant.id }]
        : "link" in variant && variant.link === "naked" && nakedVariant
          ? [{ presetId: nakedVariant.presetId, variantId: nakedVariant.id }]
          : [];

    return {
      name: variant.name,
      slug: variant.slug,
      prompt,
      sortOrder: index,
      resolvedWeight,
      lora1,
      lora2,
      linkedVariants,
    };
  });
  const presetName = job.characterName;
  const presetSlug = slugifyForService(job.characterName || job.slug);
  const report = {
    decisionId,
    jobId: job.id,
    datasetRevisionId: benchmark.datasetRevisionId ?? job.selectedDatasetRevisionId,
    trainingRunId: benchmark.trainingRunId,
    benchmarkRunId: benchmark.id,
    selectedLoraAssetId: loraAsset.id,
    loraRelativePath: loraAsset.relativePath,
    loraHash: benchmark.resultSummary && typeof benchmark.resultSummary === "object"
      ? (benchmark.resultSummary as Record<string, unknown>).finalSha256 ?? benchmark.finalSha256 ?? null
      : benchmark.finalSha256,
    selectedCheckpoint: decision.selectedCheckpoint,
    defaultRecommendedWeight: decision.defaultRecommendedWeight,
    perVariantWeightOverrides,
    decisionReason: decision.decisionReason,
    overwriteExisting: input.overwriteExisting,
    warnings,
    variants: variants.map((variant) => ({
      name: variant.name,
      slug: variant.slug,
      resolvedWeight: variant.resolvedWeight,
      linkedVariants: variant.linkedVariants,
      lora1: variant.lora1,
      lora2: variant.lora2,
    })),
    promotedAt: new Date().toISOString(),
  };
  const presetNotes = JSON.stringify({
    source: "character_lora_training_promotion",
    jobId: job.id,
    datasetRevisionId: benchmark.datasetRevisionId ?? job.selectedDatasetRevisionId,
    trainingRunId: benchmark.trainingRunId,
    benchmarkRunId: benchmark.id,
    decisionId,
    loraAssetId: loraAsset.id,
    loraRelativePath: loraAsset.relativePath,
    loraHash: benchmark.finalSha256,
    selectedCheckpoint: decision.selectedCheckpoint,
    defaultRecommendedWeight: decision.defaultRecommendedWeight,
    decisionReason: decision.decisionReason,
    warnings,
    perVariantWeights: Object.fromEntries(variants.map((variant) => [variant.slug, variant.resolvedWeight])),
  }, null, 2);

  return {
    decision,
    job,
    presetName,
    presetSlug,
    presetNotes,
    variants,
    report,
    preview: {
      presetName,
      presetSlug,
      loraAsset,
      warnings,
      variants,
    },
  };
}

async function getExistingJob(jobId: string) {
  const job = await getCharacterLoraTrainingJob(jobId);
  if (!job) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Character LoRA training job not found", 404);
  }
  return job;
}

async function getExistingBenchmarkRun(benchmarkRunId: string) {
  const benchmark = await getCharacterLoraBenchmarkRun(benchmarkRunId);
  if (!benchmark) {
    throw new CharacterLoraBenchmarkPromotionServiceError("Benchmark run not found", 404);
  }
  return benchmark;
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

function resolveVariantWeight(
  slug: string,
  name: string,
  fallback: number,
  overrides: Record<string, unknown>,
) {
  const bySlug = overrides[slug];
  if (typeof bySlug === "number" && bySlug > 0) return bySlug;
  const byName = overrides[name];
  if (typeof byName === "number" && byName > 0) return byName;
  return fallback;
}

function resolveVariantPrompt(
  slug: string,
  name: string,
  job: MinimalCharacterLoraJob,
  suffix: string,
  drafts: Record<string, unknown>,
) {
  const draft = drafts[slug] ?? drafts[name];
  if (typeof draft === "string" && draft.trim()) return draft.trim();

  return [job.triggerToken, job.characterName, suffix]
    .filter((piece) => piece && piece.trim())
    .join(", ");
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

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
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

function slugifyForService(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "character";
}

function normalizeId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new CharacterLoraBenchmarkPromotionServiceError(`${fieldName} is required`, 400);
  }
  return normalized;
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new CharacterLoraBenchmarkPromotionServiceError("Invalid character LoRA benchmark/promotion request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function serializeIncludedJob(job: {
  id: string;
  slug: string;
  characterName: string;
  triggerToken: string;
  artifactRoot: string;
  baseCheckpointName: string | null;
  selectedDatasetRevisionId: string | null;
}) {
  return {
    id: job.id,
    slug: job.slug,
    characterName: job.characterName,
    triggerToken: job.triggerToken,
    artifactRoot: job.artifactRoot,
    baseCheckpointName: job.baseCheckpointName,
    selectedDatasetRevisionId: job.selectedDatasetRevisionId,
  };
}

function serializeIncludedBenchmark(benchmark: {
  id: string;
  trainingRunId: string;
  resultSummary: unknown;
  trainingRun?: {
    datasetRevisionId: string | null;
    finalSha256: string | null;
    finalSafetensorsArtifactId: string | null;
  } | null;
}) {
  return {
    id: benchmark.id,
    trainingRunId: benchmark.trainingRunId,
    resultSummary: benchmark.resultSummary,
    datasetRevisionId: benchmark.trainingRun?.datasetRevisionId ?? null,
    finalSha256: benchmark.trainingRun?.finalSha256 ?? null,
    finalSafetensorsArtifactId: benchmark.trainingRun?.finalSafetensorsArtifactId ?? null,
  };
}

function toInputJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function countBenchmarkSectionEvidence(sections: unknown[]) {
  return sections.filter((section) => {
    const sectionRecord = readRecord(section);
    if (!sectionRecord || typeof sectionRecord.sectionId !== "string" || !sectionRecord.sectionId.trim()) {
      return false;
    }

    const latestRun = readRecord(sectionRecord.latestRun);
    return (
      typeof latestRun?.id === "string" &&
      latestRun.id.trim().length > 0 &&
      latestRun.status === "done"
    );
  }).length;
}
