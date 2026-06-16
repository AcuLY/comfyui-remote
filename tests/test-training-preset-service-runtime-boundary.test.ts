import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const trainingPresetServiceSource = readFileSync(
  resolve(repoRoot, "src/server/services/training/preset-service.ts"),
  "utf8",
);
const fallbackGateHelperName = ["shouldUse", "TrainingPreset", "FileFallback"].join("");

test("training scene preset service has no JSON file fallback runtime path", () => {
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /training-scene-description-(?:presets|categories|folders)\.json/,
    "training scene presets, categories, and folders should not read or write fallback JSON files",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /\b(?:read|write)FallbackTraining(?:Presets|Categories|Folders|SceneLibraryState)\b/,
    "training scene preset runtime should not keep fallback read/write helpers",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    new RegExp(`\\b${fallbackGateHelperName}\\b`),
    "database errors should surface instead of switching to training preset file fallback",
  );
});

test("training scene preset service stays isolated to TrainingSceneDescriptionPreset Prisma models", () => {
  assert.match(
    trainingPresetServiceSource,
    /trainingSceneDescriptionPresetCategory/,
    "category operations should use TrainingSceneDescriptionPresetCategory",
  );
  assert.match(
    trainingPresetServiceSource,
    /trainingSceneDescriptionPresetFolder/,
    "folder operations should use TrainingSceneDescriptionPresetFolder",
  );
  assert.match(
    trainingPresetServiceSource,
    /trainingSceneDescriptionPreset/,
    "preset operations should use TrainingSceneDescriptionPreset",
  );
  assert.doesNotMatch(
    trainingPresetServiceSource,
    /\bprisma\.(?:presetCategory|presetFolder|preset|presetVariant|presetGroup)\b/,
    "training scene preset service must not touch generation preset Prisma models",
  );
});
