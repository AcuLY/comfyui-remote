import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_MANUAL_EXCLUSION_NAMES } from "./phase0-baseline";

export const PHASE1_HIGH_RISK_SECTION_NAMES = [
  "第三人称 · 背后跪姿手交",
  "第三人称 · 翘腿素股",
  "第三人称 · 反向足交-正面",
  "第一人称 · 反向足交-背面",
  "第一人称 · 骑乘手交",
] as const;

export type Phase1PredictionDecision = "auto_trash" | "candidate" | "review";
export type Phase1SplitMode = "leave-one-project-out" | "hash";

export interface Phase1PredictionRecord {
  imageId: string;
  prediction: Phase1PredictionDecision;
  confidence: number;
  reasons: string[];
  poseMatched?: boolean;
  anatomyOk?: boolean;
  detailOk?: boolean;
  rubricVersion?: string;
  reviewerVersion?: string;
}

export interface Phase1LabeledImageRow {
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  canonicalSectionName: string;
  sortOrder: number | null;
  runId: string;
  imageId: string;
  filePath: string;
  thumbPath: string;
  reviewStatus: "kept" | "trashed";
  checkpointName: string;
  loraConfigSummary: string;
  sourceFlags: string;
  manualExcluded?: boolean;
  lowSample?: boolean;
  lowProjectCoverage?: boolean;
  hasUnreviewed?: boolean;
}

export interface Phase1InvalidPrediction {
  index: number;
  imageId?: string;
  reason: string;
  message: string;
}

export interface Phase1PredictionValidationResult {
  validPredictions: Phase1PredictionRecord[];
  invalidPredictions: Phase1InvalidPrediction[];
  autoTrashWithoutReasons: number;
  duplicateImageIds: string[];
  unknownImageIds: string[];
}

export interface Phase1SplitRowsResult {
  splitKey: string;
  splitLabel: string;
  holdoutProjectTitle?: string;
  calibrationRows: Phase1LabeledImageRow[];
  holdoutRows: Phase1LabeledImageRow[];
}

export interface Phase1MetricGroup {
  key: string;
  label: string;
  totalImages: number;
  kept: number;
  trashed: number;
  predictedAutoTrash: number;
  predictedCandidate: number;
  predictedReview: number;
  missingPredictions: number;
  historicalTrashedAndPredictedAutoTrash: number;
  historicalKeptAndPredictedAutoTrash: number;
  autoTrashPrecision: number | null;
  keptAutoTrashRate: number;
  reviewReduction: number;
}

export interface Phase1SplitMetricGroup {
  splitKey: string;
  splitLabel: string;
  holdoutProjectTitle?: string;
  calibrationImages: number;
  metrics: Phase1MetricGroup;
}

export interface Phase1PredictionCoverage {
  expected: number;
  provided: number;
  usable: number;
  missing: number;
  invalid: number;
  duplicate: number;
  unknown: number;
  autoTrashWithoutReasons: number;
}

export interface Phase1EvaluationThresholds {
  autoTrashPrecisionMin: number;
  keptAutoTrashRateMax: number;
  reviewReductionMin: number;
  highRiskPrecisionMin: number;
}

export interface Phase1EvaluationAppendix {
  manualExcluded: Phase1MetricGroup;
  manualExcludedImageIds: string[];
}

export interface Phase1ReportPaths {
  summaryJson: string;
  joinedCsv: string;
  splitCsv: string;
  highRiskSectionCsv: string;
}

export interface Phase1EvaluationSummary {
  phase: 1;
  splitMode: Phase1SplitMode;
  labeledImages: number;
  mainImages: number;
  manualExcludedImages: number;
  dbMutated: boolean;
  manualExclusionsExcludedFromMainMetrics: boolean;
  thresholds: Phase1EvaluationThresholds;
  predictionCoverage: Phase1PredictionCoverage;
  missingPredictionImageIds: string[];
  unknownPredictionImageIds: string[];
  duplicatePredictionImageIds: string[];
  invalidPredictions: Phase1InvalidPrediction[];
  mainMetrics: Phase1MetricGroup;
  holdoutMetrics: Phase1MetricGroup;
  splitMetrics: Phase1SplitMetricGroup[];
  highRiskSectionMetrics: Phase1MetricGroup[];
  appendix: Phase1EvaluationAppendix;
  pass?: boolean;
  failedCriteria?: string[];
  reportPaths?: Partial<Phase1ReportPaths>;
}

export interface Phase1JoinedRow extends Phase1LabeledImageRow {
  manualExcluded: boolean;
  prediction: Phase1PredictionDecision | "missing";
  confidence: number | null;
  reasons: string;
  rubricVersion: string;
  reviewerVersion: string;
  poseMatched: boolean | null;
  anatomyOk: boolean | null;
  detailOk: boolean | null;
}

export interface Phase1OfflineEvaluation {
  summary: Phase1EvaluationSummary;
  joinedRows: Phase1JoinedRow[];
}

