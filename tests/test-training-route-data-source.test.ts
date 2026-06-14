import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const trainingPageSource = readFileSync(resolve(testDir, "../src/app/training/[[...route]]/page.tsx"), "utf8");
const trainingRouteDataPath = resolve(testDir, "../src/app/training/load-training-route-data.ts");
const trainingRouteDataSource = existsSync(trainingRouteDataPath) ? readFileSync(trainingRouteDataPath, "utf8") : "";
const trainingSnapshotServicePath = resolve(testDir, "../src/server/services/training/snapshot-service.ts");
const trainingSnapshotServiceSource = existsSync(trainingSnapshotServicePath) ? readFileSync(trainingSnapshotServicePath, "utf8") : "";
const trainingReadServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/read-service.ts"), "utf8");
const projectTemplateCopyServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/project-template-copy-service.ts"), "utf8");
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

test("dedicated training snapshot service projects real CharacterLora data into the training route payload", () => {
  assert.match(
    trainingSnapshotServiceSource,
    /listCharacterLoraTrainingJobs/,
    "training snapshot service should read real training jobs",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /getCharacterLoraTrainingJobOverview/,
    "training snapshot service should read project-level overview data",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /listCharacterLoraSourceImages/,
    "training snapshot service should read real reference images",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /listCharacterLoraCandidateImages/,
    "training snapshot service should read real result-pool candidates",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /provenanceLabel|typeof provenance\\?\\.label === "string"/,
    "training snapshot service should project source-image provenance labels when present",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /provenanceNote|typeof provenance\\?\\.note === "string"/,
    "training snapshot service should project source-image provenance notes when present",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /provenanceKind|typeof provenance\\?\\.kind === "string"/,
    "training snapshot service should project source-image provenance kind when present",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /run\.inputImages/,
    "training snapshot service should map real generation input attachments into the route payload",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /relativePath/,
    "training snapshot service should resolve generation input attachments from artifact-relative paths",
  );
});

test("buildLoraTrainingDemoData prefers an injected production training payload when present", () => {
  assert.match(
    trainingDataSource,
    /data\.loraTraining/,
    "training demo builder should support a production-projected training payload override",
  );
});

test("production training route loader delegates snapshot assembly to a dedicated training service", () => {
  assert.match(
    trainingRouteDataSource,
    /loadTrainingSnapshot/,
    "route loader should import the dedicated training snapshot service",
  );
  assert.match(
    trainingSnapshotServiceSource,
    /export async function loadTrainingSnapshot/,
    "training snapshot service should expose the shared snapshot builder",
  );
});

test("training read APIs use the dedicated training snapshot service instead of the route loader", () => {
  assert.match(
    trainingReadServiceSource,
    /loadTrainingSnapshot/,
    "training read service should consume the shared training snapshot service",
  );
  assert.doesNotMatch(
    trainingReadServiceSource,
    /loadTrainingRouteData/,
    "training read service should not depend on the route-level /training page loader",
  );
  assert.doesNotMatch(
    trainingReadServiceSource,
    /buildLoraTrainingDemoData/,
    "training read service should not rebuild snapshots through the design-demos adapter",
  );
});

test("template/project copy flows use the shared training snapshot service instead of the route loader", () => {
  assert.match(
    projectTemplateCopyServiceSource,
    /loadTrainingSnapshot/,
    "project/template copy service should read from the shared training snapshot service",
  );
  assert.doesNotMatch(
    projectTemplateCopyServiceSource,
    /loadTrainingRouteData/,
    "project/template copy service should not depend on the route-level training loader",
  );
  assert.doesNotMatch(
    projectTemplateCopyServiceSource,
    /buildLoraTrainingDemoData/,
    "project/template copy service should not rebuild snapshots through the design-demos adapter",
  );
});
