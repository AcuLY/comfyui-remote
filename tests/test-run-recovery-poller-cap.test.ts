import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("stale run recovery caps newly-started pollers after active poll filtering", () => {
  const source = readSource("src/server/services/run-executor.ts");
  const staleRunsQueryStart = source.indexOf("const staleRuns = await db.run.findMany({");
  const unsubmittedQueuedRunsQueryStart = source.indexOf("const unsubmittedQueuedRuns", staleRunsQueryStart);

  assert.notEqual(staleRunsQueryStart, -1, "recoverStaleRuns should query submitted active runs");
  assert.notEqual(
    unsubmittedQueuedRunsQueryStart,
    -1,
    "recoverStaleRuns should keep submitted and unsubmitted recovery queries separate",
  );

  const submittedActiveRunsQuery = source.slice(staleRunsQueryStart, unsubmittedQueuedRunsQueryStart);

  assert.doesNotMatch(
    submittedActiveRunsQuery,
    /\btake\s*:/,
    "submitted active-run recovery must not cap before filtering runs that already have active pollers",
  );
  assert.match(
    source,
    /const recoveryCandidates = staleRuns\.filter\(\(r\) => r\.comfyPromptId && activePolls\.get\(r\.id\) !== r\.comfyPromptId\);/,
    "recoverStaleRuns should first filter out runs that already have active pollers",
  );
  assert.match(
    source,
    /const needsRecovery = recoveryCandidates\.slice\(0, maxRecoveryPolls\);/,
    "recoverStaleRuns should apply COMFY_MANAGER_MAX_RECOVERY_POLLS only to newly-started pollers",
  );
});
