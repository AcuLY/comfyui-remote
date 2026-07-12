import type { CheckResult, Diagnostic } from "./model";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((left, right) =>
    compareText(left.path, right.path)
      || left.location.line - right.location.line
      || left.location.column - right.location.column
      || compareText(left.ruleId, right.ruleId)
      || compareText(left.severity, right.severity)
      || compareText(left.evidence, right.evidence),
  );
}

export function renderHumanResult(result: CheckResult): string {
  const lines = result.diagnostics.flatMap((diagnostic) => [
    `${diagnostic.severity.toUpperCase()} ${diagnostic.ruleId} ${diagnostic.path}:${diagnostic.location.line}:${diagnostic.location.column}`,
    `  evidence: ${diagnostic.evidence}`,
    `  owner: ${diagnostic.owner}`,
    `  remediation: ${diagnostic.remediation}`,
  ]);
  lines.push(
    `docs:check requested=${result.requestedMode} effective=${result.effectiveMode} errors=${result.summary.errors} warnings=${result.summary.warnings}`,
  );
  if (result.escalationReasons.length > 0) {
    lines.push(`escalation: ${result.escalationReasons.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function toolFailureResult(
  options: { mode: "full" | "fast"; base?: string },
  error: unknown,
): CheckResult {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostics = sortDiagnostics([
    {
      ruleId: "tool/configuration",
      severity: "error",
      path: "docs/_meta/policy.yaml",
      location: { line: 1, column: 1 },
      evidence: message,
      remediation: "Repair the checker configuration or tool environment, then rerun npm run docs:check.",
      owner: "documentation-governance",
    },
  ]);
  return {
    schemaVersion: 1,
    requestedMode: options.mode,
    effectiveMode: "full",
    base: options.base ?? null,
    escalationReasons: [],
    diagnostics,
    summary: { errors: 1, warnings: 0 },
    exitCode: 2,
  };
}