export interface Phase1OfflineEvaluationOptions {
  splitMode?: Phase1SplitMode;
  manualExcludedSectionNames?: readonly string[];
  highRiskSectionNames?: readonly string[];
  hashHoldoutPercent?: number;
  hashSeed?: string;
  strictUnknownPredictions?: boolean;
}

export interface Phase1SplitOptions {
  splitMode?: Phase1SplitMode;
  hashHoldoutPercent?: number;
  hashSeed?: string;
}

export interface WritePhase1EvaluationReportsOptions {
  outputDir: string;
}

export interface Phase1VerificationResult {
  phase: 1;
  pass: boolean;
  failedCriteria: string[];
  autoTrashPrecision: number | null;
  keptAutoTrashRate: number;
  reviewReduction: number;
  missingPredictions: number;
  autoTrashWithoutReasons: number;
}

const DEFAULT_SPLIT_MODE: Phase1SplitMode = "leave-one-project-out";
const DEFAULT_HASH_HOLDOUT_PERCENT = 0.2;
const DEFAULT_HASH_SEED = "phase1-offline-eval";
const DEFAULT_THRESHOLDS: Phase1EvaluationThresholds = {
  autoTrashPrecisionMin: 0.95,
  keptAutoTrashRateMax: 0.05,
  reviewReductionMin: 0.5,
  highRiskPrecisionMin: 0.9,
};
const SUMMARY_JSON_NAME = "phase1-offline-evaluation-summary.json";
const JOINED_CSV_NAME = "phase1-offline-evaluation-joined.csv";
const SPLIT_CSV_NAME = "phase1-offline-evaluation-by-split.csv";
const HIGH_RISK_CSV_NAME = "phase1-offline-evaluation-by-high-risk-section.csv";

export function parsePhase1PredictionsText(text: string): Phase1PredictionRecord[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Phase 1 predictions JSON must be an array or JSONL records");
    }
    return parsed.map(coercePredictionRecord);
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line) as unknown;
      return Array.isArray(parsed)
        ? parsed.map(coercePredictionRecord)
        : [coercePredictionRecord(parsed)];
    });
}

export function validatePhase1Predictions(
  predictions: readonly Phase1PredictionRecord[],
  labeledRows: readonly Phase1LabeledImageRow[] = [],
): Phase1PredictionValidationResult {
  const knownImageIds = new Set(labeledRows.map((row) => row.imageId));
  const seenImageIds = new Set<string>();
  const duplicateImageIds = new Set<string>();
  const unknownImageIds = new Set<string>();
  const invalidPredictions: Phase1InvalidPrediction[] = [];
  const validPredictions: Phase1PredictionRecord[] = [];
  let autoTrashWithoutReasons = 0;

  predictions.forEach((record, index) => {
    const imageId = stringFromUnknown(record.imageId).trim();
    const invalidReasons: string[] = [];
    const readableReasons = getReadableReasons(record.reasons);

    if (!imageId) {
      invalidReasons.push("image_id_required");
    }
    if (!isPhase1PredictionDecision(record.prediction)) {
      invalidReasons.push("prediction_value_supported");
    }
    if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
      invalidReasons.push("confidence_between_0_and_1_required");
    }
    if (!Array.isArray(record.reasons)) {
      invalidReasons.push("reasons_array_required");
    }
    if (record.prediction === "auto_trash" && readableReasons.length === 0) {
      autoTrashWithoutReasons += 1;
      invalidReasons.push("auto_trash_reasons_required");
    }

    if (imageId) {
      if (seenImageIds.has(imageId)) {
        duplicateImageIds.add(imageId);
      }
      seenImageIds.add(imageId);

      if (knownImageIds.size > 0 && !knownImageIds.has(imageId)) {
        unknownImageIds.add(imageId);
      }
    }

    if (invalidReasons.length > 0) {
      for (const reason of invalidReasons) {
        invalidPredictions.push({
          index,
          imageId: imageId || undefined,
          reason,
          message: formatInvalidPredictionMessage(index, imageId, reason),
        });
      }
      return;
    }

    validPredictions.push({
      ...record,
      imageId,
      reasons: readableReasons,
    });
  });

  return {
    validPredictions,
    invalidPredictions,
    autoTrashWithoutReasons,
    duplicateImageIds: [...duplicateImageIds].sort(compareStrings),
    unknownImageIds: [...unknownImageIds].sort(compareStrings),
  };
}

