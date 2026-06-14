import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const trainingPageSource = readFileSync(resolve(testDir, "../src/app/training/[[...route]]/page.tsx"), "utf8");
const trainingRouteDataPath = resolve(testDir, "../src/app/training/load-training-route-data.ts");
const trainingRouteDataSource = existsSync(trainingRouteDataPath) ? readFileSync(trainingRouteDataPath, "utf8") : "";
const trainingReadServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/read-service.ts"), "utf8");
const trainingDataSource = readFileSync(resolve(testDir, "../src/app/design-demos/data/lora-training.ts"), "utf8");

test("production training routes use a dedicated loader instead of the generic design-demo loader", () => {
  assert.match(
    trainingPageSource,
    /loadTrainingRouteData/,
    "production training route entry should use a dedicated training data loader",
  );
  assert.doesNotMatch(
    trainingPageSource,
    /loadDesignDemoData\(\)/,
    "production training route entry should not directly depend on the generic demo loader anymore",
  );
});

test("production training loader projects real CharacterLora data into the training route payload", () => {
  assert.match(
    trainingRouteDataSource,
    /listCharacterLoraTrainingJobs/,
    "training route data loader should read real training jobs",
  );
  assert.match(
    trainingRouteDataSource,
    /getCharacterLoraTrainingJobOverview/,
    "training route data loader should read project-level overview data",
  );
  assert.match(
    trainingRouteDataSource,
    /listCharacterLoraSourceImages/,
    "training route data loader should read real reference images",
  );
  assert.match(
    trainingRouteDataSource,
    /listCharacterLoraCandidateImages/,
    "training route data loader should read real result-pool candidates",
  );
  assert.match(
    trainingRouteDataSource,
    /provenanceLabel|typeof provenance\\?\\.label === "string"/,
    "training route data loader should project source-image provenance labels when present",
  );
  assert.match(
    trainingRouteDataSource,
    /provenanceNote|typeof provenance\\?\\.note === "string"/,
    "training route data loader should project source-image provenance notes when present",
  );
  assert.match(
    trainingRouteDataSource,
    /provenanceKind|typeof provenance\\?\\.kind === "string"/,
    "training route data loader should project source-image provenance kind when present",
  );
});

test("buildLoraTrainingDemoData prefers an injected production training payload when present", () => {
  assert.match(
    trainingDataSource,
    /data\.loraTraining/,
    "training demo builder should support a production-projected training payload override",
  );
});

test("training read APIs share the same production training route data projection", () => {
  assert.match(
    trainingReadServiceSource,
    /loadTrainingRouteData/,
    "training read service should consume the same production training route loader as the /training pages",
  );
  assert.doesNotMatch(
    trainingReadServiceSource,
    /loadDesignDemoData/,
    "training read service should not keep a private fallback to the generic demo loader",
  );
});
