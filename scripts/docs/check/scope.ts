import type { CheckMode, GitChange } from "./model";

const UNSAFE_PREFIXES = [
  "docs/_meta/",
  "openspec/",
  ".codex/skills/",
  ".codebuddy/skills/",
  "scripts/docs/",
  "scripts/skills/",
  "tests/fixtures/documentation-governance/",
];
const UNSAFE_EXACT = new Set([
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "PRODUCT.md",
  "DESIGN.md",
  "CLAUDE.md",
  "package.json",
  "package-lock.json",
  "tests/test-documentation-governance.test.ts",
  "tests/test-config-runtime-governance.test.ts",
]);

export function resolveEffectiveMode(input: {
  requestedMode: CheckMode;
  baseAvailable: boolean;
  changes: GitChange[];
}): { mode: CheckMode; reasons: string[] } {
  if (input.requestedMode === "full") {
    return { mode: "full", reasons: [] };
  }
  const reasons: string[] = [];
  if (!input.baseAvailable) {
    reasons.push("merge-base-unavailable");
  }
  for (const change of input.changes) {
    if (!/^[AM]$/.test(change.status)) {
      reasons.push(`unsafe-${change.status[0].toLowerCase()}:${change.path}`);
    }
    for (const path of [change.oldPath, change.path].filter((value): value is string => Boolean(value))) {
      if (
        UNSAFE_EXACT.has(path)
        || path.endsWith("/README.md")
        || /^tests\/test-docs-check-.*\.test\.ts$/.test(path)
        || path === "tests/test-skills-check.test.ts"
        || UNSAFE_PREFIXES.some((prefix) => path.startsWith(prefix))
      ) {
        reasons.push(`authority-or-tooling-change:${path}`);
      }
    }
  }
  return { mode: reasons.length > 0 ? "full" : "fast", reasons: [...new Set(reasons)].sort() };
}
