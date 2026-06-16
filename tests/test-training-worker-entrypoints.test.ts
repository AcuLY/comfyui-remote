import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("training worker supervisor has Training-named npm entrypoints", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.["training:workers"], "tsx scripts/training/worker-queue.ts");
  assert.equal(
    packageJson.scripts?.["training:workers:mock"],
    "tsx scripts/training/worker-queue.ts --mock-image --dry-run-training --mock-complete-training",
  );
});

test("training worker supervisor does not expose legacy-only workers by default", () => {
  const workerQueuePath = join(process.cwd(), "scripts/training/worker-queue.ts");
  assert.equal(existsSync(workerQueuePath), true, "scripts/training/worker-queue.ts should exist");

  const source = readFileSync(workerQueuePath, "utf8");
  assert.match(source, /LoRA training worker queue supervisor/);
  assert.match(source, /workerOwner:\s*"training-queue"/);
  assert.match(source, /script:\s*"image-worker\.ts"/);
  assert.match(source, /script:\s*"dataset-freeze-worker\.ts"/);
  assert.match(source, /script:\s*"training-worker\.ts"/);
  assert.doesNotMatch(source, /benchmark-worker\.ts/);
  assert.doesNotMatch(source, /prompt-card-draft-worker\.ts/);
  assert.doesNotMatch(source, /character-lora:workers/);
});

test("training worker supervisor launches Training-named worker scripts", () => {
  const workerQueuePath = join(process.cwd(), "scripts/training/worker-queue.ts");
  const requiredEntrypoints = [
    "scripts/training/image-worker.ts",
    "scripts/training/dataset-freeze-worker.ts",
    "scripts/training/training-worker.ts",
    "scripts/training/worker-common.ts",
  ];

  for (const entrypoint of requiredEntrypoints) {
    assert.equal(existsSync(join(process.cwd(), entrypoint)), true, `${entrypoint} should exist`);
  }

  const source = readFileSync(workerQueuePath, "utf8");
  assert.match(
    source,
    /path\.join\("scripts",\s*"training",\s*spec\.script\)/,
    "training supervisor should spawn Training-owned worker entrypoints",
  );
  assert.match(
    source,
    /from "\.\/worker-common"/,
    "training supervisor should import Training-owned worker CLI helpers",
  );
  assert.doesNotMatch(
    source,
    /character-lora-training/,
    "training supervisor should not directly launch or import legacy Character LoRA scripts",
  );
});

