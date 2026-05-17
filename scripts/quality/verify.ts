#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getDefaultPhase0SummaryPath,
  verifyPhase0Baseline,
  type Phase0VerificationResult,
} from "../../src/server/quality/phase0-baseline";

export interface VerifyCliArgs {
  phase: 0;
  summaryPath?: string;
  outDir?: string;
}

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
  if (phase !== 0) {
    throw new Error(`Unsupported quality verification phase: ${phase}`);
  }

  return { phase: 0, summaryPath, outDir };
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

export async function runPhase0VerifyCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseVerifyArgs(argv);
  const summaryPath = path.resolve(
    args.summaryPath ??
      (args.outDir
        ? path.join(args.outDir, "valid-projects-trash-rate-summary.json")
        : getDefaultPhase0SummaryPath(process.cwd())),
  );
  const verification = await verifyPhase0BaselineSummaryFile(summaryPath, { phase: args.phase });
  console.log(JSON.stringify(verification, null, 2));
  return verification.pass ? 0 : 1;
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
  runPhase0VerifyCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
