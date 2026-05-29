import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  computePhase1Metrics,
  computePhase1OfflineEvaluation,
  parsePhase1PredictionsText,
  PHASE1_HIGH_RISK_SECTION_NAMES,
  readPhase0LabeledImagesCsv,
  splitPhase1Rows,
  validatePhase1Predictions,
  verifyPhase1Evaluation,
  writePhase1EvaluationReports,
  type Phase1EvaluationSummary,
  type Phase1LabeledImageRow,
  type Phase1PredictionRecord,
} from "../src/server/quality/phase1-offline-eval";
import { parseEvaluateArgs } from "../scripts/quality/evaluate";
import {
  parseVerifyArgs,
  verifyQualitySummaryFile,
  verifyPhase1EvaluationSummaryFile,
} from "../scripts/quality/verify";

function labeledRow(overrides: Partial<Phase1LabeledImageRow> = {}): Phase1LabeledImageRow {
  return {
    projectId: "project-a",
    projectTitle: "叶瞬光",
    sectionId: "section-a",
    sectionName: "单人 · 背手站立",
    canonicalSectionName: "单人 · 背手站立",
    sortOrder: 1,
    runId: "run-a",
    imageId: "image-a",
    filePath: "/images/image-a.png",
    thumbPath: "/images/thumbs/image-a.webp",
    reviewStatus: "kept",
    checkpointName: "checkpoint.safetensors",
    loraConfigSummary: "{}",
    sourceFlags: "",
    ...overrides,
  };
}

function prediction(
  imageId: string,
  predictionValue: Phase1PredictionRecord["prediction"],
  overrides: Partial<Phase1PredictionRecord> = {},
): Phase1PredictionRecord {
  return {
    imageId,
    prediction: predictionValue,
    confidence: 0.91,
    reasons: predictionValue === "auto_trash" ? ["pose_failed"] : [],
    poseMatched: predictionValue !== "auto_trash",
    anatomyOk: predictionValue !== "auto_trash",
    detailOk: true,
    rubricVersion: "rubric-test",
    reviewerVersion: "reviewer-test",
    ...overrides,
  };
}

function validPhase1Summary(overrides: Partial<Phase1EvaluationSummary> = {}): Phase1EvaluationSummary {
  const metric = {
    key: "all",
    label: "All non-manual-excluded images",
    totalImages: 100,
    kept: 50,
    trashed: 50,
    predictedAutoTrash: 50,
    predictedCandidate: 10,
    predictedReview: 40,
    missingPredictions: 0,
    historicalTrashedAndPredictedAutoTrash: 48,
    historicalKeptAndPredictedAutoTrash: 2,
    autoTrashPrecision: 0.96,
    keptAutoTrashRate: 0.04,
    reviewReduction: 0.6,
  };

  return {
    phase: 1,
    splitMode: "leave-one-project-out",
    labeledImages: 102,
    mainImages: 100,
    manualExcludedImages: 2,
    dbMutated: false,
    manualExclusionsExcludedFromMainMetrics: true,
    thresholds: {
      autoTrashPrecisionMin: 0.95,
      keptAutoTrashRateMax: 0.05,
      reviewReductionMin: 0.5,
      highRiskPrecisionMin: 0.9,
    },
    predictionCoverage: {
      expected: 102,
      provided: 102,
      usable: 102,
      missing: 0,
      invalid: 0,
      duplicate: 0,
      unknown: 0,
      autoTrashWithoutReasons: 0,
    },
    missingPredictionImageIds: [],
    unknownPredictionImageIds: [],
    duplicatePredictionImageIds: [],
    invalidPredictions: [],
    mainMetrics: metric,
    holdoutMetrics: { ...metric, key: "holdout", label: "Holdout aggregate" },
    splitMetrics: [
      {
        splitKey: "叶瞬光",
        splitLabel: "Holdout project: 叶瞬光",
        holdoutProjectTitle: "叶瞬光",
        calibrationImages: 90,
        metrics: { ...metric, key: "叶瞬光", label: "Holdout project: 叶瞬光" },
      },
    ],
    highRiskSectionMetrics: PHASE1_HIGH_RISK_SECTION_NAMES.map((canonicalSectionName) => ({
      ...metric,
      key: canonicalSectionName,
      label: canonicalSectionName,
      autoTrashPrecision: 0.9,
    })),
    appendix: {
      manualExcluded: {
        key: "manual_excluded",
        label: "Manual-excluded images",
        totalImages: 2,
        kept: 1,
        trashed: 1,
        predictedAutoTrash: 1,
        predictedCandidate: 0,
        predictedReview: 1,
        missingPredictions: 0,
        historicalTrashedAndPredictedAutoTrash: 1,
        historicalKeptAndPredictedAutoTrash: 0,
        autoTrashPrecision: 1,
        keptAutoTrashRate: 0,
        reviewReduction: 0.5,
      },
      manualExcludedImageIds: ["manual-1", "manual-2"],
    },
    ...overrides,
  };
}

