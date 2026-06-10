import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("run actions defer ComfyUI submission failures instead of deleting queued runs", () => {
  const actionSource = readSource("src/lib/actions/run-execution.ts");
  const serviceSource = readSource("src/server/services/project-service.ts");
  const executorSource = readSource("src/server/services/run-executor.ts");

  assert.match(
    executorSource,
    /export async function trySubmitQueuedRunToComfyUI/,
    "run-executor should expose a shared resilient submission helper",
  );
  assert.match(
    executorSource,
    /catch \(error\)[\s\S]*status: "deferred"/,
    "submission helper should return a deferred outcome when ComfyUI is unavailable",
  );
  assert.match(
    executorSource,
    /comfyPromptId:\s*null/,
    "recovery should pick up queued runs that have not reached ComfyUI yet",
  );
  assert.match(
    actionSource,
    /trySubmitQueuedRunToComfyUI\(enqueuedRun\.runId/,
    "server actions should use the shared submission helper",
  );
  assert.match(
    serviceSource,
    /trySubmitQueuedRunToComfyUI\(enqueuedRun\.runId/,
    "API and agent services should use the shared submission helper",
  );
  assert.doesNotMatch(
    actionSource,
    /run\.delete/,
    "server actions must not delete the queued run when ComfyUI submission fails",
  );
  assert.doesNotMatch(
    serviceSource,
    /run\.delete/,
    "API and agent services must not delete the queued run when ComfyUI submission fails",
  );
});

test("enqueue allows additional runs when a project or section already has active runs", () => {
  const source = readSource("src/server/repositories/project-repository/enqueue.ts");

  assert.doesNotMatch(
    source,
    /PROJECT_HAS_ACTIVE_RUNS/,
    "project-level enqueue should not reject additional runs while existing runs are queued or running",
  );
  assert.doesNotMatch(
    source,
    /SECTION_HAS_ACTIVE_RUN/,
    "section-level enqueue should not reject another run for the same active section",
  );
  assert.doesNotMatch(
    source,
    /active(?:Section)?RunCount/,
    "enqueue should not count active runs as a precondition for creating another run",
  );
});
