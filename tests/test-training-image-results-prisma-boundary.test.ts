import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const scopedSources = [
  "src/server/services/training/caption-service.ts",
  "src/server/services/training/generation-output-service.ts",
  "src/app/api/training/projects/[projectId]/image-results/route.ts",
  "src/app/api/training/projects/[projectId]/image-results/upload/route.ts",
  "src/app/api/training/image-results/[imageResultId]/caption/route.ts",
  "src/app/api/training/image-results/[imageResultId]/route.ts",
  "src/app/api/training/image-results/[imageResultId]/review/route.ts",
].map((path) => join(repoRoot, path));

const forbiddenManagedHelpers = [
  "getManagedTrainingProject",
  "getManagedTrainingImageResult",
  "getManagedTrainingImageResultContext",
  "updateManagedTrainingImageResult",
  "applyManagedTrainingImageResultToReferenceImage",
  "addManagedTrainingReferenceImageToResults",
  "deleteManagedTrainingImageResult",
  "uploadManagedTrainingImageResult",
  "reviewTrainingImageResult",
  "updateTrainingImageResult",
];

const serviceSources = [
  "src/server/services/training/caption-service.ts",
  "src/server/services/training/generation-output-service.ts",
].map((path) => join(repoRoot, path));

const forbiddenGenerationModuleTokens = [
  "prisma.imageResult",
  "prisma.generationRun",
  "prisma.project",
  "prisma.preset",
  "prisma.run",
  "@/server/services/generation",
  "@/server/repositories/generation",
];

function findForbiddenHits(tokens: string[]) {
  return scopedSources.flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const lines = source.split(/\r?\n/);

    return tokens.flatMap((token) =>
      lines.flatMap((line, index) =>
        line.includes(token)
          ? [{
            line: index + 1,
            path: relative(repoRoot, path),
            token,
          }]
          : [],
      ),
    );
  });
}

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("training image-result and caption services/routes do not call managed JSON helpers", () => {
  assert.deepEqual(
    findForbiddenHits(forbiddenManagedHelpers),
    [],
    "Training image result upload/delete/review/caption/apply paths must use Prisma Training tables, not managed JSON project-service helpers.",
  );
});

test("training image-result routes do not import project-service wrappers", () => {
  assert.deepEqual(
    findForbiddenHits(['@/server/services/training/project-service']),
    [],
    "Image result routes should call image-result/caption services directly instead of project-service wrappers.",
  );
});

test("training image-result services use Training-owned Prisma resources only", () => {
  const captionSource = readSource("src/server/services/training/caption-service.ts");
  const generationOutputSource = readSource("src/server/services/training/generation-output-service.ts");

  assert.match(
    captionSource,
    /getTrainingCandidateImage|listTrainingCandidateImages|updateTrainingCandidateImageCaption/,
    "caption generation should use Prisma-backed Training image result repository functions.",
  );
  assert.match(
    generationOutputSource,
    /prisma\.trainingImageResult/,
    "image result upload, review, patch, and delete should mutate TrainingImageResult through Prisma.",
  );
  assert.match(
    generationOutputSource,
    /createTrainingReferenceImage|findTrainingReferenceImageDuplicate/,
    "result-to-reference-image should stay on the TrainingCharacterImage repository/service path.",
  );

  const hits = serviceSources.flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return forbiddenGenerationModuleTokens.flatMap((token) =>
      source.includes(token)
        ? [{ path: relative(repoRoot, path), token }]
        : [],
    );
  });

  assert.deepEqual(
    hits,
    [],
    "Image result/caption services must not touch generation-module Preset/Project/Run/ImageResult resources.",
  );
});
