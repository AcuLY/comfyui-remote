import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const rootDir = process.cwd();
const templateServiceSource = readFileSync(resolve(rootDir, "src/server/services/training/template-service.ts"), "utf8");
const trainingReadServiceSource = readFileSync(resolve(rootDir, "src/server/services/training/read-service.ts"), "utf8");
const templateCollectionRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/route.ts"), "utf8");
const templateDetailRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/[templateId]/route.ts"), "utf8");
const templateReorderRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/reorder/route.ts"), "utf8");
const templateSectionCollectionRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/[templateId]/sections/route.ts"), "utf8");
const templateSectionDetailRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/[templateId]/sections/[sectionId]/route.ts"), "utf8");
const templateSectionReorderRouteSource = readFileSync(resolve(rootDir, "src/app/api/training/templates/[templateId]/sections/reorder/route.ts"), "utf8");

test("training template service no longer has managed JSON fallback runtime paths", () => {
  for (const forbidden of [
    "readFallbackTrainingTemplates",
    "writeFallbackTrainingTemplates",
    "DEFAULT_FALLBACK_TRAINING_TEMPLATES",
    "shouldUseTrainingTemplateFileFallback",
    "TRAINING_TEMPLATE_FALLBACK_PATH",
    "buildDefaultFallbackTrainingTemplates",
    "findFallbackTrainingTemplate",
    "findFallbackTrainingTemplateIndex",
    "training-templates.json",
  ]) {
    assert.doesNotMatch(templateServiceSource, new RegExp(forbidden), `${forbidden} should not remain in template-service`);
  }

  assert.doesNotMatch(
    templateServiceSource,
    /from "node:fs\/promises"/,
    "template-service should not read or write template JSON files.",
  );
});

test("training template service exposes Prisma TrainingTemplate operations", () => {
  for (const exportedName of [
    "listTrainingTemplates",
    "getTrainingTemplate",
    "createTrainingTemplate",
    "updateTrainingTemplate",
    "deleteTrainingTemplate",
    "createTrainingTemplateSection",
    "updateTrainingTemplateSection",
    "deleteTrainingTemplateSection",
    "reorderTrainingTemplateSections",
  ]) {
    assert.match(
      templateServiceSource,
      new RegExp(`export async function ${exportedName}\\b`),
      `${exportedName} should be the primary template-service API`,
    );
  }

  for (const rowHelper of [
    "listTrainingTemplateRows",
    "getTrainingTemplateRow",
    "createTrainingTemplateRow",
    "updateTrainingTemplateRow",
    "softDeleteTrainingTemplateRow",
  ]) {
    assert.match(templateServiceSource, new RegExp(`${rowHelper}\\(`), `${rowHelper} should back template operations`);
  }
});

test("training template routes call TrainingTemplate service APIs instead of snapshot or managed names", () => {
  assert.match(
    templateCollectionRouteSource,
    /@\/server\/services\/training\/read-service/,
    "template collection GET should enter through the shared Training read boundary.",
  );
  assert.match(
    trainingReadServiceSource,
    /listTrainingTemplates\s+as\s+listTrainingTemplatesFromPrisma/,
    "Training read-service should delegate template list reads to the Prisma-backed template service.",
  );
  assert.match(
    trainingReadServiceSource,
    /return\s+listTrainingTemplatesFromPrisma\(\)/,
    "Training read-service template list should not return snapshot templates.",
  );

  const routeSources = [
    templateCollectionRouteSource,
    templateDetailRouteSource,
    templateReorderRouteSource,
    templateSectionCollectionRouteSource,
    templateSectionDetailRouteSource,
    templateSectionReorderRouteSource,
  ].join("\n");

  for (const expected of [
    "listTrainingTemplates",
    "getTrainingTemplate",
    "createTrainingTemplate",
    "updateTrainingTemplate",
    "deleteTrainingTemplate",
    "reorderTrainingTemplates",
    "createTrainingTemplateSection",
    "updateTrainingTemplateSection",
    "deleteTrainingTemplateSection",
    "reorderTrainingTemplateSections",
  ]) {
    assert.match(routeSources, new RegExp(`\\b${expected}\\b`), `routes should call ${expected}`);
  }

  assert.doesNotMatch(routeSources, /ManagedTrainingTemplate/, "template routes should use TrainingTemplate names");
});