export function splitPhase1Rows(
  rows: readonly Phase1LabeledImageRow[],
  options: Phase1SplitOptions = {},
): Phase1SplitRowsResult[] {
  const splitMode = options.splitMode ?? DEFAULT_SPLIT_MODE;
  if (splitMode === "leave-one-project-out") {
    const projectTitles = uniquePreservingOrder(rows.map((row) => row.projectTitle));
    return projectTitles.map((projectTitle) => ({
      splitKey: projectTitle,
      splitLabel: `Holdout project: ${projectTitle}`,
      holdoutProjectTitle: projectTitle,
      calibrationRows: rows.filter((row) => row.projectTitle !== projectTitle),
      holdoutRows: rows.filter((row) => row.projectTitle === projectTitle),
    }));
  }

  if (splitMode === "hash") {
    const holdoutPercent = clampHoldoutPercent(
      options.hashHoldoutPercent ?? DEFAULT_HASH_HOLDOUT_PERCENT,
    );
    const hashSeed = options.hashSeed ?? DEFAULT_HASH_SEED;
    const holdoutRows = rows.filter((row) => isHashHoldout(row.imageId, holdoutPercent, hashSeed));
    const holdoutImageIds = new Set(holdoutRows.map((row) => row.imageId));
    return [
      {
        splitKey: `hash-${holdoutPercent}`,
        splitLabel: `Hash holdout (${Math.round(holdoutPercent * 100)}%)`,
        calibrationRows: rows.filter((row) => !holdoutImageIds.has(row.imageId)),
        holdoutRows,
      },
    ];
  }

  throw new Error(`Unsupported Phase 1 split mode: ${splitMode satisfies never}`);
}

export function computePhase1Metrics(
  rows: readonly Phase1LabeledImageRow[],
  predictions: ReadonlyMap<string, Phase1PredictionRecord> | readonly Phase1PredictionRecord[],
  options: {
    key?: string;
    label?: string;
    includeManualExcluded?: boolean;
    manualExcludedSectionNames?: readonly string[];
  } = {},
): Phase1MetricGroup {
  const predictionByImageId = isPredictionMap(predictions)
    ? predictions
    : buildPredictionMap(predictions).predictionByImageId;
  const manualExcludedSectionNames = new Set(
    [...DEFAULT_MANUAL_EXCLUSION_NAMES, ...(options.manualExcludedSectionNames ?? [])].map(
      normalizeSectionName,
    ),
  );
  const metricRows = options.includeManualExcluded
    ? rows
    : rows.filter((row) => !isManualExcludedRow(normalizeLabeledRow(row), manualExcludedSectionNames));
  return computeMetricsForRows(
    metricRows,
    predictionByImageId,
    options.key ?? "main",
    options.label ?? "Main non-manual-excluded images",
  );
}

export function computePhase1OfflineEvaluation(
  labeledRows: readonly Phase1LabeledImageRow[],
  predictions: readonly Phase1PredictionRecord[],
  options: Phase1OfflineEvaluationOptions = {},
): Phase1OfflineEvaluation {
  const splitMode = options.splitMode ?? DEFAULT_SPLIT_MODE;
  const manualExcludedSectionNames = new Set(
    [...DEFAULT_MANUAL_EXCLUSION_NAMES, ...(options.manualExcludedSectionNames ?? [])].map(
      normalizeSectionName,
    ),
  );
  const highRiskSectionNames = [
    ...(options.highRiskSectionNames ?? PHASE1_HIGH_RISK_SECTION_NAMES),
  ].map(normalizeSectionName);
  const normalizedRows = labeledRows.map(normalizeLabeledRow);
  const validation = validatePhase1Predictions(predictions, normalizedRows);
  const strictUnknownPredictionInvalids = options.strictUnknownPredictions
    ? validation.unknownImageIds.map((imageId) => ({
        index: predictions.findIndex((predictionRecord) => predictionRecord.imageId === imageId),
        imageId,
        reason: "prediction_image_id_known",
        message: `Invalid Phase 1 prediction for imageId ${imageId}: prediction_image_id_known`,
      }))
    : [];
  const invalidPredictions = [
    ...validation.invalidPredictions,
    ...strictUnknownPredictionInvalids,
  ];
  const { predictionByImageId } = buildPredictionMap(validation.validPredictions);
  const missingPredictionImageIds = normalizedRows
    .filter((row) => !predictionByImageId.has(row.imageId))
    .map((row) => row.imageId)
    .sort(compareStrings);
  const joinedRows = normalizedRows.map((row) =>
    joinPrediction(row, predictionByImageId.get(row.imageId), {
      manualExcluded: isManualExcludedRow(row, manualExcludedSectionNames),
    }),
  );
  const mainRows = normalizedRows.filter(
    (row) => !isManualExcludedRow(row, manualExcludedSectionNames),
  );
  const manualExcludedRows = normalizedRows.filter((row) =>
    isManualExcludedRow(row, manualExcludedSectionNames),
  );
  const splitRows = splitPhase1Rows(mainRows, {
    splitMode,
    hashHoldoutPercent: options.hashHoldoutPercent,
    hashSeed: options.hashSeed,
  });
  const splitMetrics = splitRows.map((split) => ({
    splitKey: split.splitKey,
    splitLabel: split.splitLabel,
    holdoutProjectTitle: split.holdoutProjectTitle,
    calibrationImages: split.calibrationRows.length,
    metrics: computeMetricsForRows(
      split.holdoutRows,
      predictionByImageId,
      split.splitKey,
      split.splitLabel,
    ),
  }));
  const holdoutRows = splitRows.flatMap((split) => split.holdoutRows);
  const highRiskSectionMetrics = highRiskSectionNames.map((canonicalSectionName) =>
    computeMetricsForRows(
      mainRows.filter(
        (row) => normalizeSectionName(row.canonicalSectionName) === canonicalSectionName,
      ),
      predictionByImageId,
      canonicalSectionName,
      canonicalSectionName,
    ),
  );
  const manualExclusionsExcludedFromMainMetrics =
    mainRows.length + manualExcludedRows.length === normalizedRows.length &&
    mainRows.every((row) => !isManualExcludedRow(row, manualExcludedSectionNames));
  const knownImageIds = new Set(normalizedRows.map((row) => row.imageId));
  const usableKnownPredictions = [...predictionByImageId.keys()].filter((imageId) =>
    knownImageIds.has(imageId),
  ).length;

  const summary: Phase1EvaluationSummary = {
    phase: 1,
    splitMode,
    labeledImages: normalizedRows.length,
    mainImages: mainRows.length,
    manualExcludedImages: manualExcludedRows.length,
    dbMutated: false,
    manualExclusionsExcludedFromMainMetrics,
    thresholds: { ...DEFAULT_THRESHOLDS },
    predictionCoverage: {
      expected: normalizedRows.length,
      provided: predictions.length,
      usable: usableKnownPredictions,
      missing: missingPredictionImageIds.length,
      invalid: invalidPredictions.length,
      duplicate: validation.duplicateImageIds.length,
      unknown: validation.unknownImageIds.length,
      autoTrashWithoutReasons: validation.autoTrashWithoutReasons,
    },
    missingPredictionImageIds,
    unknownPredictionImageIds: validation.unknownImageIds,
    duplicatePredictionImageIds: validation.duplicateImageIds,
    invalidPredictions,
    mainMetrics: computeMetricsForRows(
      mainRows,
      predictionByImageId,
      "main",
      "Main non-manual-excluded images",
    ),
    holdoutMetrics: computeMetricsForRows(
      holdoutRows,
      predictionByImageId,
      "holdout",
      "Holdout aggregate",
    ),
    splitMetrics,
    highRiskSectionMetrics,
    appendix: {
      manualExcluded: computeMetricsForRows(
        manualExcludedRows,
        predictionByImageId,
        "manual_excluded",
        "Manual-excluded images",
      ),
      manualExcludedImageIds: manualExcludedRows.map((row) => row.imageId).sort(compareStrings),
    },
  };
  const verification = verifyPhase1Evaluation(summary);
  summary.pass = verification.pass;
  summary.failedCriteria = verification.failedCriteria;

  return { summary, joinedRows };
}