test("parsePhase1PredictionsText supports JSON arrays and JSONL", () => {
  const arrayPredictions = parsePhase1PredictionsText(
    JSON.stringify([prediction("array-image", "review")]),
  );
  assert.equal(arrayPredictions.length, 1);
  assert.equal(arrayPredictions[0].imageId, "array-image");

  const jsonlPredictions = parsePhase1PredictionsText(
    `${JSON.stringify(prediction("jsonl-a", "auto_trash"))}\n${JSON.stringify(
      prediction("jsonl-b", "candidate"),
    )}\n`,
  );
  assert.deepEqual(
    jsonlPredictions.map((record) => record.imageId),
    ["jsonl-a", "jsonl-b"],
  );
});

test("computePhase1OfflineEvaluation excludes manual_excluded rows from main metrics", () => {
  const rows = [
    labeledRow({ imageId: "kept-main", reviewStatus: "kept" }),
    labeledRow({ imageId: "trash-main", reviewStatus: "trashed" }),
    labeledRow({
      imageId: "manual-auto-trash",
      sectionId: "manual-section",
      sectionName: "单人 · 拎鞋",
      canonicalSectionName: "单人 · 拎鞋",
      sortOrder: 99,
      reviewStatus: "kept",
      sourceFlags: "manual_excluded;low_sample_lt20",
    }),
  ];

  const evaluation = computePhase1OfflineEvaluation(rows, [
    prediction("kept-main", "review"),
    prediction("trash-main", "auto_trash"),
    prediction("manual-auto-trash", "auto_trash"),
  ]);

  const mainMetrics = computePhase1Metrics(rows, [
    prediction("kept-main", "review"),
    prediction("trash-main", "auto_trash"),
    prediction("manual-auto-trash", "auto_trash"),
  ]);

  assert.equal(mainMetrics.totalImages, 2);
  assert.equal(mainMetrics.predictedAutoTrash, 1);
  assert.equal(evaluation.summary.labeledImages, 3);
  assert.equal(evaluation.summary.mainMetrics.totalImages, 2);
  assert.equal(evaluation.summary.mainMetrics.predictedAutoTrash, 1);
  assert.equal(evaluation.summary.appendix.manualExcluded.totalImages, 1);
  assert.equal(evaluation.summary.appendix.manualExcluded.predictedAutoTrash, 1);
  assert.deepEqual(evaluation.summary.appendix.manualExcludedImageIds, ["manual-auto-trash"]);
  assert.equal(evaluation.summary.manualExclusionsExcludedFromMainMetrics, true);
});

test("computePhase1OfflineEvaluation computes precision, kept auto-trash rate, and review reduction", () => {
  const rows = [
    labeledRow({ imageId: "trashed-auto", reviewStatus: "trashed" }),
    labeledRow({ imageId: "kept-auto", reviewStatus: "kept" }),
    labeledRow({ imageId: "kept-review", reviewStatus: "kept" }),
    labeledRow({ imageId: "trashed-candidate", reviewStatus: "trashed" }),
  ];

  const evaluation = computePhase1OfflineEvaluation(rows, [
    prediction("trashed-auto", "auto_trash"),
    prediction("kept-auto", "auto_trash"),
    prediction("kept-review", "review"),
    prediction("trashed-candidate", "candidate"),
  ]);

  assert.equal(evaluation.summary.mainMetrics.totalImages, 4);
  assert.equal(evaluation.summary.mainMetrics.predictedAutoTrash, 2);
  assert.equal(evaluation.summary.mainMetrics.historicalTrashedAndPredictedAutoTrash, 1);
  assert.equal(evaluation.summary.mainMetrics.historicalKeptAndPredictedAutoTrash, 1);
  assert.equal(evaluation.summary.mainMetrics.autoTrashPrecision, 0.5);
  assert.equal(evaluation.summary.mainMetrics.keptAutoTrashRate, 0.5);
  assert.equal(evaluation.summary.mainMetrics.reviewReduction, 0.75);
});

