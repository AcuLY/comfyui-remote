import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const queueWorkerDocPath = "docs/architecture/system/execution/queue-worker.md";
const executionRouterPath = "docs/architecture/system/execution/README.md";
const systemRouterPath = "docs/architecture/system/README.md";
const architectureRouterPath = "docs/architecture/README.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("queue and worker architecture is owned and routed from the architecture tree", () => {
  for (const path of [queueWorkerDocPath, executionRouterPath, systemRouterPath, architectureRouterPath]) {
    assert.ok(existsSync(join(repoRoot, path)), `${path} should exist`);
  }

  const queueWorkerDoc = readSource(queueWorkerDocPath);
  const executionRouter = readSource(executionRouterPath);
  const systemRouter = readSource(systemRouterPath);
  const architectureRouter = readSource(architectureRouterPath);

  assert.match(queueWorkerDoc, /owner: queue-runtime/);
  assert.match(queueWorkerDoc, /subject: queue-worker-execution/);
  assert.match(queueWorkerDoc, /^## Generation 执行$/m);
  assert.match(queueWorkerDoc, /^## Training 工作进程$/m);
  assert.match(queueWorkerDoc, /^## 失败与恢复边界$/m);
  assert.match(executionRouter, /\[队列与工作进程执行\]\(queue-worker\.md\)/);
  assert.match(systemRouter, /\[执行架构\]\(execution\/README\.md\)/);
  assert.match(architectureRouter, /\[执行架构\]\(system\/execution\/README\.md\)/);
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
  assert.match(comfyService, /2\) config\/workflows\/standard-workflow\.api\.json/);
  assert.match(comfyService, /3\) built-in SDXL txt2img fallback/);
  assert.match(comfyService, /function shouldUseStandardWorkflow\(\)[\s\S]*return true;/);
  assert.match(comfyService, /const standardPrompt = await resolveStandardWorkflowPrompt\(promptDraft\);[\s\S]*apiPrompt = standardPrompt \?\? buildFallbackPromptNodes\(promptDraft\);/);
});

test("training worker lifecycle request schemas validate ownership, heartbeat, and failure payloads", async () => {
  const schemasUrl = new URL(pathToFileURL(join(repoRoot, "src/lib/training/schemas.ts")));
  schemasUrl.searchParams.set("testImport", String(Date.now()));
  const schemas = await import(schemasUrl.href);

  assert.equal(schemas.trainingWorkerTaskLeaseRequestSchema.safeParse({
    leaseOwner: " ",
    workerType: "training",
  }).success, false, "blank lease owner should be rejected at lease time");
  assert.equal(schemas.trainingWorkerTaskHeartbeatRequestSchema.safeParse({
    progressJson: null,
  }).success, false, "heartbeat progress must be an object when provided");
  assert.equal(schemas.trainingWorkerTaskFailRequestSchema.safeParse({
    errorSummary: " ",
  }).success, false, "blank failure summary should be rejected");
  assert.equal(schemas.trainingWorkerTaskFailRequestSchema.safeParse({
    errorSummary: "failed",
    providerError: {
      backendError: " ",
      retryable: false,
    },
  }).success, false, "blank provider backend errors should be rejected");
  assert.equal(schemas.trainingWorkerTaskFailRequestSchema.safeParse({
    errorSummary: "failed",
    providerError: {
      backendError: "backend",
      retryable: false,
      secretToken: "do-not-strip-silently",
    },
  }).success, false, "provider errors should reject unknown fields instead of stripping them");

  const parsed = schemas.trainingWorkerTaskFailRequestSchema.parse({
    errorSummary: " failed ",
    leaseOwner: " worker-1 ",
    providerError: {
      backendError: " backend ",
      httpStatus: 502,
      retryable: true,
    },
  });
  assert.equal(parsed.errorSummary, "failed");
  assert.equal(parsed.leaseOwner, "worker-1");
  assert.equal(parsed.providerError.backendError, "backend");
});