export async function readPhase0LabeledImagesCsv(
  csvPath: string,
): Promise<Phase1LabeledImageRow[]> {
  return parsePhase0LabeledImagesCsvText(await readFile(csvPath, "utf8"));
}

export function parsePhase0LabeledImagesCsvText(text: string): Phase1LabeledImageRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  const [headers, ...records] = table;
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  return records
    .filter((record) => record.some((cell) => cell.length > 0))
    .map((record, index) => {
      const reviewStatus = requiredCsvCell(record, headerIndex, "reviewStatus", index)
        .trim()
        .toLowerCase();
      if (reviewStatus !== "kept" && reviewStatus !== "trashed") {
        throw new Error(
          `Phase 0 labeled CSV row ${index + 2} has unsupported reviewStatus: ${reviewStatus}`,
        );
      }

      return {
        projectId: requiredCsvCell(record, headerIndex, "projectId", index),
        projectTitle: requiredCsvCell(record, headerIndex, "projectTitle", index),
        sectionId: requiredCsvCell(record, headerIndex, "sectionId", index),
        sectionName: requiredCsvCell(record, headerIndex, "sectionName", index),
        canonicalSectionName: requiredCsvCell(
          record,
          headerIndex,
          "canonicalSectionName",
          index,
        ),
        sortOrder: parseNullableNumber(optionalCsvCell(record, headerIndex, "sortOrder")),
        runId: requiredCsvCell(record, headerIndex, "runId", index),
        imageId: requiredCsvCell(record, headerIndex, "imageId", index),
        filePath: requiredCsvCell(record, headerIndex, "filePath", index),
        thumbPath: optionalCsvCell(record, headerIndex, "thumbPath"),
        reviewStatus,
        checkpointName: optionalCsvCell(record, headerIndex, "checkpointName"),
        loraConfigSummary: optionalCsvCell(record, headerIndex, "loraConfigSummary"),
        sourceFlags: optionalCsvCell(record, headerIndex, "sourceFlags"),
      } satisfies Phase1LabeledImageRow;
    });
}

