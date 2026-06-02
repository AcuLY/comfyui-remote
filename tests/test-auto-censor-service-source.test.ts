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

test("manual selected-image censoring keeps re-censor flexibility without stale re-censor comment", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");

  assert.doesNotMatch(source, /including re-censor/);
  assert.match(source, /runSelectedIds\.includes\(img\.id\)/);
});