test("training worker task id parsing lives in a dedicated boundary", async () => {
  const taskIdPath = "src/server/worker/training/task-id.ts";
  assert.ok(existsSync(join(repoRoot, taskIdPath)), `${taskIdPath} should own worker task ID parsing`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const taskIdSource = readSource(taskIdPath);
  const taskIdConsumers = [
    readSource("src/server/worker/training/scheduler.ts"),
    readSource("src/server/worker/training/task-serialization.ts"),
    readSource("src/server/worker/training/target-discovery.ts"),
  ].join("\n");
  assert.match(taskIdConsumers, /from "@\/server\/worker\/training\/task-id"/);
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
  const targetDiscoveryConsumers = [
    readSource("src/server/worker/training/completion.ts"),
    readSource("src/server/worker/training/failure.ts"),
    readSource("src/server/worker/training/heartbeat.ts"),
    readSource("src/server/worker/training/leasing.ts"),
    readSource("src/server/worker/training/scheduler.ts"),
  ].join("\n");
  assert.match(targetDiscoveryConsumers, /from "@\/server\/worker\/training\/target-discovery"/);
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
  assert.match(leasingSource, /from "@\/server\/worker\/training\/task-serialization"/);
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
  assert.match(heartbeatSource, /from "@\/server\/worker\/training\/task-json"/);
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

test("training worker completion lives in a dedicated boundary", () => {
  const completionPath = "src/server/worker/training/completion.ts";
  assert.ok(existsSync(join(repoRoot, completionPath)), `${completionPath} should own worker completion handling`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const completionSource = readSource(completionPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/completion"/);
  assert.doesNotMatch(taskApi, /trainingWorkerTaskCompleteRequestSchema/);
  assert.doesNotMatch(taskApi, /export async function completeTrainingWorkerTask/);
  assert.doesNotMatch(taskApi, /export async function completeTrainingRunWorkerTarget/);
  assert.doesNotMatch(taskApi, /export async function completeGenerationTaskWorkerTarget/);
  assert.doesNotMatch(taskApi, /async function completeGenerationTarget/);
  assert.doesNotMatch(taskApi, /async function completeTrainingTarget/);
  assert.doesNotMatch(taskApi, /async function writeArtifact/);
  assert.match(completionSource, /export async function completeTrainingWorkerTask/);
  assert.match(completionSource, /export async function completeTrainingRunWorkerTarget/);
  assert.match(completionSource, /export async function completeGenerationTaskWorkerTarget/);
  assert.match(completionSource, /trainingWorkerTaskCompleteRequestSchema/);
  assert.match(completionSource, /async function completeGenerationTarget/);
  assert.match(completionSource, /async function completeTrainingTarget/);
  assert.match(completionSource, /async function writeArtifact/);
});

test("training worker failure lives in a dedicated boundary", () => {
  const failurePath = "src/server/worker/training/failure.ts";
  assert.ok(existsSync(join(repoRoot, failurePath)), `${failurePath} should own worker failure handling`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const failureSource = readSource(failurePath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/failure"/);
  assert.doesNotMatch(taskApi, /trainingWorkerTaskFailRequestSchema/);
  assert.doesNotMatch(taskApi, /export async function failTrainingWorkerTask/);
  assert.doesNotMatch(taskApi, /export async function failTrainingRunWorkerTarget/);
  assert.doesNotMatch(taskApi, /export async function failGenerationTaskWorkerTarget/);
  assert.doesNotMatch(taskApi, /errorMessage: parsed\.data\.errorSummary/);
  assert.match(failureSource, /export async function failTrainingWorkerTask/);
  assert.match(failureSource, /export async function failTrainingRunWorkerTarget/);
  assert.match(failureSource, /export async function failGenerationTaskWorkerTarget/);
  assert.match(failureSource, /trainingWorkerTaskFailRequestSchema/);
  assert.match(failureSource, /providerError/);
});

test("training worker scheduler lives in a dedicated boundary", () => {
  const schedulerPath = "src/server/worker/training/scheduler.ts";
  assert.ok(existsSync(join(repoRoot, schedulerPath)), `${schedulerPath} should own worker scheduler handling`);

  const taskApi = readSource("src/server/worker/training/task-api.ts");
  const schedulerSource = readSource(schedulerPath);
  assert.match(taskApi, /from "@\/server\/worker\/training\/scheduler"/);
  assert.doesNotMatch(taskApi, /export async function/);
  assert.doesNotMatch(taskApi, /TRAINING_WORKER_TYPES/);
  assert.doesNotMatch(taskApi, /workerTypeForTargetType/);
  assert.doesNotMatch(taskApi, /countWorkerTargets/);
  assert.doesNotMatch(taskApi, /PrismaClientKnownRequestError/);
  assert.match(schedulerSource, /export async function getTrainingWorkerQueueStatus/);
  assert.match(schedulerSource, /export async function tickTrainingWorkerScheduler/);
  assert.match(schedulerSource, /export async function progressTrainingRunWorkerTarget/);
  assert.match(schedulerSource, /TRAINING_WORKER_TYPES/);
  assert.match(schedulerSource, /workerTypeForTargetType/);
  assert.match(schedulerSource, /countWorkerTargets/);
});