export async function writePhase1EvaluationReports(
  evaluation: Phase1OfflineEvaluation,
  options: WritePhase1EvaluationReportsOptions,
): Promise<Phase1ReportPaths> {
  const outputDir = path.resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const reportPaths: Phase1ReportPaths = {
    summaryJson: path.join(outputDir, SUMMARY_JSON_NAME),
    joinedCsv: path.join(outputDir, JOINED_CSV_NAME),
    splitCsv: path.join(outputDir, SPLIT_CSV_NAME),
    highRiskSectionCsv: path.join(outputDir, HIGH_RISK_CSV_NAME),
  };

  evaluation.summary.reportPaths = reportPaths;
  const verification = verifyPhase1Evaluation(evaluation.summary);
  evaluation.summary.pass = verification.pass;
  evaluation.summary.failedCriteria = verification.failedCriteria;

  await writeFile(
    reportPaths.summaryJson,
    `${JSON.stringify(evaluation.summary, null, 2)}\n`,
    "utf8",
  );
  await writeFile(reportPaths.joinedCsv, serializeJoinedCsv(evaluation.joinedRows), "utf8");
  await writeFile(reportPaths.splitCsv, serializeSplitMetricsCsv(evaluation.summary.splitMetrics), "utf8");
  await writeFile(
    reportPaths.highRiskSectionCsv,
    serializeHighRiskMetricsCsv(evaluation.summary.highRiskSectionMetrics),
    "utf8",
  );

  return reportPaths;
}

export function verifyPhase1Evaluation(
  summary: Phase1EvaluationSummary | Record<string, unknown>,
): Phase1VerificationResult {
  const object = summary as Record<string, unknown>;
  const thresholds = DEFAULT_THRESHOLDS;
  const holdoutMetrics = getMetricObject(object.holdoutMetrics);
  const predictionCoverage = getRecord(object.predictionCoverage);
  const highRiskSectionMetrics = getMetricArray(object.highRiskSectionMetrics);
  const reportedHighRiskNames = new Set(
    highRiskSectionMetrics.map((metric) => String(metric.key ?? metric.label ?? "")),
  );
  const failedCriteria: string[] = [];
  const autoTrashPrecision = getNullableNumber(holdoutMetrics.autoTrashPrecision);
  const keptAutoTrashRate = getNumber(holdoutMetrics.keptAutoTrashRate, Number.POSITIVE_INFINITY);
  const reviewReduction = getNumber(holdoutMetrics.reviewReduction, Number.NEGATIVE_INFINITY);
  const missingPredictions = getNumber(predictionCoverage.missing, 0);
  const invalidPredictions = getNumber(predictionCoverage.invalid, 0);
  const duplicatePredictions = getNumber(predictionCoverage.duplicate, 0);
  const unknownPredictions = getNumber(predictionCoverage.unknown, 0);
  const expectedPredictions = getNumber(predictionCoverage.expected, 0);
  const providedPredictions = getNumber(predictionCoverage.provided, Number.NaN);
  const usablePredictions = getNumber(predictionCoverage.usable, 0);
  const labeledImages = getNumber(object.labeledImages, Number.NaN);
  const autoTrashWithoutReasons = getNumber(
    predictionCoverage.autoTrashWithoutReasons,
    getNumber(object.autoTrashWithoutReasons, 0),
  );

  if (object.phase !== 1) {
    failedCriteria.push("phase_1_required");
  }
  if (object.dbMutated !== false) {
    failedCriteria.push("db_mutated_false_required");
  }
  if (autoTrashPrecision === null || autoTrashPrecision < thresholds.autoTrashPrecisionMin) {
    failedCriteria.push("auto_trash_precision_min_0_95");
  }
  if (keptAutoTrashRate > thresholds.keptAutoTrashRateMax) {
    failedCriteria.push("kept_auto_trash_rate_max_0_05");
  }
  if (reviewReduction < thresholds.reviewReductionMin) {
    failedCriteria.push("review_reduction_min_0_50");
  }
  if (autoTrashWithoutReasons > 0) {
    failedCriteria.push("auto_trash_reasons_required");
  }
  if (
    missingPredictions > 0 ||
    invalidPredictions > 0 ||
    duplicatePredictions > 0 ||
    unknownPredictions > 0 ||
    providedPredictions !== expectedPredictions ||
    usablePredictions !== expectedPredictions
  ) {
    failedCriteria.push("predictions_complete");
  }
  if (
    expectedPredictions !== labeledImages ||
    providedPredictions !== expectedPredictions ||
    usablePredictions !== expectedPredictions
  ) {
    failedCriteria.push("prediction_coverage_reconciles_labeled_images");
  }
  if (!predictionIssueListsMatchCounts(object, predictionCoverage)) {
    failedCriteria.push("prediction_issue_lists_match_counts");
  }
  if (
    PHASE1_HIGH_RISK_SECTION_NAMES.some(
      (canonicalSectionName) => !reportedHighRiskNames.has(canonicalSectionName),
    ) ||
    highRiskSectionMetrics.some((metric) => {
      const predictedAutoTrash = getNumber(metric.predictedAutoTrash, 0);
      const precision = getNullableNumber(metric.autoTrashPrecision);
      return (
        predictedAutoTrash > 0 &&
        (precision === null || precision < thresholds.highRiskPrecisionMin)
      );
    })
  ) {
    failedCriteria.push("high_risk_precision_min_0_90");
  }
  if (!manualExclusionsAreExcludedFromMainMetrics(object)) {
    failedCriteria.push("manual_exclusions_excluded_from_main_metrics");
  }
  if (!manualExclusionCountsReconcile(object)) {
    failedCriteria.push("manual_exclusions_reconcile_labeled_images");
  }
  if (object.splitMode !== "leave-one-project-out") {
    failedCriteria.push("leave_one_project_out_required");
  }

  return {
    phase: 1,
    pass: failedCriteria.length === 0,
    failedCriteria,
    autoTrashPrecision,
    keptAutoTrashRate,
    reviewReduction,
    missingPredictions,
    autoTrashWithoutReasons,
  };
}

