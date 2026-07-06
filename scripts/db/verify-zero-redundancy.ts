#!/usr/bin/env tsx
import { pathToFileURL } from "node:url";

import { diffResolvedSectionConfig, type ResolvedSectionConfigDiff } from "../../src/server/prompt-config/diff";
import {
  buildZeroRedundancyMigrationPlan,
  readZeroRedundancyMigrationRowsFromDb,
  type ZeroRedundancyMigrationFormat,
  type ZeroRedundancyMigrationSummary,
  type ZeroRedundancyVerificationPair,
} from "./migrate-zero-redundancy";

export interface ZeroRedundancyVerifyArgs {
  readOnly: boolean;
  format: ZeroRedundancyMigrationFormat;
  allowMismatch: boolean;
}

export interface ZeroRedundancyVerificationComparison extends ZeroRedundancyVerificationPair {
  diffs: ResolvedSectionConfigDiff[];
}

export const ZERO_REDUNDANCY_VERIFICATION_EXIT_CODES = {
  ok: 0,
  invalidJson: 2,
  invalidReference: 4,
  resolverMismatch: 8,
} as const;

export type ZeroRedundancyVerificationFailureClass =
  | "invalid_json"
  | "invalid_reference"
  | "resolver_mismatch";

export interface ZeroRedundancyVerificationReport {
  readOnly: true;
  allowMismatch: boolean;
  summary: {
    totalComparisons: number;
    mismatchCount: number;
    diffCount: number;
    invalidJsonRowCount: number;
    invalidReferenceCount: number;
  };
  comparisons: ZeroRedundancyVerificationComparison[];
  failureClasses: ZeroRedundancyVerificationFailureClass[];
  exitCode: number;
}

type VerificationInput = ZeroRedundancyVerificationPair | ZeroRedundancyVerificationComparison;
type VerificationIssueCounts = Pick<
  ZeroRedundancyMigrationSummary,
  "invalidJsonRowCount" | "invalidReferenceCount"
>;

export function parseZeroRedundancyVerifyArgs(
  argv: readonly string[],
): ZeroRedundancyVerifyArgs {
  let readOnly = false;
  let format: ZeroRedundancyMigrationFormat = "summary";
  let allowMismatch = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--read-only") {
      readOnly = true;
    } else if (arg === "--allow-mismatch") {
      allowMismatch = true;
    } else if (arg === "--format") {
      format = parseFormat(requireValue(argv, (index += 1), "--format"));
    } else if (arg.startsWith("--format=")) {
      format = parseFormat(arg.slice("--format=".length));
    } else {
      throw new Error(`Unknown zero redundancy verifier argument: ${arg}`);
    }
  }

  return { readOnly, format, allowMismatch };
}

export function collectZeroRedundancyVerification(
  pairs: readonly VerificationInput[],
  options: { allowMismatch?: boolean } & Partial<VerificationIssueCounts> = {},
): ZeroRedundancyVerificationReport {
  const comparisons = pairs.map((pair) => {
    const diffs = "diffs" in pair
      ? pair.diffs
      : diffResolvedSectionConfig(pair.legacy, pair.resolved);
    return { ...pair, diffs };
  });
  const mismatchCount = comparisons.filter((comparison) => comparison.diffs.length > 0).length;
  const diffCount = comparisons.reduce((total, comparison) => total + comparison.diffs.length, 0);
  const allowMismatch = options.allowMismatch === true;
  const invalidJsonRowCount = options.invalidJsonRowCount ?? 0;
  const invalidReferenceCount = options.invalidReferenceCount ?? 0;
  const failureClasses: ZeroRedundancyVerificationFailureClass[] = [];
  let exitCode = ZERO_REDUNDANCY_VERIFICATION_EXIT_CODES.ok;

  if (invalidJsonRowCount > 0) {
    failureClasses.push("invalid_json");
    exitCode |= ZERO_REDUNDANCY_VERIFICATION_EXIT_CODES.invalidJson;
  }
  if (invalidReferenceCount > 0) {
    failureClasses.push("invalid_reference");
    exitCode |= ZERO_REDUNDANCY_VERIFICATION_EXIT_CODES.invalidReference;
  }
  if (mismatchCount > 0 && !allowMismatch) {
    failureClasses.push("resolver_mismatch");
    exitCode |= ZERO_REDUNDANCY_VERIFICATION_EXIT_CODES.resolverMismatch;
  }

  return {
    readOnly: true,
    allowMismatch,
    summary: {
      totalComparisons: comparisons.length,
      mismatchCount,
      diffCount,
      invalidJsonRowCount,
      invalidReferenceCount,
    },
    comparisons,
    failureClasses,
    exitCode,
  };
}

export function formatZeroRedundancyVerification(
  report: ZeroRedundancyVerificationReport,
  format: ZeroRedundancyMigrationFormat,
): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  const lines = [
    "Zero Redundancy Verification",
    `read only: ${report.readOnly}`,
    `comparisons: ${report.summary.totalComparisons}`,
    `mismatches: ${report.summary.mismatchCount}`,
    `diffs: ${report.summary.diffCount}`,
    `invalid JSON rows: ${report.summary.invalidJsonRowCount}`,
    `invalid references: ${report.summary.invalidReferenceCount}`,
    `failure classes: ${report.failureClasses.length > 0 ? report.failureClasses.join(", ") : "none"}`,
    `allow mismatch: ${report.allowMismatch}`,
  ];

  for (const comparison of report.comparisons.filter((item) => item.diffs.length > 0).slice(0, 10)) {
    lines.push(`- ${comparison.kind}:${comparison.id}`);
    for (const diff of comparison.diffs.slice(0, 5)) {
      lines.push(`  ${diff.category} ${diff.path}: ${diff.message}`);
    }
  }

  return lines.join("\n");
}

export async function runZeroRedundancyVerificationCli(
  argv = process.argv.slice(2),
): Promise<number> {
  const args = parseZeroRedundancyVerifyArgs(argv);
  const rows = await readZeroRedundancyMigrationRowsFromDb();
  const plan = buildZeroRedundancyMigrationPlan(rows, { verificationSource: "existing" });
  const report = collectZeroRedundancyVerification(plan.verificationPairs, {
    allowMismatch: args.allowMismatch,
    invalidJsonRowCount: plan.summary.invalidJsonRowCount,
    invalidReferenceCount: plan.summary.invalidReferenceCount,
  });

  console.log(formatZeroRedundancyVerification(report, args.format));
  return report.exitCode;
}

function parseFormat(value: string): ZeroRedundancyMigrationFormat {
  if (value === "summary" || value === "json") return value;
  throw new Error(`Unsupported --format value: ${value}`);
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runZeroRedundancyVerificationCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
