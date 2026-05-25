import {
  toInputJsonValue,
  readJsonRecord,
  asJsonRecord,
} from "@/server/services/character-lora-training/shared/service-utils";
import {
  characterLoraPromotionDecisionCreateRequestSchema,
  characterLoraPromoteRequestSchema,
  type CharacterLoraPromoteRequest,
} from "@/server/character-lora-training/contracts";
import {
  createCharacterLoraPromotionDecisionInRepository,
  findBreastSizeSliderLoraAsset,
  findCharacterLoraPromotionLinkedVariant,
  getCharacterLoraPromotionDecisionForPromotion,
  getLoraAssetById,
  listCharacterLoraPromotionDecisions as listPromotionDecisionsFromRepository,
  promoteCharacterLoraDecisionInRepository,
} from "@/server/repositories/character-lora-training-repository";
import {
  writeCharacterLoraJsonArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CharacterLoraBenchmarkPromotionServiceError,
  BLOCKING_BENCHMARK_COUNT_KEYS,
  MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT,
  ROLE_CATEGORY_NAME,
  ROLE_CATEGORY_SLUG,
  STANDARD_VARIANTS,
  getExistingBenchmarkRun,
  getExistingJob,
  normalizeId,
  parseWithSchema,
  roundWeight,
  serializeIncludedJob,
  type MinimalCharacterLoraJob,
} from "./benchmark-service";

// ---------------------------------------------------------------------------
// Promotion decision functions
// ---------------------------------------------------------------------------

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
    rejectedReturnPoint: parsed.status === "rejected" ? parsed.returnPoint ?? "weightSelection" : null,
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

// ---------------------------------------------------------------------------
// Private helpers — promotion internals
// ---------------------------------------------------------------------------

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
  const summary = readJsonRecord(resultSummary);
  const counts = readJsonRecord(summary?.counts);
  const matrixExpansion = readJsonRecord(summary?.matrixExpansion);
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

  const perVariantWeightOverrides = asJsonRecord(decision.perVariantWeightOverrides);
  const variantPromptDrafts = asJsonRecord(decision.variantPromptDrafts);
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
  const baseCheckpoint = {
    name: job.baseCheckpointName,
    path: job.baseCheckpointPath,
    hash: job.baseCheckpointHash,
    baseFamily: job.baseFamily,
  };
  const benchmarkMatrix = {
    checkpointMatrix: benchmark.checkpointMatrix,
    weightMatrix: benchmark.weightMatrix,
    recommendedWeight: benchmark.recommendedWeight,
  };
  const report = {
    decisionId,
    jobId: job.id,
    datasetRevisionId: benchmark.datasetRevisionId ?? job.selectedDatasetRevisionId,
    trainingRunId: benchmark.trainingRunId,
    benchmarkRunId: benchmark.id,
    baseCheckpoint,
    benchmarkMatrix,
    benchmarkResultSummary: benchmark.resultSummary,
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
    baseCheckpoint,
    benchmarkMatrix,
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

function serializeIncludedBenchmark(benchmark: {
  id: string;
  trainingRunId: string;
  checkpointMatrix: unknown;
  weightMatrix: unknown;
  recommendedWeight: number | null;
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
    checkpointMatrix: benchmark.checkpointMatrix,
    weightMatrix: benchmark.weightMatrix,
    recommendedWeight: benchmark.recommendedWeight,
    resultSummary: benchmark.resultSummary,
    datasetRevisionId: benchmark.trainingRun?.datasetRevisionId ?? null,
    finalSha256: benchmark.trainingRun?.finalSha256 ?? null,
    finalSafetensorsArtifactId: benchmark.trainingRun?.finalSafetensorsArtifactId ?? null,
  };
}

function slugifyForService(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "character";
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
    const sectionRecord = readJsonRecord(section);
    if (!sectionRecord || typeof sectionRecord.sectionId !== "string" || !sectionRecord.sectionId.trim()) {
      return false;
    }

    const latestRun = readJsonRecord(sectionRecord.latestRun);
    return (
      typeof latestRun?.id === "string" &&
      latestRun.id.trim().length > 0 &&
      latestRun.status === "done"
    );
  }).length;
}