export function getDefaultPhase1OutputDir(projectRoot = process.cwd()): string {
  return path.join(projectRoot, "docs", "plans", "auto-review-analysis");
}

export function getDefaultPhase1LabeledImagesPath(projectRoot = process.cwd()): string {
  return path.join(getDefaultPhase1OutputDir(projectRoot), "phase0-labeled-images.csv");
}

export function getDefaultPhase1PredictionsPath(projectRoot = process.cwd()): string {
  return path.join(getDefaultPhase1OutputDir(projectRoot), "phase1-reviewer-predictions.jsonl");
}

export function getDefaultPhase1SummaryPath(projectRoot = process.cwd()): string {
  return path.join(getDefaultPhase1OutputDir(projectRoot), SUMMARY_JSON_NAME);
}

function coercePredictionRecord(value: unknown): Phase1PredictionRecord {
  const object = getRecord(value);
  return {
    imageId: stringFromUnknown(object.imageId),
    prediction: stringFromUnknown(object.prediction) as Phase1PredictionDecision,
    confidence: numberFromUnknown(object.confidence),
    reasons: Array.isArray(object.reasons) ? object.reasons.map(stringFromUnknown) : [],
    poseMatched: booleanFromUnknown(object.poseMatched),
    anatomyOk: booleanFromUnknown(object.anatomyOk),
    detailOk: booleanFromUnknown(object.detailOk),
    rubricVersion: optionalStringFromUnknown(object.rubricVersion),
    reviewerVersion: optionalStringFromUnknown(object.reviewerVersion),
  };
}

function buildPredictionMap(predictions: readonly Phase1PredictionRecord[]): {
  predictionByImageId: Map<string, Phase1PredictionRecord>;
} {
  const predictionByImageId = new Map<string, Phase1PredictionRecord>();
  for (const prediction of predictions) {
    if (!predictionByImageId.has(prediction.imageId)) {
      predictionByImageId.set(prediction.imageId, prediction);
    }
  }
  return { predictionByImageId };
}

function isPredictionMap(
  value: ReadonlyMap<string, Phase1PredictionRecord> | readonly Phase1PredictionRecord[],
): value is ReadonlyMap<string, Phase1PredictionRecord> {
  return (
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { has?: unknown }).has === "function"
  );
}

function computeMetricsForRows(
  rows: readonly Phase1LabeledImageRow[],
  predictionByImageId: ReadonlyMap<string, Phase1PredictionRecord>,
  key: string,
  label: string,
): Phase1MetricGroup {
  let kept = 0;
  let trashed = 0;
  let predictedAutoTrash = 0;
  let predictedCandidate = 0;
  let predictedReview = 0;
  let missingPredictions = 0;
  let historicalTrashedAndPredictedAutoTrash = 0;
  let historicalKeptAndPredictedAutoTrash = 0;

  for (const row of rows) {
    if (row.reviewStatus === "kept") kept += 1;
    if (row.reviewStatus === "trashed") trashed += 1;

    const prediction = predictionByImageId.get(row.imageId);
    if (!prediction) {
      missingPredictions += 1;
      continue;
    }

    if (prediction.prediction === "auto_trash") {
      predictedAutoTrash += 1;
      if (row.reviewStatus === "trashed") {
        historicalTrashedAndPredictedAutoTrash += 1;
      } else if (row.reviewStatus === "kept") {
        historicalKeptAndPredictedAutoTrash += 1;
      }
    } else if (prediction.prediction === "candidate") {
      predictedCandidate += 1;
    } else if (prediction.prediction === "review") {
      predictedReview += 1;
    }
  }

  return {
    key,
    label,
    totalImages: rows.length,
    kept,
    trashed,
    predictedAutoTrash,
    predictedCandidate,
    predictedReview,
    missingPredictions,
    historicalTrashedAndPredictedAutoTrash,
    historicalKeptAndPredictedAutoTrash,
    autoTrashPrecision:
      predictedAutoTrash > 0
        ? rate(historicalTrashedAndPredictedAutoTrash, predictedAutoTrash)
        : null,
    keptAutoTrashRate: rate(historicalKeptAndPredictedAutoTrash, kept),
    reviewReduction: rows.length > 0 ? roundRate(1 - predictedReview / rows.length) : 0,
  };
}