test("validatePhase1Predictions requires readable reasons for auto_trash", () => {
  const validation = validatePhase1Predictions([
    prediction("bad-auto-trash", "auto_trash", { reasons: [] }),
  ]);

  assert.equal(validation.autoTrashWithoutReasons, 1);
  assert.equal(validation.invalidPredictions.length, 1);
  assert.equal(validation.invalidPredictions[0].reason, "auto_trash_reasons_required");
});

test("splitPhase1Rows supports leave-one-project-out and deterministic hash split", () => {
  const rows = [
    labeledRow({ projectId: "project-a", projectTitle: "叶瞬光", imageId: "image-a" }),
    labeledRow({ projectId: "project-a", projectTitle: "叶瞬光", imageId: "image-b" }),
    labeledRow({ projectId: "project-b", projectTitle: "大乔", imageId: "image-c" }),
    labeledRow({ projectId: "project-c", projectTitle: "安魂曲", imageId: "image-d" }),
  ];

  const leaveOneProjectOut = splitPhase1Rows(rows, { splitMode: "leave-one-project-out" });
  assert.equal(leaveOneProjectOut.length, 3);
  assert.deepEqual(
    leaveOneProjectOut.map((split) => split.holdoutProjectTitle),
    ["叶瞬光", "大乔", "安魂曲"],
  );
  assert.deepEqual(
    leaveOneProjectOut[0].holdoutRows.map((row) => row.imageId),
    ["image-a", "image-b"],
  );
  assert.equal(leaveOneProjectOut[0].calibrationRows.length, 2);

  const firstHashSplit = splitPhase1Rows(rows, {
    splitMode: "hash",
    hashHoldoutPercent: 0.5,
    hashSeed: "stable-test-seed",
  });
  const secondHashSplit = splitPhase1Rows(rows, {
    splitMode: "hash",
    hashHoldoutPercent: 0.5,
    hashSeed: "stable-test-seed",
  });

  assert.deepEqual(firstHashSplit, secondHashSplit);
  assert.equal(firstHashSplit.length, 1);
  assert.equal(
    firstHashSplit[0].holdoutRows.length + firstHashSplit[0].calibrationRows.length,
    rows.length,
  );
});

