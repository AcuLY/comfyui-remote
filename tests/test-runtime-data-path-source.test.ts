import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const DATA_PATH_CONSUMERS = [
  "src/lib/actions/section.ts",
  "src/server/services/censoring-service.ts",
  "src/server/services/image-file-service.ts",
  "src/server/services/image-result-service.ts",
  "src/server/services/project-archive-service.ts",
  "src/server/services/project-deletion-service.ts",
  "src/server/services/project-export-service.ts",
  "src/server/services/project-file-cleanup-service.ts",
  "src/server/services/run-executor.ts",
  "src/server/services/section-cleanup-service.ts",
];

test("runtime data paths are isolated from Turbopack file tracing", () => {
  const helper = readFileSync("src/server/services/runtime-data-path.ts", "utf8");
  assert.match(
    helper,
    /resolve\(\s*\/\*\s*turbopackIgnore:\s*true\s*\*\/\s*process\.cwd\(\),/,
    "runtime data path helper should mark project-root resolution as Turbopack-ignored",
  );

  for (const file of DATA_PATH_CONSUMERS) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /resolve\(\s*process\.cwd\(\)\s*,\s*["']data["']/,
      `${file} should use runtime-data-path helpers instead of direct process.cwd()/data resolution`,
    );
  }
});

test("Next output tracing excludes runtime data directories for all routes", () => {
  const config = readFileSync("next.config.ts", "utf8");

  assert.match(config, /outputFileTracingExcludes:\s*{/);
  assert.match(config, /const runtimeTraceExcludes = \[[\s\S]*["']\.\/data\/\*\*\/\*["']/);
  assert.match(config, /["']\/\*["']:\s*runtimeTraceExcludes/);
  assert.match(config, /["']\/\*\*\/\*["']:\s*runtimeTraceExcludes/);
});