function normalizeLabeledRow(row: Phase1LabeledImageRow): Phase1LabeledImageRow {
  return {
    ...row,
    projectId: String(row.projectId),
    projectTitle: String(row.projectTitle),
    sectionId: String(row.sectionId),
    sectionName: normalizeSectionName(row.sectionName),
    canonicalSectionName: normalizeSectionName(row.canonicalSectionName || row.sectionName),
    sortOrder: parseNullableNumber(row.sortOrder),
    runId: String(row.runId),
    imageId: String(row.imageId),
    filePath: String(row.filePath),
    thumbPath: String(row.thumbPath ?? ""),
    reviewStatus: row.reviewStatus,
    checkpointName: String(row.checkpointName ?? ""),
    loraConfigSummary: String(row.loraConfigSummary ?? ""),
    sourceFlags: String(row.sourceFlags ?? ""),
  };
}

function joinPrediction(
  row: Phase1LabeledImageRow,
  prediction: Phase1PredictionRecord | undefined,
  options: { manualExcluded: boolean },
): Phase1JoinedRow {
  return {
    ...row,
    manualExcluded: options.manualExcluded,
    prediction: prediction?.prediction ?? "missing",
    confidence: prediction?.confidence ?? null,
    reasons: prediction ? getReadableReasons(prediction.reasons).join(";") : "",
    rubricVersion: prediction?.rubricVersion ?? "",
    reviewerVersion: prediction?.reviewerVersion ?? "",
    poseMatched: prediction?.poseMatched ?? null,
    anatomyOk: prediction?.anatomyOk ?? null,
    detailOk: prediction?.detailOk ?? null,
  };
}

function isManualExcludedRow(
  row: Phase1LabeledImageRow,
  manualExcludedSectionNames: ReadonlySet<string>,
): boolean {
  return (
    row.manualExcluded === true ||
    splitFlags(row.sourceFlags).has("manual_excluded") ||
    manualExcludedSectionNames.has(normalizeSectionName(row.canonicalSectionName))
  );
}

function splitFlags(sourceFlags: string): Set<string> {
  return new Set(
    sourceFlags
      .split(";")
      .map((flag) => flag.trim())
      .filter(Boolean),
  );
}

function isHashHoldout(imageId: string, holdoutPercent: number, hashSeed: string): boolean {
  const hash = createHash("sha256").update(`${hashSeed}:${imageId}`).digest("hex");
  const bucket = Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  return bucket < holdoutPercent;
}

function clampHoldoutPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new Error("Phase 1 hash holdout percent must be greater than 0 and less than 1");
  }
  return value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char === "\r") {
      // Ignore CR in CRLF; bare CR is not emitted by Phase 0 reports.
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function requiredCsvCell(
  record: readonly string[],
  headerIndex: ReadonlyMap<string, number>,
  header: string,
  rowIndex: number,
): string {
  const value = optionalCsvCell(record, headerIndex, header);
  if (value === "") {
    throw new Error(`Phase 0 labeled CSV row ${rowIndex + 2} is missing ${header}`);
  }
  return value;
}

function optionalCsvCell(
  record: readonly string[],
  headerIndex: ReadonlyMap<string, number>,
  header: string,
): string {
  const index = headerIndex.get(header);
  if (index === undefined) return "";
  return record[index] ?? "";
}

function serializeJoinedCsv(rows: readonly Phase1JoinedRow[]): string {
  return serializeCsv(
    [
      "imageId",
      "projectId",
      "projectTitle",
      "sectionId",
      "sectionName",
      "canonicalSectionName",
      "sortOrder",
      "runId",
      "filePath",
      "thumbPath",
      "reviewStatus",
      "sourceFlags",
      "manualExcluded",
      "prediction",
      "confidence",
      "reasons",
      "poseMatched",
      "anatomyOk",
      "detailOk",
      "rubricVersion",
      "reviewerVersion",
    ],
    rows.map((row) => [
      row.imageId,
      row.projectId,
      row.projectTitle,
      row.sectionId,
      row.sectionName,
      row.canonicalSectionName,
      row.sortOrder,
      row.runId,
      row.filePath,
      row.thumbPath,
      row.reviewStatus,
      row.sourceFlags,
      row.manualExcluded,
      row.prediction,
      row.confidence,
      row.reasons,
      row.poseMatched,
      row.anatomyOk,
      row.detailOk,
      row.rubricVersion,
      row.reviewerVersion,
    ]),
  );
}

function serializeSplitMetricsCsv(splitMetrics: readonly Phase1SplitMetricGroup[]): string {
  return serializeCsv(
    [
      "splitKey",
      "splitLabel",
      "holdoutProjectTitle",
      "calibrationImages",
      "totalImages",
      "kept",
      "trashed",
      "predictedAutoTrash",
      "predictedCandidate",
      "predictedReview",
      "missingPredictions",
      "autoTrashPrecision",
      "keptAutoTrashRate",
      "reviewReduction",
    ],
    splitMetrics.map((split) => [
      split.splitKey,
      split.splitLabel,
      split.holdoutProjectTitle ?? "",
      split.calibrationImages,
      split.metrics.totalImages,
      split.metrics.kept,
      split.metrics.trashed,
      split.metrics.predictedAutoTrash,
      split.metrics.predictedCandidate,
      split.metrics.predictedReview,
      split.metrics.missingPredictions,
      split.metrics.autoTrashPrecision,
      split.metrics.keptAutoTrashRate,
      split.metrics.reviewReduction,
    ]),
  );
}

function serializeHighRiskMetricsCsv(metrics: readonly Phase1MetricGroup[]): string {
  return serializeCsv(
    [
      "canonicalSectionName",
      "totalImages",
      "kept",
      "trashed",
      "predictedAutoTrash",
      "predictedCandidate",
      "predictedReview",
      "missingPredictions",
      "autoTrashPrecision",
      "keptAutoTrashRate",
      "reviewReduction",
    ],
    metrics.map((metric) => [
      metric.key,
      metric.totalImages,
      metric.kept,
      metric.trashed,
      metric.predictedAutoTrash,
      metric.predictedCandidate,
      metric.predictedReview,
      metric.missingPredictions,
      metric.autoTrashPrecision,
      metric.keptAutoTrashRate,
      metric.reviewReduction,
    ]),
  );
}

function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = spreadsheetSafeText(value);
  if (!/[",\n\r]|^\s|\s$/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function spreadsheetSafeText(value: unknown): string {
  const text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function manualExclusionsAreExcludedFromMainMetrics(object: Record<string, unknown>): boolean {
  const flag = object.manualExclusionsExcludedFromMainMetrics;
  if (flag !== true) return false;

  const mainMetrics = getMetricObject(object.mainMetrics);
  const appendix = getRecord(object.appendix);
  const manualExcludedMetrics = getMetricObject(appendix.manualExcluded);
  const labeledImages = getNumber(object.labeledImages, Number.NaN);
  const mainImages = getNumber(object.mainImages, Number.NaN);
  const manualExcludedImages = getNumber(object.manualExcludedImages, Number.NaN);
  const mainMetricImages = getNumber(mainMetrics.totalImages, Number.NaN);
  const manualMetricImages = getNumber(manualExcludedMetrics.totalImages, Number.NaN);
  return (
    mainMetricImages === mainImages &&
    manualMetricImages === manualExcludedImages &&
    mainMetricImages + manualMetricImages === labeledImages
  );
}

function manualExclusionCountsReconcile(object: Record<string, unknown>): boolean {
  const labeledImages = getNumber(object.labeledImages, Number.NaN);
  const mainImages = getNumber(object.mainImages, Number.NaN);
  const manualExcludedImages = getNumber(object.manualExcludedImages, Number.NaN);
  const mainMetrics = getMetricObject(object.mainMetrics);
  const appendix = getRecord(object.appendix);
  const manualExcludedMetrics = getMetricObject(appendix.manualExcluded);
  return (
    mainImages + manualExcludedImages === labeledImages &&
    getNumber(mainMetrics.totalImages, Number.NaN) === mainImages &&
    getNumber(manualExcludedMetrics.totalImages, Number.NaN) === manualExcludedImages &&
    arrayLength(appendix.manualExcludedImageIds) === manualExcludedImages
  );
}

function predictionIssueListsMatchCounts(
  object: Record<string, unknown>,
  predictionCoverage: Record<string, unknown>,
): boolean {
  return (
    arrayLength(object.missingPredictionImageIds) === getNumber(predictionCoverage.missing, 0) &&
    arrayLength(object.unknownPredictionImageIds) === getNumber(predictionCoverage.unknown, 0) &&
    arrayLength(object.duplicatePredictionImageIds) === getNumber(predictionCoverage.duplicate, 0) &&
    arrayLength(object.invalidPredictions) === getNumber(predictionCoverage.invalid, 0)
  );
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function getMetricArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(getRecord) : [];
}

function getMetricObject(value: unknown): Record<string, unknown> {
  return getRecord(value);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanFromUnknown(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function stringFromUnknown(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function optionalStringFromUnknown(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function normalizeSectionName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getReadableReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringFromUnknown).map((reason) => reason.trim()).filter(Boolean);
}

function isPhase1PredictionDecision(value: unknown): value is Phase1PredictionDecision {
  return value === "auto_trash" || value === "candidate" || value === "review";
}

function formatInvalidPredictionMessage(index: number, imageId: string, reason: string): string {
  const image = imageId ? ` for imageId ${imageId}` : "";
  return `Invalid Phase 1 prediction at index ${index}${image}: ${reason}`;
}

function uniquePreservingOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundRate(numerator / denominator);
}

function roundRate(value: number): number {
  return Number(value.toFixed(4));
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
