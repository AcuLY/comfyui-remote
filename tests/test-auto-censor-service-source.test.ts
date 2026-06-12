import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("censoring service uses batch auto-censor runner instead of ComfyUI latent replay", () => {
  const source = readSource("src/server/services/censoring-service.ts");

  assert.match(source, /import\s+\{\s*runAutoCensorMosaicBatch\s*\}/);
  assert.match(source, /runAutoCensorMosaicBatch\(/);
  assert.match(source, /processCensorTask/);
  assert.match(source, /processCensorTasksBatch/);
  assert.doesNotMatch(source, /runAutoCensorMosaic\(/);
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

test("project marker batch censoring targets pixiv, preview, and cover images", () => {
  const source = readSource("src/lib/actions/censoring.ts");

  assert.match(source, /ProjectCensorMode\s*=\s*"all"\s*\|\s*"kept"\s*\|\s*"marked"/);
  assert.match(source, /mode\s*===\s*"marked"/);
  assert.match(source, /coverImageId/);
  assert.match(source, /featured:\s*true/);
  assert.match(source, /featured2:\s*true/);
  assert.match(source, /id:\s*coverImageId/);
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
  assert.match(source, /persisted:\s*false/);
  assert.match(source, /persisted:\s*true/);

  const runIndex = source.indexOf("await runAutoCensorMosaicBatch");
  const statusCheckIndex = source.indexOf("await shouldPersistForTaskContext", runIndex);
  const persistIndex = source.indexOf("await persistCensoredImage", runIndex);

  assert.ok(runIndex >= 0, "runner call must be present");
  assert.ok(statusCheckIndex > runIndex, "task status must be checked after runner returns");
  assert.ok(statusCheckIndex < persistIndex, "task status must be checked before persistence");
});

test("processCensorTask is a batch-of-one wrapper around processCensorTasksBatch", () => {
  const source = readSource("src/server/services/censoring-service.ts");

  assert.match(source, /export\s+async\s+function\s+processCensorTasksBatch/);
  assert.match(source, /export\s+async\s+function\s+processCensorTask/);
  assert.match(
    source,
    /processCensorTasksBatch\(\s*\[\s*\{[\s\S]*imageResultId[\s\S]*taskId[\s\S]*\}\s*,?\s*\]\s*\)/,
  );
  assert.match(
    source,
    /const\s+\[\s*result\s*\]\s*=\s*await\s+processCensorTasksBatch/,
  );

  const singleWrapperIndex = source.indexOf("export async function processCensorTask(");
  const nextExportIndex = source.indexOf("export async function", singleWrapperIndex + 1);
  const singleWrapperSource = source.slice(
    singleWrapperIndex,
    nextExportIndex === -1 ? source.length : nextExportIndex,
  );
  const directRunnerIndex = singleWrapperSource.indexOf("runAutoCensorMosaicBatch(");
  const wrapperBatchCallIndex = singleWrapperSource.indexOf("processCensorTasksBatch(");

  assert.ok(wrapperBatchCallIndex >= 0, "single wrapper must call batch service");
  assert.equal(
    directRunnerIndex,
    -1,
    "processCensorTask must not call the Python runner directly",
  );
});

test("censoring executor passes task context and skips done update for non-persisted batch work", () => {
  const source = readSource("src/server/services/censoring-executor.ts");

  assert.match(source, /processCensorTasksBatch\(/);
  assert.match(source, /imageResultId:\s*task\.imageResultId/);
  assert.match(source, /taskId:\s*task\.id/);
  assert.match(source, /if\s*\(!result\.persisted\)/);

  const processIndex = source.indexOf("await processCensorTasksBatch");
  const finishIndex = source.indexOf("async function finishBatchResult");
  const finishSource = source.slice(finishIndex, source.indexOf("async function processQueuedTasks"));
  const skipIndex = finishSource.indexOf("if (!result.persisted)");
  const doneUpdateIndex = finishSource.indexOf("markTaskDone(result)");

  assert.ok(processIndex >= 0, "executor must process censor task");
  assert.ok(finishIndex >= 0, "executor must have a batch result finisher");
  assert.ok(skipIndex >= 0, "executor must branch on process result");
  assert.ok(skipIndex < doneUpdateIndex, "executor must skip before done update");
});

test("auto-censor queue batch size is configurable, defaults to 64, and falls back from legacy concurrency", () => {
  const envSource = readSource("src/lib/env.ts");

  assert.match(envSource, /autoCensorBatchSize:/);
  assert.match(envSource, /AUTO_CENSOR_BATCH_SIZE/);
  assert.match(envSource, /AUTO_CENSOR_CONCURRENCY/);
  assert.match(envSource, /readPositiveIntegerEnv\(\s*["']AUTO_CENSOR_CONCURRENCY["']\s*,\s*64\s*\)/);
  assert.doesNotMatch(envSource, /autoCensorConcurrency:/);
});

test("censoring executor claims a configured batch and dispatches one batch service call", () => {
  const source = readSource("src/server/services/censoring-executor.ts");

  assert.match(source, /take:\s*env\.autoCensorBatchSize/);
  assert.match(source, /processCensorTasksBatch/);
  assert.match(
    source,
    /updateMany\(\{[\s\S]*where:\s*\{[\s\S]*status:\s*"queued"[\s\S]*\}/,
  );
  assert.doesNotMatch(
    source,
    /Promise\.all\(\s*tasks\.map\(\s*\(task\)\s*=>\s*processQueuedTask/,
  );

  const claimIndex = source.indexOf('status: "running"');
  const batchCallIndex = source.indexOf("await processCensorTasksBatch", claimIndex);
  const secondBatchCallIndex = source.indexOf("await processCensorTasksBatch", batchCallIndex + 1);

  assert.ok(claimIndex >= 0, "executor must mark the claimed batch running");
  assert.ok(batchCallIndex > claimIndex, "executor must call the batch service after claiming tasks");
  assert.equal(secondBatchCallIndex, -1, "executor must call processCensorTasksBatch once per claimed batch");
});

test("manual selected-image censoring keeps re-censor flexibility without stale re-censor comment", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");

  assert.doesNotMatch(source, /including re-censor/);
  assert.match(source, /runSelectedIds\.includes\(img\.id\)/);
});
