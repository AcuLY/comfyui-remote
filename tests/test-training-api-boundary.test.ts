import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

function listFiles(root: string, includeFile: (name: string) => boolean): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return listFiles(path, includeFile);
    }

    return entry.isFile() && includeFile(entry.name) ? [path] : [];
  });
}

test("training API route handlers do not directly depend on legacy character-lora-training modules", () => {
  const routeFiles = listFiles(join(process.cwd(), "src/app/api/training"), (name) => name === "route.ts");
  const directLegacyImports = routeFiles
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Route handlers should call Training* services/repositories instead of importing legacy character-lora-training modules directly.",
  );
});

test("training services isolate legacy character-lora-training dependencies in one adapter", () => {
  const serviceFiles = listFiles(join(process.cwd(), "src/server/services/training"), (name) => name.endsWith(".ts"));
  const directLegacyImports = serviceFiles
    .filter((path) => !path.endsWith("legacy-compat-service.ts"))
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("character-lora-training"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    directLegacyImports,
    [],
    "Training services should use legacy-compat-service while the remaining old implementation is migrated.",
  );
});

test("training worker task routes go through the Training worker boundary", () => {
  const taskApiPath = join(process.cwd(), "src/server/worker/training/task-api.ts");
  assert.equal(existsSync(taskApiPath), true, "Training worker task API boundary should exist under src/server/worker/training");

  const taskApiSource = readFileSync(taskApiPath, "utf8");
  assert.doesNotMatch(
    taskApiSource,
    /@\/server\/services\/character-lora-training/,
    "Training worker task boundary should not import legacy character-lora-training services directly",
  );
  assert.match(taskApiSource, /export async function getTrainingWorkerQueueStatus/);
  assert.match(taskApiSource, /export async function leaseNextTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function heartbeatTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function completeTrainingWorkerTask/);
  assert.match(taskApiSource, /export async function failTrainingWorkerTask/);

  const workerRouteFiles = listFiles(join(process.cwd(), "src/app/api/training/worker"), (name) => name === "route.ts");
  const leakingRoutes = workerRouteFiles
    .map((path) => ({
      path,
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ source }) => source.includes("@/server/services/training/legacy-compat-service"))
    .map(({ path }) => relative(process.cwd(), path));

  assert.deepEqual(
    leakingRoutes,
    [],
    "Training worker routes should call src/server/worker/training/task-api instead of the legacy compat service directly.",
  );

  const taskLifecycleRoutes = workerRouteFiles
    .filter((path) => path.includes(join("worker", "tasks")))
    .map((path) => readFileSync(path, "utf8").includes("@/server/worker/training/task-api"));
  assert.ok(
    taskLifecycleRoutes.every(Boolean),
    "Training worker task lifecycle routes should import the Training worker task API boundary",
  );
});

test("training project archive and restore routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/projects/[projectId]/archive/route.ts",
    "src/app/api/training/projects/[projectId]/restore/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route project visibility mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function archiveTrainingProject/);
  assert.match(projectService, /export async function restoreTrainingProject/);
});

test("training run cancel routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/generation-tasks/[taskId]/cancel/route.ts",
    "src/app/api/training/section-runs/[runId]/cancel/route.ts",
    "src/app/api/training/training-runs/[trainingRunId]/cancel/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route cancel mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function cancelTrainingGenerationRun/);
  assert.match(projectService, /export async function cancelTrainingRun/);
});

test("training dataset revision freeze route uses the project service boundary", () => {
  const routeFile = "src/app/api/training/projects/[projectId]/dataset-revisions/route.ts";
  const source = readFileSync(join(process.cwd(), routeFile), "utf8");

  assert.match(
    source,
    /@\/server\/services\/training\/project-service/,
    `${routeFile} should route dataset freeze mutations through project-service`,
  );
  assert.doesNotMatch(
    source,
    /@\/server\/services\/training\/legacy-compat-service/,
    `${routeFile} should not fallback to legacy compat from the route layer`,
  );

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function freezeTrainingDataset/);
});

test("training run enqueue routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/sections/[sectionId]/runs/route.ts",
    "src/app/api/training/projects/[projectId]/training-runs/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route run enqueue mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function enqueueTrainingSectionGenerationRun/);
  assert.match(projectService, /export async function enqueueTrainingRun/);
});

test("training image result routes use the project service boundary", () => {
  const routeFiles = [
    "src/app/api/training/image-results/[imageResultId]/route.ts",
    "src/app/api/training/image-results/[imageResultId]/review/route.ts",
  ];

  for (const routeFile of routeFiles) {
    const source = readFileSync(join(process.cwd(), routeFile), "utf8");

    assert.match(
      source,
      /@\/server\/services\/training\/project-service/,
      `${routeFile} should route image result mutations through project-service`,
    );
    assert.doesNotMatch(
      source,
      /@\/server\/services\/training\/legacy-compat-service/,
      `${routeFile} should not fallback to legacy compat from the route layer`,
    );
  }

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function updateTrainingImageResult/);
  assert.match(projectService, /export async function reviewTrainingImageResult/);
});

test("training project detail route uses the project service boundary for mutations", () => {
  const routeFile = "src/app/api/training/projects/[projectId]/route.ts";
  const source = readFileSync(join(process.cwd(), routeFile), "utf8");

  assert.match(
    source,
    /@\/server\/services\/training\/project-service/,
    `${routeFile} should route project mutations through project-service`,
  );
  assert.doesNotMatch(
    source,
    /@\/server\/services\/training\/legacy-compat-service/,
    `${routeFile} should not update legacy projects from the route layer`,
  );

  const projectService = readFileSync(join(process.cwd(), "src/server/services/training/project-service.ts"), "utf8");
  assert.match(projectService, /export async function updateTrainingProject/);
});
