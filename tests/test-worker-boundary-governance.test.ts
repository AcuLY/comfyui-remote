import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const workerBoundaryDocPath = "docs/worker-boundaries.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("worker boundary doc records generation payload and repository ownership", () => {
  assert.ok(existsSync(join(repoRoot, workerBoundaryDocPath)), `${workerBoundaryDocPath} should document worker ownership`);

  const doc = readSource(workerBoundaryDocPath);
  const docsIndex = readSource("docs/index.md");

  assert.match(doc, /src\/server\/worker\/payload-builder\.ts[\s\S]*owns generation prompt draft normalization/);
  assert.match(doc, /src\/server\/worker\/repository\.ts[\s\S]*owns generation run persistence/);
  assert.match(doc, /src\/server\/worker\/fallback-prompt-builder\.ts[\s\S]*last resort only/);
  assert.match(doc, /src\/server\/worker\/training\/task-id\.ts[\s\S]*owns training worker task ID parsing/);
  assert.match(doc, /docs\/workflow\.api\.json[\s\S]*default standard workflow/);
  assert.match(doc, /Do not let repositories import payload builders/);
  assert.match(doc, /Do not reintroduce worker task ID prefix parsing into task-api/);
  assert.match(doc, /Do not call the fallback prompt builder from run-executor/);
  assert.match(docsIndex, /docs\/worker-boundaries\.md/, "documentation index should point agents to worker boundaries");
});

test("generation worker payload building stays separate from run persistence", () => {
  const payloadBuilder = readSource("src/server/worker/payload-builder.ts");
  const repository = readSource("src/server/worker/repository.ts");
  const runExecutor = readSource("src/server/services/run-executor.ts");

  for (const blockedImport of [
    "@/lib/db",
    "@/server/worker/repository",
    "@/server/worker/fallback-prompt-builder",
    "@/server/services/comfyui-service",
  ]) {
    assert.doesNotMatch(payloadBuilder, new RegExp(blockedImport.replaceAll("/", "\\/")), `payload builder should not import ${blockedImport}`);
  }

  for (const blockedImport of [
    "@/server/worker/payload-builder",
    "@/server/worker/fallback-prompt-builder",
    "@/server/services/comfyui-service",
  ]) {
    assert.doesNotMatch(repository, new RegExp(blockedImport.replaceAll("/", "\\/")), `repository should not import ${blockedImport}`);
  }

  assert.match(runExecutor, /import \{ buildComfyPromptDraft \} from "@\/server\/worker\/payload-builder"/);
  assert.match(runExecutor, /from "@\/server\/worker\/repository"/);
  assert.doesNotMatch(runExecutor, /fallback-prompt-builder/, "run-executor should not call fallback prompt construction directly");
});

test("fallback prompt builder remains a ComfyUI validation last resort", () => {
  const fallbackBuilder = readSource("src/server/worker/fallback-prompt-builder.ts");
  const comfyService = readSource("src/server/services/comfyui-service.ts");

  assert.match(fallbackBuilder, /export function buildFallbackPromptNodes/);
  assert.doesNotMatch(fallbackBuilder, /@\/lib\/db|@\/server\/worker\/repository/);
  assert.match(comfyService, /1\) explicit comfyPrompt in extraParams/);
  assert.match(comfyService, /2\) standard workflow\.api\.json/);
  assert.match(comfyService, /3\) built-in SDXL txt2img fallback/);
  assert.match(comfyService, /function shouldUseStandardWorkflow\(\)[\s\S]*return true;/);
  assert.match(comfyService, /const standardPrompt = await resolveStandardWorkflowPrompt\(promptDraft\);[\s\S]*apiPrompt = standardPrompt \?\? buildFallbackPromptNodes\(promptDraft\);/);
});

test("training worker task id parsing lives in a dedicated boundary", async () => {
  const taskIdPath = "src/server/worker/training/task-id.ts";
  assert.ok(existsSync(join(repoRoot, taskIdPath)), `${taskIdPath} should own worker task ID parsing`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const taskIdSource = readSource(taskIdPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/task-id"/);
  assert.doesNotMatch(taskApi, /const GENERATION_WORKER_TASK_PREFIX/);
  assert.doesNotMatch(taskApi, /function parseWorkerTaskId/);
  assert.doesNotMatch(taskApi, /function workerTypeForTargetType/);
  assert.match(taskIdSource, /export function parseWorkerTaskId/);
  assert.match(taskIdSource, /export function getWorkerTaskId/);
  assert.match(taskIdSource, /export function workerTypeForTargetType/);

  const taskIdUrl = new URL(pathToFileURL(join(repoRoot, taskIdPath)));
  taskIdUrl.searchParams.set("testImport", String(Date.now()));
  const mod = await import(taskIdUrl.href);

  assert.equal(
    mod.getWorkerTaskId({ id: "gen-1", workerType: "image_generation" }),
    "training-generation-worker-task-gen-1",
  );
  assert.equal(
    mod.getGenerationWorkerTaskId("gen-2"),
    "training-generation-worker-task-gen-2",
  );
  assert.equal(
    mod.getTrainingRunWorkerTaskId("run-1"),
    "training-run-worker-task-run-1",
  );
  assert.deepEqual(mod.parseWorkerTaskId("training-generation-worker-task-gen-1"), {
    targetId: "gen-1",
    targetType: "generationRun",
    workerType: "image_generation",
  });
  assert.deepEqual(mod.parseWorkerTaskId("training-dataset-worker-task-revision-1"), {
    targetId: "revision-1",
    targetType: "datasetRevision",
    workerType: "dataset_freeze",
  });
  assert.deepEqual(mod.parseWorkerTaskId("training-run-worker-task-run-1"), {
    targetId: "run-1",
    targetType: "trainingRun",
    workerType: "training",
  });
  assert.equal(mod.parseWorkerTaskId("unknown-run-1"), null);
  assert.equal(mod.workerTypeForTargetType("trainingRun"), "training");
  assert.equal(mod.workerTypeForTargetType("unsupported"), null);
});
