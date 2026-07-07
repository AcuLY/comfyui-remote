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
  assert.match(doc, /src\/server\/worker\/training\/target-discovery\.ts[\s\S]*owns training worker target discovery/);
  assert.match(doc, /src\/server\/worker\/training\/task-serialization\.ts[\s\S]*owns serialized worker task shaping/);
  assert.match(doc, /src\/server\/worker\/training\/task-errors\.ts[\s\S]*owns training worker task error mapping/);
  assert.match(doc, /src\/server\/worker\/training\/leasing\.ts[\s\S]*owns training worker leasing/);
  assert.match(doc, /src\/server\/worker\/training\/task-json\.ts[\s\S]*owns worker task JSON normalization/);
  assert.match(doc, /src\/server\/worker\/training\/heartbeat\.ts[\s\S]*owns training worker heartbeat handling/);
  assert.match(doc, /docs\/workflow\.api\.json[\s\S]*default standard workflow/);
  assert.match(doc, /Do not let repositories import payload builders/);
  assert.match(doc, /Do not reintroduce worker task ID prefix parsing into task-api/);
  assert.match(doc, /Do not reintroduce target discovery queries into task-api/);
  assert.match(doc, /Do not reintroduce lease request parsing or mark-running transitions into task-api/);
  assert.match(doc, /Do not reintroduce heartbeat request parsing or heartbeat progress writes into task-api/);
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

