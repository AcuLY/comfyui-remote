import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const rootDir = process.cwd();
const serviceSource = readFileSync(
  resolve(rootDir, "src/server/services/training/generation-task-draft-service.ts"),
  "utf8",
);
const projectGenerationTasksRouteSource = readFileSync(
  resolve(rootDir, "src/app/api/training/projects/[projectId]/generation-tasks/route.ts"),
  "utf8",
);
const generationTaskDetailRouteSource = readFileSync(
  resolve(rootDir, "src/app/api/training/generation-tasks/[taskId]/route.ts"),
  "utf8",
);
const generationInputDetailRouteSource = readFileSync(
  resolve(rootDir, "src/app/api/training/generation-inputs/[inputId]/route.ts"),
  "utf8",
);

test("training generation task service no longer keeps managed JSON draft fallback paths", () => {
  for (const forbidden of [
    "TRAINING_GENERATION_TASK_DRAFTS_PATH",
    "training-generation-task-drafts.json",
    "readGenerationTaskDrafts",
    "writeGenerationTaskDrafts",
    "withGenerationTaskDraftWriteLock",
    "generationTaskDraftWriteQueue",
    "GenerationTaskDraftRecord",
  ]) {
    assert.doesNotMatch(
      serviceSource,
      new RegExp(forbidden),
      `${forbidden} should not remain in generation-task-draft-service`,
    );
  }

  assert.doesNotMatch(
    serviceSource,
    /from "node:fs\/promises"/,
    "generation task service should not read or write managed draft JSON files.",
  );
});

test("training generation task service uses Prisma TrainingGenerationTask APIs as the primary boundary", () => {
  for (const exportedName of [
    "listTrainingGenerationTasks",
    "getTrainingGenerationTask",
    "createTrainingGenerationTask",
    "updateTrainingGenerationTask",
    "deleteTrainingGenerationTask",
    "addTrainingGenerationTaskInput",
    "deleteTrainingGenerationTaskInput",
    "previewTrainingGenerationTask",
    "runTrainingGenerationTask",
  ]) {
    assert.match(
      serviceSource,
      new RegExp(`export async function ${exportedName}\\b`),
      `${exportedName} should be the primary generation task service API`,
    );
  }

  assert.match(serviceSource, /prisma\.trainingGenerationTask\b/);
  assert.match(serviceSource, /prisma\.trainingGenerationInputReference\b/);
  assert.match(serviceSource, /\.trainingSectionRun\b/);

  assert.doesNotMatch(
    serviceSource,
    /enqueueManagedTrainingSectionGenerationRun|getManagedTrainingProject|@\/server\/services\/training\/project-service/,
    "generation task service should not call managed project-service generation fallback paths.",
  );
});

test("generation task API routes call TrainingGenerationTask service names", () => {
  const routeSources = [
    projectGenerationTasksRouteSource,
    generationTaskDetailRouteSource,
    generationInputDetailRouteSource,
  ].join("\n");

  for (const expected of [
    "listTrainingGenerationTasks",
    "createTrainingGenerationTask",
    "getTrainingGenerationTask",
    "updateTrainingGenerationTask",
    "deleteTrainingGenerationTask",
    "deleteTrainingGenerationTaskInput",
  ]) {
    assert.match(routeSources, new RegExp(`\\b${expected}\\b`), `routes should call ${expected}`);
  }

  assert.doesNotMatch(routeSources, /ManagedGenerationTask/, "allowed generation task routes should use TrainingGenerationTask names");
});
