#!/usr/bin/env tsx
import { pathToFileURL } from "node:url";
import path from "node:path";

import {
  createPhase0BaselineFromSqlite,
  getDefaultPhase0OutputDir,
  verifyPhase0Baseline,
  writePhase0BaselineReports,
  type Phase0ReportPaths,
  type Phase0VerificationResult,
} from "../../src/server/quality/phase0-baseline";

export interface BaselineCliArgs {
  dbPath?: string;
  outDir: string;
  exclusionPath?: string;
  projectRoot: string;
}

export interface BaselineCliResult {
  phase: 0;
  pass: boolean;
  summaryJson: string;
  validProjects: number;
  labeledImages: number;
  canonicalSections: number;
  failedCriteria: string[];
}

export function parseBaselineArgs(argv: readonly string[]): BaselineCliArgs {
  let projectRoot = process.cwd();
  let dbPath: string | undefined;
  let outDir: string | undefined;
  let exclusionPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db") {
      dbPath = requireValue(argv, (index += 1), "--db");
    } else if (arg.startsWith("--db=")) {
      dbPath = arg.slice("--db=".length);
    } else if (arg === "--out") {
      outDir = requireValue(argv, (index += 1), "--out");
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length);
    } else if (arg === "--exclusions") {
      exclusionPath = requireValue(argv, (index += 1), "--exclusions");
    } else if (arg.startsWith("--exclusions=")) {
      exclusionPath = arg.slice("--exclusions=".length);
    } else if (arg === "--project-root") {
      projectRoot = path.resolve(requireValue(argv, (index += 1), "--project-root"));
    } else if (arg.startsWith("--project-root=")) {
      projectRoot = path.resolve(arg.slice("--project-root=".length));
    } else {
      throw new Error(`Unknown quality baseline argument: ${arg}`);
    }
  }

  return { dbPath, outDir: outDir ?? getDefaultPhase0OutputDir(projectRoot), exclusionPath, projectRoot };
}

export function buildBaselineCliResult(
  reportPaths: Phase0ReportPaths,
  verification: Phase0VerificationResult,
): BaselineCliResult {
  return {
    phase: 0,
    pass: verification.pass,
    summaryJson: reportPaths.summaryJson,
    validProjects: verification.validProjects,
    labeledImages: verification.labeledImages,
    canonicalSections: verification.canonicalSections,
    failedCriteria: verification.failedCriteria,
  };
}

export async function runPhase0BaselineCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseBaselineArgs(argv);
  const projectRoot = args.projectRoot;
  const outDir = path.resolve(projectRoot, args.outDir);
  const baseline = await createPhase0BaselineFromSqlite({
    projectRoot,
    dbPath: args.dbPath,
    exclusionPath: args.exclusionPath,
  });
  const reportPaths = await writePhase0BaselineReports(baseline, { outputDir: outDir });
  const verification = verifyPhase0Baseline(baseline.summary);
  const result = buildBaselineCliResult(reportPaths, verification);

  console.log(JSON.stringify(result, null, 2));

  return verification.pass ? 0 : 1;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPhase0BaselineCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