test("training worker target discovery lives in a dedicated boundary", async () => {
  const targetDiscoveryPath = "src/server/worker/training/target-discovery.ts";
  assert.ok(existsSync(join(repoRoot, targetDiscoveryPath)), `${targetDiscoveryPath} should own worker target discovery`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const targetDiscoverySource = readSource(targetDiscoveryPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/target-discovery"/);
  assert.doesNotMatch(taskApi, /function mapGenerationTaskToTarget/);
  assert.doesNotMatch(taskApi, /async function countWorkerTargets/);
  assert.doesNotMatch(taskApi, /async function findQueuedWorkerTarget/);
  assert.doesNotMatch(taskApi, /async function findWorkerTargetByTaskId/);
  assert.match(targetDiscoverySource, /export function mapGenerationTaskToTarget/);
  assert.match(targetDiscoverySource, /export async function countWorkerTargets/);
  assert.match(targetDiscoverySource, /export async function findRunningWorkerTarget/);
  assert.match(targetDiscoverySource, /export async function findQueuedWorkerTarget/);
  assert.match(targetDiscoverySource, /export async function findWorkerTargetByTaskId/);

  const targetDiscoveryUrl = new URL(pathToFileURL(join(repoRoot, targetDiscoveryPath)));
  targetDiscoveryUrl.searchParams.set("testImport", String(Date.now()));
  const mod = await import(targetDiscoveryUrl.href);

  assert.deepEqual(mod.mapGenerationTaskToTarget({
    id: "gen-1",
    status: "queued",
    trainingProjectId: "project-1",
  }), {
    id: "gen-1",
    projectId: "project-1",
    status: "queued",
    targetType: "generationRun",
    workerType: "image_generation",
  });
  assert.deepEqual(mod.mapDatasetRevisionToTarget({
    id: "revision-1",
    status: "draft",
    trainingProjectId: "project-1",
  }), {
    id: "revision-1",
    projectId: "project-1",
    status: "draft",
    targetType: "datasetRevision",
    workerType: "dataset_freeze",
  });
  assert.deepEqual(mod.mapTrainingRunToTarget({
    id: "run-1",
    status: "running",
    trainingProjectId: "project-1",
  }), {
    id: "run-1",
    projectId: "project-1",
    status: "running",
    targetType: "trainingRun",
    workerType: "training",
  });
});

test("training worker task errors live in a dedicated boundary", async () => {
  const taskErrorsPath = "src/server/worker/training/task-errors.ts";
  assert.ok(existsSync(join(repoRoot, taskErrorsPath)), `${taskErrorsPath} should own worker task error mapping`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const taskErrorsSource = readSource(taskErrorsPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/task-errors"/);
  assert.doesNotMatch(taskApi, /export class TrainingWorkerTaskError/);
  assert.doesNotMatch(taskApi, /export function mapTrainingWorkerTaskError/);
  assert.match(taskErrorsSource, /export class TrainingWorkerTaskError/);
  assert.match(taskErrorsSource, /export function mapTrainingWorkerTaskError/);

  const taskErrorsUrl = new URL(pathToFileURL(join(repoRoot, taskErrorsPath)));
  taskErrorsUrl.searchParams.set("testImport", String(Date.now()));
  const mod = await import(taskErrorsUrl.href);
  const error = new mod.TrainingWorkerTaskError("bad lease", 400, { reason: "test" });

  assert.deepEqual(mod.mapTrainingWorkerTaskError(error), {
    details: { reason: "test" },
    message: "bad lease",
    status: 400,
  });
  assert.deepEqual(mod.mapTrainingWorkerTaskError(new Error("boom")), {
    details: "boom",
    message: "Unexpected training worker task error",
    status: 500,
  });
});

test("training worker leasing lives in a dedicated boundary", async () => {
  const leasingPath = "src/server/worker/training/leasing.ts";
  const serializerPath = "src/server/worker/training/task-serialization.ts";
  assert.ok(existsSync(join(repoRoot, leasingPath)), `${leasingPath} should own worker leasing`);
  assert.ok(existsSync(join(repoRoot, serializerPath)), `${serializerPath} should own serialized worker task shaping`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const leasingSource = readSource(leasingPath);
  const serializerSource = readSource(serializerPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/leasing"/);
  assert.match(taskApi, /from "@\/server\/worker\/training\/task-serialization"/);
  assert.doesNotMatch(taskApi, /async function markWorkerTargetRunning/);
  assert.doesNotMatch(taskApi, /export async function leaseNextTrainingWorkerTask/);
  assert.doesNotMatch(taskApi, /trainingWorkerTaskLeaseRequestSchema/);
  assert.match(leasingSource, /export async function markWorkerTargetRunning/);
  assert.match(leasingSource, /export async function leaseNextTrainingWorkerTask/);
  assert.match(serializerSource, /export function serializeWorkerTask/);

  const serializerUrl = new URL(pathToFileURL(join(repoRoot, serializerPath)));
  serializerUrl.searchParams.set("testImport", String(Date.now()));
  const serializer = await import(serializerUrl.href);
  const serialized = serializer.serializeWorkerTask({
    id: "run-1",
    projectId: "project-1",
    status: "running",
    targetType: "trainingRun",
    workerType: "training",
  }, {
    leaseOwner: "owner-1",
    progressJson: { phase: "training" },
  });

  assert.equal(serialized.id, "training-run-worker-task-run-1");
  assert.equal(serialized.jobId, "project-1");
  assert.equal(serialized.leaseOwner, "owner-1");
  assert.deepEqual(serialized.progressJson, { phase: "training" });
  assert.equal(serialized.status, "running");
});

test("training worker heartbeat lives in a dedicated boundary", async () => {
  const heartbeatPath = "src/server/worker/training/heartbeat.ts";
  const jsonPath = "src/server/worker/training/task-json.ts";
  assert.ok(existsSync(join(repoRoot, heartbeatPath)), `${heartbeatPath} should own worker heartbeat handling`);
  assert.ok(existsSync(join(repoRoot, jsonPath)), `${jsonPath} should own worker task JSON normalization`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const heartbeatSource = readSource(heartbeatPath);
  const jsonSource = readSource(jsonPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/heartbeat"/);
  assert.match(taskApi, /from "@\/server\/worker\/training\/task-json"/);
  assert.doesNotMatch(taskApi, /trainingWorkerTaskHeartbeatRequestSchema/);
  assert.doesNotMatch(taskApi, /export async function heartbeatTrainingWorkerTask/);
  assert.doesNotMatch(taskApi, /function normalizeJson/);
  assert.match(heartbeatSource, /export async function heartbeatTrainingWorkerTask/);
  assert.match(heartbeatSource, /trainingWorkerTaskHeartbeatRequestSchema/);
  assert.match(jsonSource, /export function normalizeWorkerTaskJson/);

  const jsonUrl = new URL(pathToFileURL(join(repoRoot, jsonPath)));
  jsonUrl.searchParams.set("testImport", String(Date.now()));
  const json = await import(jsonUrl.href);

  assert.deepEqual(json.normalizeWorkerTaskJson(null), {});
  assert.deepEqual(json.normalizeWorkerTaskJson(undefined), {});
  assert.deepEqual(json.normalizeWorkerTaskJson("ready"), { value: "ready" });
  assert.deepEqual(json.normalizeWorkerTaskJson({ phase: "training" }), { phase: "training" });
});
