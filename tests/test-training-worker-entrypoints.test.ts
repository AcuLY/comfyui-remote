import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const retiredRouteSlug = ["character", "lora", "training"].join("-");
const retiredPascalPrefix = ["Character", "Lora"].join("");

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
    new RegExp(retiredRouteSlug),
    "training supervisor should not directly launch or import legacy Character LoRA scripts",
  );
});

test("training worker scripts are independent from removed legacy modules", () => {
  const trainingScriptPaths = [
    "scripts/training/image-worker.ts",
    "scripts/training/dataset-freeze-worker.ts",
    "scripts/training/training-worker.ts",
    "scripts/training/worker-common.ts",
    "scripts/training/worker-queue.ts",
  ];

  for (const scriptPath of trainingScriptPaths) {
    const source = readFileSync(join(process.cwd(), scriptPath), "utf8");
    assert.doesNotMatch(source, new RegExp(retiredRouteSlug), `${scriptPath} must not import removed legacy scripts`);
    assert.doesNotMatch(source, new RegExp(retiredPascalPrefix), `${scriptPath} must not expose retired symbols`);
    assert.doesNotMatch(source, /Legacy/, `${scriptPath} must not retain legacy adapter names`);
  }
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
    assert.match(
      result.stdout,
      /TRAINING_MANAGER_API_NAMESPACE[\s\S]*training/,
      `${entrypoint} --help should document the Training worker API namespace default`,
    );
    assert.doesNotMatch(result.stdout, /Character LoRA/i, `${entrypoint} --help should not expose legacy naming`);
    assert.doesNotMatch(result.stderr, /Top-level await/i, `${entrypoint} should not rely on unsupported top-level await`);
  }
});

test("training worker common owns Training manager defaults without legacy env aliases", () => {
  const source = readFileSync(join(process.cwd(), "scripts/training/worker-common.ts"), "utf8");

  assert.match(source, /TRAINING_MANAGER_URL/, "Training worker common should accept a Training-named manager URL");
  assert.match(source, /TRAINING_MANAGER_TOKEN/, "Training worker common should accept a Training-named manager token");
  assert.match(source, /TRAINING_MANAGER_API_NAMESPACE/, "Training worker common should own the API namespace");
  assert.match(source, /http:\/\/127\.0\.0\.1:3000/, "Training manager URL should default to localhost:3000");
  assert.match(source, /x-api-token/, "Training manager requests should send the API token header");
  assert.doesNotMatch(source, /CHARACTER_LORA_MANAGER_URL/);
  assert.doesNotMatch(source, /CHARACTER_LORA_MANAGER_TOKEN/);
  assert.doesNotMatch(source, /importLegacyWorker/);
});

