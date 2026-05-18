#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getDefaultPhase0SummaryPath,
  verifyPhase0Baseline,
  type Phase0VerificationResult,
} from "../../src/server/quality/phase0-baseline";
import {
  getDefaultPhase1SummaryPath,
  verifyPhase1Evaluation,
  type Phase1VerificationResult,
} from "../../src/server/quality/phase1-offline-eval";

export interface VerifyCliArgs {
  phase: 0 | 1;
  summaryPath?: string;
  outDir?: string;
}

export type QualityVerificationResult = Phase0VerificationResult | Phase1VerificationResult;

export function parseVerifyArgs(argv: readonly string[]): VerifyCliArgs {
  let phase: number | undefined;
  let summaryPath: string | undefined;
  let outDir: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--phase") {
      phase = parsePhase(requireValue(argv, (index += 1), "--phase"));
    } else if (arg.startsWith("--phase=")) {
      phase = parsePhase(arg.slice("--phase=".length));
    } else if (arg === "--summary") {
      summaryPath = requireValue(argv, (index += 1), "--summary");
    } else if (arg.startsWith("--summary=")) {
      summaryPath = arg.slice("--summary=".length);
    } else if (arg === "--out") {
      outDir = requireValue(argv, (index += 1), "--out");
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length);
    } else {
      throw new Error(`Unknown quality verification argument: ${arg}`);
    }
  }

  if (phase === undefined) phase = 0;
  if (phase !== 0 && phase !== 1) {
    throw new Error(`Unsupported quality verification phase: ${phase}`);
  }

  return { phase, summaryPath, outDir };
}

export async function verifyPhase0BaselineSummaryFile(
  summaryPath: string,
  options: { phase: 0 },
): Promise<Phase0VerificationResult> {
  if (options.phase !== 0) {
    throw new Error(`Unsupported quality verification phase: ${options.phase}`);
  }
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Record<string, unknown>;
  return verifyPhase0Baseline(summary);
}

export async function verifyPhase1EvaluationSummaryFile(
  summaryPath: string,
  options: { phase: 1 },
): Promise<Phase1VerificationResult> {
  if (options.phase !== 1) {
    throw new Error(`Unsupported quality verification phase: ${options.phase}`);
  }
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Record<string, unknown>;
  return verifyPhase1Evaluation(summary);
}

export async function verifyQualitySummaryFile(
  summaryPath: string,
  options: { phase: 0 | 1 },
): Promise<QualityVerificationResult> {
  if (options.phase === 0) {
    return verifyPhase0BaselineSummaryFile(summaryPath, { phase: 0 });
  }
  return verifyPhase1EvaluationSummaryFile(summaryPath, { phase: 1 });
}

export async function runQualityVerifyCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseVerifyArgs(argv);
  const summaryPath = path.resolve(resolveSummaryPath(args));
  const verification = await verifyQualitySummaryFile(summaryPath, { phase: args.phase });
  console.log(JSON.stringify(verification, null, 2));
  return verification.pass ? 0 : 1;
}

export async function runPhase0VerifyCli(argv = process.argv.slice(2)): Promise<number> {
  return runQualityVerifyCli(argv);
}

function resolveSummaryPath(args: VerifyCliArgs): string {
  if (args.summaryPath) return args.summaryPath;

  if (args.outDir) {
    return path.join(
      args.outDir,
      args.phase === 0
        ? "valid-projects-trash-rate-summary.json"
        : "phase1-offline-evaluation-summary.json",
    );
  }

  return args.phase === 0
    ? getDefaultPhase0SummaryPath(process.cwd())
    : getDefaultPhase1SummaryPath(process.cwd());
}

function parsePhase(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Unsupported quality verification phase: ${value}`);
  }
  return parsed;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runQualityVerifyCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
