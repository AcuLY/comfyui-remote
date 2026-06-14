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
const trainingFeatureDataPath = resolve(testDir, "../src/features/training/data.ts");
const trainingFeatureDataSource = existsSync(trainingFeatureDataPath) ? readFileSync(trainingFeatureDataPath, "utf8") : "";
const trainingFeatureBuildPath = resolve(testDir, "../src/features/training/build.ts");
const trainingFeatureBuildSource = existsSync(trainingFeatureBuildPath) ? readFileSync(trainingFeatureBuildPath, "utf8") : "";
const sharedTrainingTypesPath = resolve(testDir, "../src/features/training/types.ts");
const sharedTrainingTypesSource = existsSync(sharedTrainingTypesPath) ? readFileSync(sharedTrainingTypesPath, "utf8") : "";
const legacyTrainingTypesPath = resolve(testDir, "../src/app/design-demos/data/lora-training-types.ts");
const legacyTrainingTypesSource = readFileSync(legacyTrainingTypesPath, "utf8");
const trainingReadServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/read-service.ts"), "utf8");
const projectTemplateCopyServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/project-template-copy-service.ts"), "utf8");
const trainingProjectServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/project-service.ts"), "utf8");
const trainingTemplateServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/template-service.ts"), "utf8");
const trainingPresetServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/preset-service.ts"), "utf8");
const trainingProjectSectionServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/project-section-service.ts"), "utf8");
const trainingProjectSceneBlockServiceSource = readFileSync(resolve(testDir, "../src/server/services/training/project-scene-block-service.ts"), "utf8");
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
    trainingFeatureBuildSource,
    /data\.loraTraining/,
    "training feature build should support a production-projected training payload override",
  );
  assert.match(
    trainingDataSource,
    /export \{ buildLoraTrainingDemoData \} from "@\/features\/training\/build";/,
    "legacy design-demo training data file should become a compatibility re-export from the shared feature build module",
  );
});

test("production training route loader delegates snapshot assembly to a dedicated training service", () => {
  assert.match(
    trainingRouteDataSource,
    /export \{ loadTrainingRouteData \} from "@\/features\/training\/data";/,
    "app-layer route loader should re-export the dedicated training feature data loader",
  );
  assert.match(
    trainingFeatureDataSource,
    /export async function loadTrainingRouteData/,
    "training feature data module should expose the shared route-data builder",
  );
  assert.match(
    trainingFeatureDataSource,
    /loadTrainingSnapshot/,
    "training feature data module should import the dedicated training snapshot service",
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

test("training services share a dedicated feature-level view-model type module instead of importing app design-demo types", () => {
  const serviceSources = [
    trainingReadServiceSource,
    projectTemplateCopyServiceSource,
    trainingProjectServiceSource,
    trainingTemplateServiceSource,
    trainingPresetServiceSource,
    trainingProjectSectionServiceSource,
    trainingProjectSceneBlockServiceSource,
    trainingSnapshotServiceSource,
  ];

  assert.match(
    sharedTrainingTypesSource,
    /export type LoraTrainingProjectStatus/,
    "shared training feature types should define the training view-model contract",
  );
  for (const source of serviceSources) {
    assert.doesNotMatch(
      source,
      /@\/app\/design-demos\/data\/lora-training-types/,
      "training services should not import their view-model types from the app design-demo layer",
    );
  }
  assert.match(
    legacyTrainingTypesSource,
    /export \* from "@\/features\/training\/types";/,
    "legacy design-demo training type file should become a compatibility re-export from the shared feature types",
  );
});

test("training feature types define their image preview contract locally instead of importing design-demo data types", () => {
  assert.match(
    sharedTrainingTypesSource,
    /export type TrainingImageStatus = "pending" \| "kept" \| "trashed";/,
    "shared training feature types should define their image status contract",
  );
  assert.match(
    sharedTrainingTypesSource,
    /export type TrainingImage = \{[\s\S]*?src:\s*string;[\s\S]*?full:\s*string;[\s\S]*?label:\s*string;/,
    "shared training feature types should define their own preview image shape",
  );
  assert.doesNotMatch(
    sharedTrainingTypesSource,
    /@\/app\/design-demos\/data\/types/,
    "training feature types should not import DemoImage from the design-demos data layer",
  );
  assert.doesNotMatch(
    trainingProjectServiceSource,
    /@\/app\/design-demos\/data\/types/,
    "training project service should not depend on the design-demos data type module",
  );
  assert.doesNotMatch(
    trainingSnapshotServiceSource,
    /@\/app\/design-demos\/data\/types/,
    "training snapshot service should not depend on the design-demos data type module",
  );
});