test("training worker common exposes independent manager client helpers for direct imports", async () => {
  const workerCommonUrl = new URL(pathToFileURL(join(process.cwd(), "scripts/training/worker-common.ts")));
  workerCommonUrl.searchParams.set("testImport", String(Date.now()));
  const previousEnv = {
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    TRAINING_MANAGER_API_NAMESPACE: process.env.TRAINING_MANAGER_API_NAMESPACE,
    TRAINING_MANAGER_TOKEN: process.env.TRAINING_MANAGER_TOKEN,
    TRAINING_MANAGER_URL: process.env.TRAINING_MANAGER_URL,
  };

  try {
    process.env.AUTH_TOKEN = "";
    process.env.TRAINING_MANAGER_API_NAMESPACE = "";
    process.env.TRAINING_MANAGER_TOKEN = "training-token-test";
    process.env.TRAINING_MANAGER_URL = "";

    const mod = await import(workerCommonUrl.href);
    assert.equal(typeof mod.parseWorkerCli, "function", "parseWorkerCli export missing");
    assert.equal(typeof mod.resolveManagerAuth, "function", "resolveManagerAuth export missing");
    assert.equal(typeof mod.getManagerBaseUrl, "function", "getManagerBaseUrl export missing");
    assert.equal(typeof mod.getWorkerTaskApiBasePath, "function", "getWorkerTaskApiBasePath export missing");
    assert.equal(typeof mod.createManagerClient, "function", "createManagerClient export missing");

    const auth = await mod.resolveManagerAuth();
    assert.equal(auth.hasToken, true);
    assert.equal(auth.token, "training-token-test");
    assert.equal(auth.headerName, "x-api-token");
    assert.equal(mod.getManagerBaseUrl(), "http://127.0.0.1:3000");
    assert.equal(mod.getWorkerTaskApiBasePath(), "/api/training/worker/tasks");

    const requests: Array<{ url: string; init: RequestInit }> = [];
    const client = mod.createManagerClient({
      fetchImpl: async (url: string, init?: RequestInit) => {
        requests.push({ url, init: init ?? {} });
        return new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      },
    });
    await client.leaseNextTask({ workerType: "training", leaseOwner: "entrypoint-test" });
    assert.equal(requests[0]?.url, "http://127.0.0.1:3000/api/training/worker/tasks/next?workerType=training&leaseOwner=entrypoint-test");
    assert.equal(new Headers(requests[0]?.init.headers).get("x-api-token"), "training-token-test");
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

test("training worker dry-run mock-complete uses Training task lifecycle routes", async () => {
  const requests: Array<{ method: string; path: string; token: string | null; body: unknown }> = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = await readRequestJson(request);
    requests.push({
      body,
      method: request.method ?? "GET",
      path: url.pathname,
      token: request.headers["x-api-token"]?.toString() ?? null,
    });

    if (request.method === "GET" && url.pathname === "/api/training/worker/tasks/next") {
      writeJson(response, 200, {
        ok: true,
        data: {
          id: "training-task-1",
          jobId: "training-project-1",
          workerType: "training",
          targetType: "trainingRun",
          targetId: "training-run-1",
          status: "running",
          payload: { runKind: "training", taskType: "training" },
        },
      });
      return;
    }

    writeJson(response, 200, { ok: true, data: { id: "training-task-1" } });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.notEqual(address, null);
    const addressInfo = address as AddressInfo;

    const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const result = await spawnAndCollect(
      process.execPath,
      [
        tsxCli,
        "scripts/training/training-worker.ts",
        "--once",
        "--dry-run",
        "--mock-complete",
        "--worker-owner",
        "entrypoint-test",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TRAINING_MANAGER_TOKEN: "mock-manager-token",
          TRAINING_MANAGER_URL: `http://127.0.0.1:${addressInfo.port}`,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      requests.map((request) => `${request.method} ${request.path}`),
      [
        "GET /api/training/worker/tasks/next",
        "POST /api/training/worker/tasks/training-task-1/heartbeat",
        "POST /api/training/worker/tasks/training-task-1/heartbeat",
        "POST /api/training/worker/tasks/training-task-1/complete",
      ],
    );
    assert.equal(requests.every((request) => request.token === "mock-manager-token"), true);
    assert.deepEqual((requests[3]?.body as { leaseOwner?: string }).leaseOwner, "entrypoint-test");
    assert.equal(typeof (requests[3]?.body as { output?: { finalSafetensorsArtifact?: unknown } }).output?.finalSafetensorsArtifact, "object");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("training worker supervisor targets Training-named worker task HTTP routes", async () => {
  const workerQueuePath = join(process.cwd(), "scripts/training/worker-queue.ts");
  const workerCommonPath = join(process.cwd(), "scripts/training/worker-common.ts");
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
    "Training worker client should support a Training worker task namespace",
  );
  assert.match(
    workerCommonSource,
    /\/api\/training\/worker\/tasks/,
    "Training worker client should call Training worker task routes",
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

async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  return rawBody ? JSON.parse(rawBody) : null;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function spawnAndCollect(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ status: number | null; stderr: string; stdout: string }> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer | string) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer | string) => stderr.push(Buffer.from(chunk)));
    child.on("close", (status) => {
      resolve({
        status,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
  });
}

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
