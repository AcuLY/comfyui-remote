import { resolve } from "node:path";

import { sortDiagnostics, renderHumanResult, toolFailureResult } from "./check/diagnostics";
import { runDocsCheck } from "./check/engine";
import { captureWorktreeSnapshot, repositoryRoot } from "./check/git";
import type { CheckMode, CheckOptions, CheckResult, OutputFormat } from "./check/model";

function valueAfter(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseDocsCheckArgs(args: string[]): CheckOptions {
  let root = process.cwd();
  let mode: CheckMode = "full";
  let format: OutputFormat = "human";
  let base: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      root = valueAfter(args, index, arg);
      index += 1;
    } else if (arg === "--mode") {
      const value = valueAfter(args, index, arg);
      if (value !== "full" && value !== "fast") throw new Error("--mode must be full or fast.");
      mode = value;
      index += 1;
    } else if (arg === "--full") {
      mode = "full";
    } else if (arg === "--fast") {
      mode = "fast";
    } else if (arg === "--format") {
      const value = valueAfter(args, index, arg);
      if (value !== "human" && value !== "json") throw new Error("--format must be human or json.");
      format = value;
      index += 1;
    } else if (arg === "--json") {
      format = "json";
    } else if (arg === "--base") {
      base = valueAfter(args, index, arg);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write([
        "Usage: npm run docs:check -- [--mode full|fast] [--base REV] [--format human|json]",
        "",
        "Full mode is the safe default. Fast mode escalates whenever impact cannot be bounded.",
        "",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown docs:check argument: ${arg}`);
    }
  }
  return { root: resolve(root), mode, format, base, runAdapters: true };
}

function appendWriteFailure(result: CheckResult): CheckResult {
  const diagnostics = sortDiagnostics([
    ...result.diagnostics,
    {
      ruleId: "tool/non-writing-contract",
      severity: "error" as const,
      path: "docs/_meta/policy.yaml",
      location: { line: 1, column: 1 },
      evidence: "docs:check changed tracked, staged, or pre-existing untracked repository content.",
      remediation: "Repair the checker or adapter so check mode performs no repository writes.",
      owner: "documentation-governance",
    },
  ]);
  return {
    ...result,
    diagnostics,
    summary: {
      errors: diagnostics.filter(({ severity }) => severity === "error").length,
      warnings: diagnostics.filter(({ severity }) => severity === "warning").length,
    },
    exitCode: 2,
  };
}

async function main(): Promise<void> {
  let parsed: CheckOptions;
  try {
    parsed = parseDocsCheckArgs(process.argv.slice(2));
  } catch (error) {
    const fallback = toolFailureResult({ mode: "full" }, error);
    process.stdout.write(`${JSON.stringify(fallback, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  let root = parsed.root;
  let before: string | null = null;
  let result: CheckResult;
  try {
    root = repositoryRoot(root);
    parsed = { ...parsed, root };
    before = await captureWorktreeSnapshot(root);
    result = await runDocsCheck(parsed);
  } catch (error) {
    result = toolFailureResult(parsed, error);
  }

  if (before !== null) {
    try {
      const after = await captureWorktreeSnapshot(root);
      if (before !== after) result = appendWriteFailure(result);
    } catch (error) {
      result = toolFailureResult(parsed, error);
    }
  }

  process.stdout.write(parsed.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderHumanResult(result));
  process.exitCode = result.exitCode;
}

void main();
