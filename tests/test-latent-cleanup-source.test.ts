import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("standard workflow and builder no longer save latents", () => {
  const workflow = readSource("docs/workflow.api.json");
  const builder = readSource("src/server/services/workflow-prompt-builder.ts");

  assert.doesNotMatch(workflow, /SaveLatent/);
  assert.doesNotMatch(builder, /SaveLatent/);
  assert.doesNotMatch(builder, /latents\//);
});

test("run executor no longer extracts or persists latent outputs", () => {
  const executor = readSource("src/server/services/run-executor.ts");
  const comfy = readSource("src/server/services/comfyui-service.ts");
  const imageService = readSource("src/server/services/image-result-service.ts");
  const workerRepo = readSource("src/server/worker/repository.ts");

  assert.doesNotMatch(executor, /extractLatentOutputs/);
  assert.doesNotMatch(executor, /downloadAndPersistLatent/);
  assert.doesNotMatch(comfy, /extractLatentOutputs/);
  assert.doesNotMatch(imageService, /downloadAndPersistLatent/);
  assert.doesNotMatch(workerRepo, /latentFilePath/);
});