test("training worker entrypoint help commands run under tsx without legacy labels", () => {
  const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const workerEntrypoints = [
    "scripts/training/image-worker.ts",
    "scripts/training/dataset-freeze-worker.ts",
    "scripts/training/training-worker.ts",
  ];

  for (const entrypoint of workerEntrypoints) {
    const result = spawnSync(process.execPath, [tsxCli, entrypoint, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `${entrypoint} --help should exit successfully: ${result.stderr}`);
    assert.match(result.stdout, /LoRA training/i, `${entrypoint} --help should use Training naming`);
    assert.match(result.stdout, /TRAINING_MANAGER_URL/, `${entrypoint} --help should document Training manager URL env`);
    assert.match(result.stdout, /TRAINING_MANAGER_TOKEN/, `${entrypoint} --help should document Training manager token env`);
    assert.doesNotMatch(result.stdout, /Character LoRA/i, `${entrypoint} --help should not expose legacy naming`);
    assert.doesNotMatch(result.stderr, /Top-level await/i, `${entrypoint} should not rely on unsupported top-level await`);
  }
});

test("training worker common maps Training env aliases before loading legacy adapters", () => {
  const source = readFileSync(join(process.cwd(), "scripts/training/worker-common.ts"), "utf8");

  assert.match(source, /TRAINING_MANAGER_URL/, "Training worker common should accept a Training-named manager URL");
  assert.match(source, /TRAINING_MANAGER_TOKEN/, "Training worker common should accept a Training-named manager token");
  assert.match(
    source,
    /CHARACTER_LORA_MANAGER_URL/,
    "Training worker common should bridge manager URL into the current legacy adapter",
  );
  assert.match(
    source,
    /CHARACTER_LORA_MANAGER_TOKEN/,
    "Training worker common should bridge manager token into the current legacy adapter",
  );
  assert.match(
    source,
    /applyTrainingManagerEnvAliases\(\);[\s\S]*input\.importLegacyWorker\(\)/,
    "Training env aliases should be applied before the legacy worker adapter is imported",
  );
});

test("training worker common exposes helper exports with Training env aliases for direct imports", async () => {
  const workerCommonUrl = new URL(pathToFileURL(join(process.cwd(), "scripts/training/worker-common.ts")));
  workerCommonUrl.searchParams.set("testImport", String(Date.now()));
  const previousEnv = {
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    CHARACTER_LORA_MANAGER_TOKEN: process.env.CHARACTER_LORA_MANAGER_TOKEN,
    CHARACTER_LORA_MANAGER_URL: process.env.CHARACTER_LORA_MANAGER_URL,
    TRAINING_MANAGER_TOKEN: process.env.TRAINING_MANAGER_TOKEN,
    TRAINING_MANAGER_URL: process.env.TRAINING_MANAGER_URL,
  };

  try {
    process.env.AUTH_TOKEN = "";
    process.env.CHARACTER_LORA_MANAGER_TOKEN = "";
    process.env.CHARACTER_LORA_MANAGER_URL = "";
    process.env.TRAINING_MANAGER_TOKEN = "training-token-test";
    process.env.TRAINING_MANAGER_URL = "http://training-manager.test";

    const mod = await import(workerCommonUrl.href);
    assert.equal(typeof mod.parseWorkerCli, "function", "parseWorkerCli export missing");
    assert.equal(typeof mod.resolveManagerAuth, "function", "resolveManagerAuth export missing");

    const auth = await mod.resolveManagerAuth();
    assert.equal(auth.hasToken, true);
    assert.equal(auth.token, "training-token-test");
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("training worker supervisor targets Training-named worker task HTTP routes", async () => {
  const workerQueuePath = join(process.cwd(), "scripts/training/worker-queue.ts");
  const workerCommonPath = join(process.cwd(), "scripts/character-lora-training/worker-common.ts");
  const requiredRouteFiles = [
    "src/app/api/training/worker/status/route.ts",
    "src/app/api/training/worker/tasks/next/route.ts",
    "src/app/api/training/worker/tasks/[taskId]/heartbeat/route.ts",
    "src/app/api/training/worker/tasks/[taskId]/complete/route.ts",
    "src/app/api/training/worker/tasks/[taskId]/fail/route.ts",
  ];

  for (const routeFile of requiredRouteFiles) {
    assert.equal(existsSync(join(process.cwd(), routeFile)), true, `${routeFile} should exist`);
  }

  const workerQueueSource = readFileSync(workerQueuePath, "utf8");
  const workerCommonSource = readFileSync(workerCommonPath, "utf8");
  assert.match(
    workerQueueSource,
    /TRAINING_MANAGER_API_NAMESPACE:\s*"training"/,
    "training supervisor should force child workers onto the Training worker task namespace",
  );
  assert.match(
    workerCommonSource,
    /TRAINING_MANAGER_API_NAMESPACE/,
    "shared worker client should support a Training worker task namespace without changing legacy defaults",
  );
  assert.match(
    workerCommonSource,
    /\/api\/training\/worker\/tasks/,
    "shared worker client should be able to call Training worker task routes",
  );
  assert.match(
    workerCommonSource,
    /\/api\/character-lora-training\/worker\/tasks/,
    "shared worker client should keep the old Character LoRA worker task routes as the default",
  );

  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(payload.data.resources.workerTasks.status.path, "/api/training/worker/status");
  assert.equal(payload.data.resources.workerTasks.next.path, "/api/training/worker/tasks/next");
  assert.equal(payload.data.resources.workerTasks.heartbeat.path, "/api/training/worker/tasks/:taskId/heartbeat");
  assert.equal(payload.data.resources.workerTasks.complete.path, "/api/training/worker/tasks/:taskId/complete");
  assert.equal(payload.data.resources.workerTasks.fail.path, "/api/training/worker/tasks/:taskId/fail");
});

test("training API manifest tells agents how to run the training worker supervisor", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(payload.data.workerSupervisor.defaultCommand, "cmd /c npm run training:workers");
  assert.deepEqual(payload.data.workerSupervisor.defaultWorkers, ["image", "dataset-freeze", "training"]);
  assert.equal(
    Object.hasOwn(payload.data.workerSupervisor, "mockCommand"),
    false,
    "agent-facing manifest should not advertise local debug/mock worker commands",
  );
});