test("readPhase0LabeledImagesCsv parses exported CSV rows with source flags", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase1-read-csv-"));
  try {
    const csvPath = path.join(outputDir, "phase0-labeled-images.csv");
    await writeFile(
      csvPath,
      [
        "projectId,projectTitle,sectionId,sectionName,canonicalSectionName,sortOrder,runId,imageId,filePath,thumbPath,reviewStatus,checkpointName,loraConfigSummary,sourceFlags",
        'project-a,叶瞬光,section-a,"单人 · 背手站立","单人 · 背手站立",7,run-a,image-a,/images/a.png,/thumbs/a.webp,kept,checkpoint.safetensors,"{ ""lora"": ""quoted"" }","manual_excluded;low_sample_lt20"',
      ].join("\n"),
      "utf8",
    );

    const rows = await readPhase0LabeledImagesCsv(csvPath);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].projectTitle, "叶瞬光");
    assert.equal(rows[0].sortOrder, 7);
    assert.equal(rows[0].reviewStatus, "kept");
    assert.equal(rows[0].sourceFlags, "manual_excluded;low_sample_lt20");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("writePhase1EvaluationReports writes summary JSON and joined/split/high-risk CSV files", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase1-write-reports-"));
  try {
    const rows = [
      labeledRow({
        projectTitle: "叶瞬光",
        imageId: "risk-trash",
        canonicalSectionName: PHASE1_HIGH_RISK_SECTION_NAMES[0],
        sectionName: PHASE1_HIGH_RISK_SECTION_NAMES[0],
        reviewStatus: "trashed",
      }),
      labeledRow({ projectTitle: "大乔", imageId: "plain-kept", reviewStatus: "kept" }),
    ];
    const evaluation = computePhase1OfflineEvaluation(rows, [
      prediction("risk-trash", "auto_trash"),
      prediction("plain-kept", "review"),
    ]);

    const reportPaths = await writePhase1EvaluationReports(evaluation, { outputDir });

    assert.deepEqual(Object.keys(reportPaths).sort(), [
      "highRiskSectionCsv",
      "joinedCsv",
      "splitCsv",
      "summaryJson",
    ]);

    const summaryJson = JSON.parse(await readFile(reportPaths.summaryJson, "utf8"));
    const joinedCsv = await readFile(reportPaths.joinedCsv, "utf8");
    const splitCsv = await readFile(reportPaths.splitCsv, "utf8");
    const highRiskCsv = await readFile(reportPaths.highRiskSectionCsv, "utf8");

    assert.equal(summaryJson.phase, 1);
    assert.equal(summaryJson.reportPaths.summaryJson, reportPaths.summaryJson);
    assert.match(joinedCsv, /imageId,projectId,projectTitle,sectionId,sectionName,canonicalSectionName/);
    assert.match(joinedCsv, /risk-trash/);
    assert.match(splitCsv, /splitKey,splitLabel,holdoutProjectTitle,calibrationImages,totalImages/);
    assert.match(highRiskCsv, /canonicalSectionName,totalImages,kept,trashed,predictedAutoTrash/);
    assert.match(highRiskCsv, new RegExp(PHASE1_HIGH_RISK_SECTION_NAMES[0]));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("writePhase1EvaluationReports escapes spreadsheet formula-leading CSV cells", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase1-safe-csv-"));
  try {
    const evaluation = computePhase1OfflineEvaluation(
      [labeledRow({ imageId: "formula-risk", reviewStatus: "trashed" })],
      [
        prediction("formula-risk", "auto_trash", {
          reasons: ["=cmd|' /C calc'!A0"],
          rubricVersion: "@rubric",
          reviewerVersion: "+reviewer",
        }),
      ],
    );

    const reportPaths = await writePhase1EvaluationReports(evaluation, { outputDir });
    const joinedCsv = await readFile(reportPaths.joinedCsv, "utf8");

    assert.match(joinedCsv, /'=cmd\|'/);
    assert.match(joinedCsv, /'@rubric/);
    assert.match(joinedCsv, /'\+reviewer/);
    assert.doesNotMatch(joinedCsv, /,=cmd\|'/);
    assert.doesNotMatch(joinedCsv, /,@rubric/);
    assert.doesNotMatch(joinedCsv, /,\+reviewer/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("parseEvaluateArgs supports Phase 1 split, labeled, predictions, and out options", () => {
  assert.deepEqual(
    parseEvaluateArgs([
      "--phase",
      "1",
      "--split",
      "hash",
      "--labeled",
      "labeled.csv",
      "--predictions",
      "predictions.jsonl",
      "--out",
      "reports",
    ]),
    {
      phase: 1,
      splitMode: "hash",
      labeledPath: "labeled.csv",
      predictionsPath: "predictions.jsonl",
      outDir: "reports",
      projectRoot: process.cwd(),
    },
  );
});

test("verifyPhase1Evaluation passes when Go/No-Go thresholds are met", () => {
  const verification = verifyPhase1Evaluation(validPhase1Summary());

  assert.equal(verification.pass, true);
  assert.deepEqual(verification.failedCriteria, []);
});

test("verifyPhase1Evaluation enforces locked Go/No-Go thresholds instead of trusting summary thresholds", () => {
  const verification = verifyPhase1Evaluation(
    validPhase1Summary({
      thresholds: {
        autoTrashPrecisionMin: 0,
        keptAutoTrashRateMax: 1,
        reviewReductionMin: 0,
        highRiskPrecisionMin: 0,
      },
      holdoutMetrics: {
        ...validPhase1Summary().holdoutMetrics,
        autoTrashPrecision: 0.5,
        keptAutoTrashRate: 0.5,
        reviewReduction: 0.1,
      },
      highRiskSectionMetrics: PHASE1_HIGH_RISK_SECTION_NAMES.map((canonicalSectionName) => ({
        ...validPhase1Summary().highRiskSectionMetrics[0],
        key: canonicalSectionName,
        label: canonicalSectionName,
        predictedAutoTrash: 10,
        autoTrashPrecision: 0.5,
      })),
    }),
  );

  assert.equal(verification.pass, false);
  assert.ok(verification.failedCriteria.includes("auto_trash_precision_min_0_95"));
  assert.ok(verification.failedCriteria.includes("kept_auto_trash_rate_max_0_05"));
  assert.ok(verification.failedCriteria.includes("review_reduction_min_0_50"));
  assert.ok(verification.failedCriteria.includes("high_risk_precision_min_0_90"));
});

test("verifyPhase1Evaluation requires phase, read-only DB, coverage, and manual-exclusion reconciliation", () => {
  const verification = verifyPhase1Evaluation({
    ...validPhase1Summary(),
    phase: 0,
    dbMutated: true,
    labeledImages: 103,
    mainImages: 100,
    manualExcludedImages: 1,
    predictionCoverage: {
      expected: 999,
      provided: 100,
      usable: 98,
      missing: 1,
      invalid: 1,
      duplicate: 1,
      unknown: 1,
      autoTrashWithoutReasons: 0,
    },
    missingPredictionImageIds: [],
    unknownPredictionImageIds: [],
    duplicatePredictionImageIds: [],
    invalidPredictions: [],
  });

  assert.equal(verification.pass, false);
  assert.ok(verification.failedCriteria.includes("phase_1_required"));
  assert.ok(verification.failedCriteria.includes("db_mutated_false_required"));
  assert.ok(verification.failedCriteria.includes("prediction_coverage_reconciles_labeled_images"));
  assert.ok(verification.failedCriteria.includes("prediction_issue_lists_match_counts"));
  assert.ok(verification.failedCriteria.includes("manual_exclusions_reconcile_labeled_images"));
});

test("verifyPhase1Evaluation rejects impossible prediction coverage totals", () => {
  const verification = verifyPhase1Evaluation(
    validPhase1Summary({
      predictionCoverage: {
        expected: 102,
        provided: 999,
        usable: 200,
        missing: 0,
        invalid: 0,
        duplicate: 0,
        unknown: 0,
        autoTrashWithoutReasons: 0,
      },
    }),
  );

  assert.equal(verification.pass, false);
  assert.ok(verification.failedCriteria.includes("prediction_coverage_reconciles_labeled_images"));
});

test("verifyPhase1Evaluation rejects forged manual-exclusion appendix and main metric counts", () => {
  const summary = validPhase1Summary();
  const verification = verifyPhase1Evaluation({
    ...summary,
    mainMetrics: {
      ...summary.mainMetrics,
      totalImages: 102,
    },
    appendix: {
      manualExcluded: {
        ...summary.appendix.manualExcluded,
        totalImages: 0,
      },
      manualExcludedImageIds: [],
    },
  });

  assert.equal(verification.pass, false);
  assert.ok(verification.failedCriteria.includes("manual_exclusions_excluded_from_main_metrics"));
  assert.ok(verification.failedCriteria.includes("manual_exclusions_reconcile_labeled_images"));
});

test("verifyPhase1Evaluation fails on threshold, completeness, reason, high-risk, manual-exclusion, and split violations", () => {
  const verification = verifyPhase1Evaluation(
    validPhase1Summary({
      splitMode: "hash",
      manualExclusionsExcludedFromMainMetrics: false,
      predictionCoverage: {
        expected: 100,
        provided: 99,
        usable: 98,
        missing: 1,
        invalid: 1,
        duplicate: 0,
        unknown: 0,
        autoTrashWithoutReasons: 1,
      },
      holdoutMetrics: {
        ...validPhase1Summary().holdoutMetrics,
        autoTrashPrecision: 0.94,
        keptAutoTrashRate: 0.06,
        reviewReduction: 0.49,
      },
      highRiskSectionMetrics: [
        {
          ...validPhase1Summary().highRiskSectionMetrics[0],
          predictedAutoTrash: 10,
          autoTrashPrecision: 0.89,
        },
      ],
    }),
  );

  assert.equal(verification.pass, false);
  assert.deepEqual(verification.failedCriteria, [
    "auto_trash_precision_min_0_95",
    "kept_auto_trash_rate_max_0_05",
    "review_reduction_min_0_50",
    "auto_trash_reasons_required",
    "predictions_complete",
    "prediction_coverage_reconciles_labeled_images",
    "prediction_issue_lists_match_counts",
    "high_risk_precision_min_0_90",
    "manual_exclusions_excluded_from_main_metrics",
    "leave_one_project_out_required",
  ]);
});

test("verify CLI helpers support --phase 1 --summary", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "phase1-verify-cli-"));
  try {
    const summaryPath = path.join(outputDir, "phase1-summary.json");
    await writeFile(summaryPath, JSON.stringify(validPhase1Summary(), null, 2), "utf8");

    assert.deepEqual(parseVerifyArgs(["--phase", "1", "--summary", summaryPath]), {
      phase: 1,
      summaryPath,
      outDir: undefined,
    });

    const phase1Result = await verifyPhase1EvaluationSummaryFile(summaryPath, { phase: 1 });
    assert.equal(phase1Result.pass, true);

    const genericResult = await verifyQualitySummaryFile(summaryPath, { phase: 1 });
    assert.equal(genericResult.phase, 1);
    assert.equal(genericResult.pass, true);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
