import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("censoring service uses auto-censor runner instead of ComfyUI latent replay", () => {
  const source = readSource("src/server/services/censoring-service.ts");

  assert.match(source, /runAutoCensorMosaic/);
  assert.match(source, /processCensorTask/);
  assert.doesNotMatch(source, /submitCensorPrompt/);
  assert.doesNotMatch(source, /pollCensorCompletion/);
  assert.doesNotMatch(source, /buildLatentCensorWorkflow/);
  assert.doesNotMatch(source, /LoadLatent/);
  assert.doesNotMatch(source, /LatentFromBatch/);
  assert.doesNotMatch(source, /illustrious_mosaic_censor_v2/);
});

test("censoring actions do not require latentFilePath and project batch defaults to uncensored images", () => {
  const source = readSource("src/lib/actions/censoring.ts");

  assert.doesNotMatch(source, /latentFilePath/);
  assert.match(source, /censoredAt:\s*null/);
  assert.match(source, /reviewStatus:\s*\{\s*in:\s*reviewStatuses/);
});

test("censoring cancellation stays local instead of mutating ComfyUI queues", () => {
  const source = readSource("src/lib/actions/censoring.ts");

  assert.doesNotMatch(source, /deleteComfyQueueItems/);
  assert.doesNotMatch(source, /getComfyQueuePosition/);
  assert.doesNotMatch(source, /interruptComfyPrompt/);
});

test("censoring service rechecks running task state after auto-censor before persisting", () => {
  const source = readSource("src/server/services/censoring-service.ts");

  assert.match(source, /taskId\?:\s*string/);
  assert.match(source, /persisted:\s*boolean/);
  assert.match(source, /prisma\.censoringTask\.findUnique/);
  assert.match(source, /status\s*!==\s*"running"/);
  assert.match(source, /return\s*\{\s*persisted:\s*false\s*\}/);
  assert.match(source, /return\s*\{\s*persisted:\s*true\s*\}/);

  const runIndex = source.indexOf("await runAutoCensorMosaic");
  const statusCheckIndex = source.indexOf("await shouldPersistForTaskContext", runIndex);
  const persistIndex = source.indexOf("await persistCensoredImage", runIndex);

  assert.ok(runIndex >= 0, "runner call must be present");
  assert.ok(statusCheckIndex > runIndex, "task status must be checked after runner returns");
  assert.ok(statusCheckIndex < persistIndex, "task status must be checked before persistence");
});

test("censoring executor passes task context and skips done update for non-persisted work", () => {
  const source = readSource("src/server/services/censoring-executor.ts");

  assert.match(
    source,
    /processCensorTask\(\{[\s\S]*imageResultId:\s*task\.imageResultId,[\s\S]*taskId:\s*task\.id/,
  );
  assert.match(source, /if\s*\(!result\.persisted\)/);

  const processIndex = source.indexOf("await processCensorTask");
  const skipIndex = source.indexOf("if (!result.persisted)", processIndex);
  const doneUpdateIndex = source.indexOf('status: "done"', processIndex);

  assert.ok(processIndex >= 0, "executor must process censor task");
  assert.ok(skipIndex > processIndex, "executor must branch on process result");
  assert.ok(skipIndex < doneUpdateIndex, "executor must skip before done update");
});

test("auto-censor queue concurrency is configurable and defaults to four workers", () => {
  const envSource = readSource("src/lib/env.ts");
  const exampleEnv = readSource(".env.example");

  assert.match(
    envSource,
    /autoCensorConcurrency:\s*readPositiveIntegerEnv\("AUTO_CENSOR_CONCURRENCY",\s*4\)/,
  );
  assert.match(exampleEnv, /AUTO_CENSOR_CONCURRENCY="4"/);
});

test("censoring executor claims a configured batch and dispatches tasks concurrently", () => {
  const source = readSource("src/server/services/censoring-executor.ts");

  assert.match(source, /take:\s*env\.autoCensorConcurrency/);
  assert.match(source, /Promise\.all\(\s*tasks\.map\(\(task\)\s*=>/);
  assert.match(
    source,
    /updateMany\(\{[\s\S]*where:\s*\{\s*id:\s*task\.id,\s*status:\s*"queued"\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /for\s*\(const task of tasks\)\s*\{[\s\S]*?await\s+processCensorTask/,
  );
});

test("manual selected-image censoring keeps re-censor flexibility without stale re-censor comment", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");

  assert.doesNotMatch(source, /including re-censor/);
  assert.match(source, /runSelectedIds\.includes\(img\.id\)/);
});
