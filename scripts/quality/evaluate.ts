#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  computePhase1OfflineEvaluation,
  getDefaultPhase1LabeledImagesPath,
  getDefaultPhase1OutputDir,
  getDefaultPhase1PredictionsPath,
  parsePhase1PredictionsText,
  readPhase0LabeledImagesCsv,
  verifyPhase1Evaluation,
  writePhase1EvaluationReports,
  type Phase1EvaluationSummary,
  type Phase1PredictionCoverage,
  type Phase1ReportPaths,
  type Phase1SplitMode,
  type Phase1VerificationResult,
} from "../../src/server/quality/phase1-offline-eval";

export interface EvaluateCliArgs {
  phase: 1;
  splitMode: Phase1SplitMode;
  labeledPath?: string;
  predictionsPath?: string;
  outDir?: string;
  projectRoot: string;
}

export interface EvaluateCliResult {
  phase: 1;
  pass: boolean;
  splitMode: Phase1SplitMode;
  summaryJson: string;
  labeledImages: number;
  mainImages: number;
  manualExcludedImages: number;
  predictionCoverage: Phase1PredictionCoverage;
  failedCriteria: string[];
}

export function parseEvaluateArgs(argv: readonly string[]): EvaluateCliArgs {
  let phase: number | undefined;
  let splitMode: Phase1SplitMode = "leave-one-project-out";
  let labeledPath: string | undefined;
  let predictionsPath: string | undefined;
  let outDir: string | undefined;
  let projectRoot = process.cwd();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--phase") {
      phase = parsePhase(requireValue(argv, (index += 1), "--phase"));
    } else if (arg.startsWith("--phase=")) {
      phase = parsePhase(arg.slice("--phase=".length));
    } else if (arg === "--split") {
      splitMode = parseSplitMode(requireValue(argv, (index += 1), "--split"));
    } else if (arg.startsWith("--split=")) {
      splitMode = parseSplitMode(arg.slice("--split=".length));
    } else if (arg === "--labeled") {
      labeledPath = requireValue(argv, (index += 1), "--labeled");
    } else if (arg.startsWith("--labeled=")) {
      labeledPath = arg.slice("--labeled=".length);
    } else if (arg === "--predictions") {
      predictionsPath = requireValue(argv, (index += 1), "--predictions");
    } else if (arg.startsWith("--predictions=")) {
      predictionsPath = arg.slice("--predictions=".length);
    } else if (arg === "--out") {
      outDir = requireValue(argv, (index += 1), "--out");
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length);
    } else if (arg === "--project-root") {
      projectRoot = path.resolve(requireValue(argv, (index += 1), "--project-root"));
    } else if (arg.startsWith("--project-root=")) {
      projectRoot = path.resolve(arg.slice("--project-root=".length));
    } else {
      throw new Error(`Unknown quality evaluate argument: ${arg}`);
    }
  }

  if (phase === undefined) phase = 1;
  if (phase !== 1) {
    throw new Error(`Unsupported quality evaluate phase: ${phase}`);
  }

  return {
    phase: 1,
    splitMode,
    labeledPath,
    predictionsPath,
    outDir,
    projectRoot,
  };
}

export function buildEvaluateCliResult(
  args: Pick<EvaluateCliArgs, "splitMode">,
  reportPaths: Phase1ReportPaths,
  summary: Phase1EvaluationSummary,
  verification: Phase1VerificationResult,
): EvaluateCliResult {
  return {
    phase: 1,
    pass: verification.pass,
    splitMode: args.splitMode,
    summaryJson: reportPaths.summaryJson,
    labeledImages: summary.labeledImages,
    mainImages: summary.mainImages,
    manualExcludedImages: summary.manualExcludedImages,
    predictionCoverage: summary.predictionCoverage,
    failedCriteria: verification.failedCriteria,
  };
}

export async function runPhase1EvaluateCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseEvaluateArgs(argv);
  const projectRoot = args.projectRoot;
  const labeledPath = path.resolve(
    projectRoot,
    args.labeledPath ?? getDefaultPhase1LabeledImagesPath(projectRoot),
  );
  const predictionsPath = path.resolve(
    projectRoot,
    args.predictionsPath ?? getDefaultPhase1PredictionsPath(projectRoot),
  );
  const outputDir = path.resolve(projectRoot, args.outDir ?? getDefaultPhase1OutputDir(projectRoot));

  const [labeledRows, predictionsText] = await Promise.all([
    readPhase0LabeledImagesCsv(labeledPath),
    readPredictionsText(predictionsPath),
  ]);
  const predictions = parsePhase1PredictionsText(predictionsText);
  const evaluation = computePhase1OfflineEvaluation(labeledRows, predictions, {
    splitMode: args.splitMode,
  });
  const reportPaths = await writePhase1EvaluationReports(evaluation, { outputDir });
  const verification = verifyPhase1Evaluation(evaluation.summary);
  const result = buildEvaluateCliResult(args, reportPaths, evaluation.summary, verification);

  console.log(JSON.stringify(result, null, 2));

  return verification.pass ? 0 : 1;
}

async function readPredictionsText(predictionsPath: string): Promise<string> {
  try {
    return await readFile(predictionsPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(
        `Phase 1 predictions file not found: ${predictionsPath}. Provide --predictions <path>; the offline evaluator does not fabricate predictions.`,
      );
    }
    throw error;
  }
}

function parsePhase(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Unsupported quality evaluate phase: ${value}`);
  }
  return parsed;
}

function parseSplitMode(value: string): Phase1SplitMode {
  if (value === "leave-one-project-out" || value === "hash") return value;
  throw new Error(`Unsupported Phase 1 split mode: ${value}`);
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPhase1EvaluateCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
