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
  const comfyServiceSource = readSource("src/server/services/comfyui-service.ts");

  assert.match(
    comfyServiceSource,
    /export async function checkComfyUIReachability/,
    "ComfyUI service should expose a reusable reachability check",
  );
  assert.match(
    executorSource,
    /export async function submitQueuedRunsToComfyUIWithHealthCheck/,
    "run-executor should expose a batch helper that checks ComfyUI once before submitting queued runs",
  );
  assert.match(
    executorSource,
    /function scheduleDeferredQueuedRunSubmissionRecovery/,
    "deferred batches should schedule automatic recovery when ComfyUI becomes reachable",
  );
  assert.match(
    executorSource,
    /scheduleDeferredQueuedRunSubmissionRecovery\(runs\.map\(\(run\) => run\.runId\)\)/,
    "unreachable precheck should schedule the affected queued runs for later submission",
  );
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
    /scheduleQueuedRunsToComfyUI\(/,
    "server actions should use the non-blocking submission scheduler",
  );
  assert.match(
    serviceSource,
    /scheduleQueuedRunsToComfyUI\(/,
    "API and agent services should use the non-blocking submission scheduler",
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

test("run actions schedule ComfyUI submission without awaiting reachability", () => {
  const actionSource = readSource("src/lib/actions/run-execution.ts");
  const serviceSource = readSource("src/server/services/project-service.ts");
  const executorSource = readSource("src/server/services/run-executor.ts");

  assert.match(
    executorSource,
    /export function scheduleQueuedRunsToComfyUI/,
    "run-executor should expose a non-blocking scheduler for user-facing run creation",
  );
  assert.match(
    executorSource,
    /void submitQueuedRunsToComfyUIWithHealthCheck\(runs,\s*optionsForRun\)/,
    "the scheduler should run ComfyUI reachability and submission outside the request lifecycle",
  );

  for (const [name, source] of [
    ["server actions", actionSource],
    ["API and agent services", serviceSource],
  ] as const) {
    assert.match(
      source,
      /scheduleQueuedRunsToComfyUI\(/,
      `${name} should schedule ComfyUI submission after local enqueue`,
    );
    assert.doesNotMatch(
      source,
      /await submitQueuedRunsInBackground/,
      `${name} should not block run creation on ComfyUI reachability checks`,
    );
  }
});

test("batch run actions and toasts report ComfyUI outage once", () => {
  const actionSource = readSource("src/lib/actions/run-execution.ts");
  const sectionCardsSource = readSource("src/app/projects/[projectId]/section-cards.tsx");
  const projectActionsSource = readSource("src/app/projects/[projectId]/project-detail-actions.tsx");
  const projectSidebarSource = readSource("src/app/projects/[projectId]/app-sidebar.tsx");
  const resultsGridSource = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");
  const queuePageSource = readSource("src/app/queue/queue-page-client.tsx");
  const toastSource = readSource("src/lib/run-submission-toast.ts");

  assert.match(
    actionSource,
    /export async function runSections/,
    "selected-section batch run should use one server action so ComfyUI is checked once for the whole batch",
  );
  assert.doesNotMatch(
    sectionCardsSource,
    /for \(const sectionId of idsToRun\)[\s\S]*runSection\(sectionId/,
    "selected-section batch run should not call runSection once per selected section",
  );
  assert.match(
    sectionCardsSource,
    /runSections\(idsToRun,\s*overrideBatchSize\)/,
    "selected-section batch run should call the batch action",
  );

  for (const [name, source] of [
    ["section cards", sectionCardsSource],
    ["project run button", projectActionsSource],
    ["project sidebar", projectSidebarSource],
    ["results quick run", resultsGridSource],
    ["queue retry", queuePageSource],
  ] as const) {
    assert.match(
      source,
      /showRunSubmissionToast/,
      `${name} should surface the deferred submission toast`,
    );
  }

  assert.match(
    toastSource,
    /toast\.warning\("ComfyUI 未启动，任务已加入队列"/,
    "deferred submissions should show the ComfyUI-not-started notification",
  );
  assert.match(
    toastSource,
    /ComfyUI 可达后会自动恢复/,
    "deferred submission notification should tell the user recovery is automatic",
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
