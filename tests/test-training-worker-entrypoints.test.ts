import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("training worker supervisor has Training-named npm entrypoints", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.["training:workers"], "tsx scripts/training/worker-queue.ts");
  assert.equal(
    packageJson.scripts?.["training:workers:mock"],
    "tsx scripts/training/worker-queue.ts --mock-image --dry-run-training --mock-complete-training",
  );
});

test("training worker supervisor does not expose legacy-only workers by default", () => {
  const workerQueuePath = join(process.cwd(), "scripts/training/worker-queue.ts");
  assert.equal(existsSync(workerQueuePath), true, "scripts/training/worker-queue.ts should exist");

  const source = readFileSync(workerQueuePath, "utf8");
  assert.match(source, /LoRA training worker queue supervisor/);
  assert.match(source, /workerOwner:\s*"training-queue"/);
  assert.match(source, /script:\s*"image-worker\.ts"/);
  assert.match(source, /script:\s*"dataset-freeze-worker\.ts"/);
  assert.match(source, /script:\s*"training-worker\.ts"/);
  assert.doesNotMatch(source, /benchmark-worker\.ts/);
  assert.doesNotMatch(source, /prompt-card-draft-worker\.ts/);
  assert.doesNotMatch(source, /character-lora:workers/);
});

test("training API manifest tells agents how to run the training worker supervisor", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(payload.data.workerSupervisor.defaultCommand, "cmd /c npm run training:workers");
  assert.equal(payload.data.workerSupervisor.mockCommand, "cmd /c npm run training:workers:mock");
  assert.deepEqual(payload.data.workerSupervisor.defaultWorkers, ["image", "dataset-freeze", "training"]);
});
