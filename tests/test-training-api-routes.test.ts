import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

const TRAINING_RUN_PRESET_STATE_PATH = join(process.cwd(), "data", "training-run-preset-state.json");
const TRAINING_MANAGED_RUNS_PATH = join(process.cwd(), "data", "training-managed-runs.json");
const TRAINING_PROJECTS_PATH = join(process.cwd(), "data", "training-projects.json");
const TRAINING_TEMPLATES_PATH = join(process.cwd(), "data", "training-templates.json");
const TRAINING_TEMPLATE_ORDER_PATH = join(process.cwd(), "data", "training-template-order.json");
const TRAINING_ROUTE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
const TRAINING_API_OPERATION_PREFIX = " /api/training";
let trainingManagedStoreSnapshotQueue: Promise<unknown> = Promise.resolve();

function cleanTrainingTemplateFallbackFixture() {
  return [
    {
      id: "training-base",
      title: "角色 LoRA 基础模板",
      status: "active",
      updatedAt: "10:00",
      description: "干净的测试基线模板，避免读取本地运行时 fallback 数据。",
      imageGuidance: "生成稳定、清晰的角色训练图。",
      captionGuidance: "先写触发词，再写姿态、服装和光线。",
      sectionCount: 1,
      sections: [
        {
          id: "training-base-section",
          title: "基础小节",
          enabled: true,
          blockCount: 1,
          blocks: [
            {
              id: "training-base-block",
              source: "本地",
              title: "基础场景",
              text: "干净角色训练图，身份稳定，背景简单。",
            },
          ],
          resolvedScene: "干净角色训练图，身份稳定，背景简单。",
          scenePreview: "干净角色训练图",
        },
      ],
    },
    {
      id: "training-clean-secondary",
      title: "补充训练模板",
      status: "active",
      updatedAt: "10:01",
      description: "用于验证模板列表和排序的第二条干净 fixture。",
      imageGuidance: "生成补充角度训练图。",
      captionGuidance: "记录角度、镜头和背景控制。",
      sectionCount: 1,
      sections: [
        {
          id: "training-clean-secondary-section",
          title: "补充小节",
          enabled: true,
          blockCount: 1,
          blocks: [
            {
              id: "training-clean-secondary-block",
              source: "本地",
              title: "补充场景",
              text: "补充角度训练图，轮廓清楚，遮挡较少。",
            },
          ],
          resolvedScene: "补充角度训练图，轮廓清楚，遮挡较少。",
          scenePreview: "补充角度训练图",
        },
      ],
    },
  ];
}

async function listRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(entryPath);
    return entry.name === "route.ts" ? [entryPath] : [];
  }));
  return nested.flat();
}

function routeFileToTrainingApiPath(filePath: string) {
  const root = join(process.cwd(), "src", "app", "api", "training");
  const routeRelativePath = relative(root, filePath);
  if (routeRelativePath === "route.ts") return "/api/training";

  const routePath = routeRelativePath.replace(/\/route\.ts$/, "");
  const segments = routePath.split("/").map((segment) => {
    const dynamic = segment.match(/^\[(.+)\]$/);
    return dynamic ? `:${dynamic[1]}` : segment;
  });
  return `/api/training/${segments.join("/")}`;
}

function collectRouteExportedMethods(source: string) {
  const methods = new Set<string>();

  for (const match of source.matchAll(/^export async function (GET|POST|PATCH|DELETE|PUT)/gm)) {
    methods.add(match[1]);
  }

  for (const match of source.matchAll(/^export \{([^}]+)\} from /gm)) {
    for (const item of match[1].split(",")) {
      const exportedName = item.trim().split(/\s+as\s+/i).pop()?.trim();
      if (exportedName && TRAINING_ROUTE_METHODS.has(exportedName)) {
        methods.add(exportedName);
      }
    }
  }

  return [...methods];
}

async function listRouteOperations() {
  const routeFiles = await listRouteFiles(join(process.cwd(), "src", "app", "api", "training"));
  return routeFiles.flatMap((filePath) => {
    const routePath = routeFileToTrainingApiPath(filePath);
    if (routePath === "/api/training") return [];

    const source = readFileSync(filePath, "utf8");
    return collectRouteExportedMethods(source).map((method) => `${method} ${routePath}`);
  }).sort();
}

function collectManifestPaths(value: unknown, paths = new Set<string>()) {
  if (typeof value === "string" && value.startsWith("/api/training")) {
    paths.add(value.split("?")[0] ?? value);
    return paths;
  }
  if (!value || typeof value !== "object") return paths;
  if ("path" in value && typeof value.path === "string") {
    paths.add(value.path.split("?")[0] ?? value.path);
  }

  for (const child of Object.values(value)) {
    collectManifestPaths(child, paths);
  }

  return paths;
}

function collectManifestOperations(value: unknown, operations = new Set<string>()) {
  if (!value || typeof value !== "object") return operations;
  if (
    "method" in value
    && typeof value.method === "string"
    && "path" in value
    && typeof value.path === "string"
  ) {
    operations.add(`${value.method} ${value.path.split("?")[0] ?? value.path}`);
  }

  for (const child of Object.values(value)) {
    collectManifestOperations(child, operations);
  }

  return operations;
}

function operationMatchesPattern(operation: string, pattern: string) {
  const [operationMethod, operationPath] = operation.split(" ");
  const [patternMethod, patternPath] = pattern.split(" ");
  if (operationMethod !== patternMethod || !operationPath || !patternPath) return false;

  const operationSegments = operationPath.split("/").filter(Boolean);
  const patternSegments = patternPath.split("/").filter(Boolean);
  return (
    operationSegments.length === patternSegments.length
    && operationSegments.every((segment, index) => (
      segment === patternSegments[index]
      || segment.startsWith(":")
      || patternSegments[index].startsWith(":")
    ))
  );
}

function collectBackendDesignOperations() {
  const designSource = readFileSync(
    join(process.cwd(), "docs", "plans", "2026-06-07-manager-lora-training-backend-api-schema-design.md"),
    "utf8",
  );
  return [...designSource.matchAll(/\| `(GET|POST|PATCH|DELETE|PUT)` \| `([^`]+)` \|/g)]
    .map((match) => `${match[1]} ${match[2]}`);
}

async function listProjects() {
  const { GET } = await import("../src/app/api/training/projects/route");
  const response = await GET(new Request("http://localhost/api/training/projects"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data));
  assert.ok(payload.data.length > 0);

  return payload.data as Array<{ id: string; sectionCount?: number; imageCount?: number }>;
}

function pickProjectWithSections(projects: Array<{ id: string; sectionCount?: number; imageCount?: number }>) {
  return (
    projects.find((project) => (project.sectionCount ?? 0) > 0)
    ?? projects[0]
  );
}

async function clearTrainingRunPresetState(runId: string) {
  try {
    const raw = await readFile(TRAINING_RUN_PRESET_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed[runId]) {
      return;
    }
    delete parsed[runId];
    await writeFile(TRAINING_RUN_PRESET_STATE_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function restoreOptionalFile(path: string, contents: string | null) {
  if (contents === null) {
    await rm(path, { force: true });
    return;
  }
  await writeFile(path, contents, "utf8");
}

async function withTrainingManagedStoreSnapshot<T>(fn: () => Promise<T>) {
  const run = async () => {
    const [runsBefore, projectsBefore, templatesBefore, templateOrderBefore] = await Promise.all([
      readOptionalFile(TRAINING_MANAGED_RUNS_PATH),
      readOptionalFile(TRAINING_PROJECTS_PATH),
      readOptionalFile(TRAINING_TEMPLATES_PATH),
      readOptionalFile(TRAINING_TEMPLATE_ORDER_PATH),
    ]);

    try {
      await Promise.all([
        writeFile(TRAINING_MANAGED_RUNS_PATH, "[]\n", "utf8"),
        writeFile(TRAINING_PROJECTS_PATH, "[]\n", "utf8"),
        writeFile(TRAINING_TEMPLATES_PATH, JSON.stringify(cleanTrainingTemplateFallbackFixture(), null, 2) + "\n", "utf8"),
        rm(TRAINING_TEMPLATE_ORDER_PATH, { force: true }),
      ]);
      return await fn();
    } finally {
      await Promise.all([
        restoreOptionalFile(TRAINING_MANAGED_RUNS_PATH, runsBefore),
        restoreOptionalFile(TRAINING_PROJECTS_PATH, projectsBefore),
        restoreOptionalFile(TRAINING_TEMPLATES_PATH, templatesBefore),
        restoreOptionalFile(TRAINING_TEMPLATE_ORDER_PATH, templateOrderBefore),
      ]);
    }
  };

  const next = trainingManagedStoreSnapshotQueue.then(run, run);
  trainingManagedStoreSnapshotQueue = next.then(() => undefined, () => undefined);
  return next;
}

function isProductionTrainingDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003/i.test(message);
}

test("training managed store snapshot restores template fallback data", async () => {
  const before = await readOptionalFile(TRAINING_TEMPLATES_PATH);

  await withTrainingManagedStoreSnapshot(async () => {
    await writeFile(
      TRAINING_TEMPLATES_PATH,
      `${JSON.stringify([
        {
          id: "leaked-training-template",
          title: "Leaked Training Template",
          status: "active",
          updatedAt: "10:00",
          description: "This temporary template must not survive the test snapshot.",
          sectionCount: 0,
          sections: [],
        },
      ], null, 2)}\n`,
      "utf8",
    );
  });

  assert.equal(
    await readOptionalFile(TRAINING_TEMPLATES_PATH),
    before,
    "Training API tests that create templates must restore the local template fallback file.",
  );
});

async function listRuns(query = "") {
  const { GET } = await import("../src/app/api/training/runs/route");
  const response = await GET(new Request(`http://localhost/api/training/runs${query}`));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data));

  return payload.data as Array<{ id: string; kind: string; projectId: string; status: string }>;
}

test("GET /api/training exposes a machine-readable workflow manifest", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.module, "training");
  assert.equal(payload.data.entrypoints.models, "/api/models?kind=checkpoint");
  assert.equal(payload.data.entrypoints.projects, "/api/training/projects");
  assert.equal(payload.data.entrypoints.runs, "/api/training/runs");
  assert.ok(Array.isArray(payload.data.workflows));
  assert.ok(payload.data.workflows.length >= 4);
  assert.ok(payload.data.workflows.some((workflow: { id: string }) => workflow.id === "training_execution"));
  assert.equal(
    payload.data.resources.projects.reorder.path,
    "/api/training/projects/reorder",
  );
  assert.equal(
    payload.data.resources.templates.reorder.path,
    "/api/training/templates/reorder",
  );
  assert.equal(
    payload.data.resources.models.checkpoints.path,
    "/api/models?kind=checkpoint",
  );
});

test("GET /api/training manifest declares module-owned resources and shared exceptions", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.resourceBoundary.moduleOwnedResources, {
    runs: { uiRoute: "/training/runs", apiEntrypoint: "/api/training/runs" },
    projects: { uiRoute: "/training/projects", apiEntrypoint: "/api/training/projects" },
    presets: { uiRoute: "/training/presets", apiEntrypoint: "/api/training/presets" },
    templates: { uiRoute: "/training/templates", apiEntrypoint: "/api/training/templates" },
  });
  assert.deepEqual(payload.data.resourceBoundary.sharedResources, {
    models: {
      uiRoute: "/assets/models",
      apiEntrypoints: [
        "/api/models?kind=checkpoint",
        "/api/models?kind=lora",
        "/api/models",
        "/api/models/browse",
        "/api/models/hash",
        "/api/models/move",
        "/api/models/notes",
        "/api/loras",
        "/api/loras/browse",
        "/api/loras/move",
        "/api/loras/notes",
      ],
    },
    settings: { uiRoute: "/settings", apiEntrypoints: [] },
  });
  assert.deepEqual(payload.data.resourceBoundary.forbiddenGenerationEntrypoints, [
    "/api/agent/projects",
    "/api/agent/runs",
    "/api/image-review",
    "/api/images",
    "/api/project-create-options",
    "/api/project-folders",
    "/api/preset-library",
    "/api/projects",
    "/api/presets",
    "/api/queue",
    "/api/queue-data",
    "/api/runs",
    "/api/templates",
    "/api/worker",
  ]);
  assert.deepEqual(payload.data.resourceBoundary.forbiddenGenerationUiRoutes, [
    "/queue",
    "/projects",
    "/assets/presets",
    "/assets/preset-groups",
    "/assets/templates",
  ]);
  assert.deepEqual(payload.data.resourceBoundary.forbiddenTrainingUiRoutes, []);
  assert.match(
    payload.data.resourceBoundary.guidance,
    /Only models and settings are shared/i,
  );
});

test("GET /api/training manifest exposes production worker supervisor metadata without mock commands", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.workerSupervisor, {
    defaultCommand: "cmd /c npm run training:workers",
    defaultWorkers: ["image", "dataset-freeze", "training"],
    script: "scripts/training/worker-queue.ts",
  });
  assert.equal(Object.hasOwn(payload.data.workerSupervisor, "mockCommand"), false);
  assert.doesNotMatch(
    JSON.stringify(payload.data.workerSupervisor),
    /training:workers:mock|mockCommand/i,
    "agent-facing training manifest should not advertise debug/mock worker commands",
  );
});

test("GET /api/training manifest exposes scheduler and worker operations for agent-driven execution", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerExecutionWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "worker_execution"
  );

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(workerExecutionWorkflow, "agent manifest should include a worker execution workflow");
  assert.deepEqual(
    workerExecutionWorkflow.steps.slice(0, 4).map((step: { method: string; path: string }) => `${step.method} ${step.path}`),
    [
      "GET /api/training/worker/status",
      "GET /api/training/worker/tasks/next",
      "POST /api/training/worker/tasks/:taskId/heartbeat",
      "POST /api/training/worker/tasks/:taskId/complete",
    ],
    "worker execution workflow should start with the Training worker task lease/heartbeat/complete lifecycle",
  );
  assert.ok(
    workerExecutionWorkflow.steps.some((step: { method: string; path: string }) =>
      step.method === "POST" && step.path === "/api/training/worker/tasks/:taskId/fail"
    ),
    "worker execution workflow should expose the Training worker task failure callback",
  );
  assert.equal(
    payload.data.resources.scheduler.tick.path,
    "/api/training/scheduler/tick",
    "agent manifest should expose the scheduler tick needed to advance queued work",
  );
  assert.equal(
    payload.data.resources.worker.generation.complete.path,
    "/api/training/worker/generation-tasks/:taskId/complete",
    "agent manifest should expose generation completion callbacks",
  );
  assert.equal(
    payload.data.resources.worker.training.progress.path,
    "/api/training/worker/training-runs/:trainingRunId/progress",
    "agent manifest should expose training progress callbacks",
  );
  assert.equal(
    payload.data.resources.worker.training.complete.path,
    "/api/training/worker/training-runs/:trainingRunId/complete",
    "agent manifest should expose training completion callbacks",
  );
  assert.ok(
    workerExecutionWorkflow,
    "agent manifest should include a worker execution workflow in addition to public UI workflows",
  );
});

test("GET /api/training worker execution workflow declares machine-actionable task metadata", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerExecutionWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "worker_execution"
  ) as {
    steps: Array<{
      id?: string;
      path: string;
      requires?: string[];
      pathParams?: Record<string, string>;
      queryParamSchema?: {
        requiredFields?: string[];
        optionalFields?: string[];
        enumValues?: Record<string, string[]>;
      };
      requestBody?: {
        contentType?: string;
        requiredFields?: string[];
        optionalFields?: string[];
      };
      produces?: string[];
      responsePaths?: Record<string, string>;
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(workerExecutionWorkflow, "agent manifest should include the worker execution workflow");

  const steps = new Map(workerExecutionWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("lease_worker_task")?.queryParamSchema,
    {
      requiredFields: ["workerType"],
      optionalFields: ["leaseOwner", "leaseDurationSeconds", "targetType", "targetId"],
      enumValues: {
        workerType: [
          "image_generation",
          "dataset_freeze",
          "training",
        ],
      },
    },
    "Generic worker leases should declare query params and workerType values instead of forcing agents to infer them.",
  );
  assert.deepEqual(steps.get("lease_worker_task")?.produces, [
    "workerTaskId",
    "workerTaskTargetType",
    "workerTaskTargetId",
  ]);
  assert.deepEqual(steps.get("lease_worker_task")?.responsePaths, {
    workerTaskId: "$.data.id",
    workerTaskTargetType: "$.data.targetType",
    workerTaskTargetId: "$.data.targetId",
  });

  assert.deepEqual(
    steps.get("heartbeat_worker_task"),
    {
      id: "heartbeat_worker_task",
      description: "Heartbeat a leased worker task and optionally extend the lease or report structured progress.",
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/heartbeat",
      requires: ["workerTaskId"],
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["leaseOwner", "leaseDurationSeconds", "progressJson"],
      },
    },
  );
  assert.deepEqual(
    steps.get("complete_worker_task"),
    {
      id: "complete_worker_task",
      description: "Mark a leased worker task complete after the domain-specific callback has persisted outputs.",
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/complete",
      requires: ["workerTaskId"],
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["leaseOwner", "output"],
      },
    },
  );
  assert.deepEqual(
    steps.get("fail_worker_task"),
    {
      id: "fail_worker_task",
      description: "Mark a leased worker task failed with a concise error summary and optional provider details.",
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/fail",
      requires: ["workerTaskId"],
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        requiredFields: ["errorSummary"],
        optionalFields: ["leaseOwner", "providerError"],
      },
    },
  );
});

test("GET /api/training worker execution lease declares domain target handoffs", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerExecutionWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "worker_execution"
  ) as {
    steps: Array<{
      id?: string;
      requires?: string[];
      produces?: string[];
      responsePaths?: Record<string, string>;
      conditionalProduces?: Array<{
        when: Record<string, string>;
        produces: string[];
        responsePaths: Record<string, string>;
      }>;
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(workerExecutionWorkflow, "agent manifest should include the worker execution workflow");

  const steps = new Map(workerExecutionWorkflow.steps.map((step) => [step.id, step]));
  const leaseWorkerTask = steps.get("lease_worker_task");

  assert.deepEqual(
    leaseWorkerTask?.produces,
    ["workerTaskId", "workerTaskTargetType", "workerTaskTargetId"],
    "Worker leases should expose the target fields returned by the worker task API.",
  );
  assert.deepEqual(
    leaseWorkerTask?.responsePaths,
    {
      workerTaskId: "$.data.id",
      workerTaskTargetType: "$.data.targetType",
      workerTaskTargetId: "$.data.targetId",
    },
    "Worker leases should map target handoffs from the serialized worker task response.",
  );
  assert.deepEqual(
    leaseWorkerTask?.conditionalProduces,
    [
      {
        when: { workerTaskTargetType: "generationRun" },
        produces: ["generationTaskId"],
        responsePaths: { generationTaskId: "$.data.targetId" },
      },
      {
        when: { workerTaskTargetType: "trainingRun" },
        produces: ["trainingRunId"],
        responsePaths: { trainingRunId: "$.data.targetId" },
      },
    ],
    "Worker leases should declare how target ids satisfy domain-specific callback steps.",
  );

  const conditionalProduces = leaseWorkerTask?.conditionalProduces?.flatMap((handoff) => handoff.produces) ?? [];
  assert.ok(
    conditionalProduces.includes(steps.get("complete_generation_domain_task")?.requires?.[0] ?? ""),
    "Generation completion should be satisfiable from the leased worker target id.",
  );
  assert.ok(
    conditionalProduces.includes(steps.get("report_training_domain_progress")?.requires?.[0] ?? ""),
    "Training progress should be satisfiable from the leased worker target id.",
  );
});

test("GET /api/training worker execution workflow declares domain callback metadata", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerExecutionWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "worker_execution"
  ) as {
    steps: Array<{
      id?: string;
      description?: string;
      method: string;
      path: string;
      requires?: string[];
      pathParams?: Record<string, string>;
      requestBody?: {
        contentType?: string;
        optionalFields?: string[];
      };
      produces?: string[];
      responsePaths?: Record<string, string>;
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(workerExecutionWorkflow, "agent manifest should include the worker execution workflow");

  const steps = new Map(workerExecutionWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("complete_generation_domain_task"),
    {
      id: "complete_generation_domain_task",
      description: "Persist generated outputs on the generation task before completing the leased worker task.",
      method: "POST",
      path: "/api/training/worker/generation-tasks/:taskId/complete",
      requires: ["generationTaskId"],
      pathParams: { taskId: "generationTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["resultImageResultId", "captionDraft", "reviewStatus"],
      },
      produces: ["outputId", "imageResultId"],
      responsePaths: {
        outputId: "$.data.outputResultIds[0]",
        imageResultId: "$.data.outputResultIds[0]",
      },
    },
  );
  assert.deepEqual(
    steps.get("fail_generation_domain_task"),
    {
      id: "fail_generation_domain_task",
      description: "Persist a generation task failure before failing the leased worker task.",
      method: "POST",
      path: "/api/training/worker/generation-tasks/:taskId/fail",
      requires: ["generationTaskId"],
      pathParams: { taskId: "generationTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["errorSummary"],
      },
    },
  );
  assert.deepEqual(
    steps.get("report_training_domain_progress"),
    {
      id: "report_training_domain_progress",
      description: "Persist visible training progress on the training run while the worker is active.",
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/progress",
      requires: ["trainingRunId"],
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["currentStep", "targetSteps", "schedulerMessage"],
      },
    },
  );
  assert.deepEqual(
    steps.get("complete_training_domain_run"),
    {
      id: "complete_training_domain_run",
      description: "Persist the final LoRA artifact on the training run before completing the leased worker task.",
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/complete",
      requires: ["trainingRunId"],
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["artifactName"],
      },
      produces: ["finalLoraArtifactId"],
      responsePaths: { finalLoraArtifactId: "$.data.finalLoraArtifactId" },
    },
  );
  assert.deepEqual(
    steps.get("fail_training_domain_run"),
    {
      id: "fail_training_domain_run",
      description: "Persist a training run failure before failing the leased worker task.",
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/fail",
      requires: ["trainingRunId"],
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["errorSummary"],
      },
    },
  );
});

test("GET /api/training worker task resources declare request and response contracts", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerTasks = payload.data.resources.workerTasks;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    workerTasks.next,
    {
      method: "GET",
      path: "/api/training/worker/tasks/next",
      queryParamSchema: {
        requiredFields: ["workerType"],
        optionalFields: ["leaseOwner", "leaseDurationSeconds", "targetType", "targetId"],
        enumValues: {
          workerType: [
            "image_generation",
            "dataset_freeze",
            "training",
          ],
        },
      },
      produces: ["workerTaskId", "workerTaskTargetType", "workerTaskTargetId"],
      responsePaths: {
        workerTaskId: "$.data.id",
        workerTaskTargetType: "$.data.targetType",
        workerTaskTargetId: "$.data.targetId",
      },
      conditionalProduces: [
        {
          when: { workerTaskTargetType: "generationRun" },
          produces: ["generationTaskId"],
          responsePaths: { generationTaskId: "$.data.targetId" },
        },
        {
          when: { workerTaskTargetType: "trainingRun" },
          produces: ["trainingRunId"],
          responsePaths: { trainingRunId: "$.data.targetId" },
        },
      ],
    },
    "workerTasks.next should be directly executable from resources metadata without reading workflow prose.",
  );
  assert.deepEqual(
    workerTasks.heartbeat,
    {
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/heartbeat",
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["leaseOwner", "leaseDurationSeconds", "progressJson"],
      },
    },
  );
  assert.deepEqual(
    workerTasks.complete,
    {
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/complete",
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["leaseOwner", "output"],
      },
    },
  );
  assert.deepEqual(
    workerTasks.fail,
    {
      method: "POST",
      path: "/api/training/worker/tasks/:taskId/fail",
      pathParams: { taskId: "workerTaskId" },
      requestBody: {
        contentType: "application/json",
        requiredFields: ["errorSummary"],
        optionalFields: ["leaseOwner", "providerError"],
      },
    },
  );
});

test("worker task lease contract accepts target filters for exact agent leases", async () => {
  const { trainingWorkerTaskLeaseRequestSchema } = await import("../src/lib/training/schemas");
  const parsed = trainingWorkerTaskLeaseRequestSchema.parse({
    workerType: "image_generation",
    leaseOwner: "agent",
    leaseDurationSeconds: 120,
    targetType: "generationRun",
    targetId: "generation-run-1",
  });

  assert.equal(parsed.targetType, "generationRun");
  assert.equal(parsed.targetId, "generation-run-1");
});

test("worker task lease route and repository preserve target filter query params", async () => {
  const routeSource = await readFile(
    join(process.cwd(), "src", "app", "api", "training", "worker", "tasks", "next", "route.ts"),
    "utf8",
  );
  const serviceSource = await readFile(
    join(process.cwd(), "src", "server", "services", "character-lora-training", "phase3-service.ts"),
    "utf8",
  );
  const repositorySource = await readFile(
    join(process.cwd(), "src", "server", "repositories", "character-lora-training", "worker-task-repository.ts"),
    "utf8",
  );

  assert.match(routeSource, /targetType:\s*searchParams\.get\("targetType"\)\s*\?\?\s*undefined/);
  assert.match(routeSource, /targetId:\s*searchParams\.get\("targetId"\)\s*\?\?\s*undefined/);
  assert.match(serviceSource, /targetType:\s*parsed\.targetType/);
  assert.match(serviceSource, /targetId:\s*parsed\.targetId/);
  assert.match(repositorySource, /targetType:\s*input\.targetType/);
  assert.match(repositorySource, /targetId:\s*input\.targetId/);
});

test("GET /api/training domain worker callback resources declare request and response contracts", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const workerResources = payload.data.resources.worker;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    workerResources.generation.complete,
    {
      method: "POST",
      path: "/api/training/worker/generation-tasks/:taskId/complete",
      pathParams: { taskId: "generationTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["resultImageResultId", "captionDraft", "reviewStatus"],
      },
      produces: ["outputId", "imageResultId"],
      responsePaths: {
        outputId: "$.data.outputResultIds[0]",
        imageResultId: "$.data.outputResultIds[0]",
      },
    },
    "generation worker completion should document the generation task id binding and output handoffs.",
  );
  assert.deepEqual(
    workerResources.generation.fail,
    {
      method: "POST",
      path: "/api/training/worker/generation-tasks/:taskId/fail",
      pathParams: { taskId: "generationTaskId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["errorSummary"],
      },
    },
  );
  assert.deepEqual(
    workerResources.training.progress,
    {
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/progress",
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["currentStep", "targetSteps", "schedulerMessage"],
      },
    },
  );
  assert.deepEqual(
    workerResources.training.complete,
    {
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/complete",
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["artifactName"],
      },
      produces: ["finalLoraArtifactId"],
      responsePaths: { finalLoraArtifactId: "$.data.finalLoraArtifactId" },
    },
  );
  assert.deepEqual(
    workerResources.training.fail,
    {
      method: "POST",
      path: "/api/training/worker/training-runs/:trainingRunId/fail",
      pathParams: { trainingRunId: "trainingRunId" },
      requestBody: {
        contentType: "application/json",
        optionalFields: ["errorSummary"],
      },
    },
  );
});

test("GET /api/training manifest exposes an end-to-end HTTP workflow for agents", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  );

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(
    fullWorkflow,
    "agent manifest should include a complete project-to-trained-LoRA HTTP workflow",
  );
  assert.deepEqual(
    fullWorkflow.steps.map((step: { method: string; path: string }) => `${step.method} ${step.path}`),
    [
      "POST /api/training/projects",
      "POST /api/training/projects/:projectId/reference-images",
      "PATCH /api/training/projects/:projectId/profile",
      "POST /api/training/projects/:projectId/sections",
      "POST /api/training/sections/:sectionId/blocks",
      "POST /api/training/projects/:projectId/generation-tasks",
      "POST /api/training/generation-tasks/:taskId/inputs",
      "POST /api/training/generation-tasks/:taskId/preview",
      "POST /api/training/generation-tasks/:taskId/run",
      "POST /api/training/scheduler/tick",
      "GET /api/training/worker/tasks/next",
      "POST /api/training/worker/tasks/:taskId/heartbeat",
      "POST /api/training/worker/generation-tasks/:taskId/complete",
      "POST /api/training/worker/tasks/:taskId/complete",
      "GET /api/training/generation-tasks/:taskId/outputs",
      "POST /api/training/generation-outputs/:outputId/apply",
      "POST /api/training/image-results/:imageResultId/review",
      "POST /api/training/projects/:projectId/captions/generate",
      "GET /api/training/projects/:projectId/dataset-readiness",
      "POST /api/training/projects/:projectId/dataset-revisions",
      "POST /api/training/projects/:projectId/training-runs",
      "POST /api/training/scheduler/tick",
      "GET /api/training/worker/tasks/next",
      "POST /api/training/worker/tasks/:taskId/heartbeat",
      "POST /api/training/worker/training-runs/:trainingRunId/progress",
      "POST /api/training/worker/training-runs/:trainingRunId/complete",
      "POST /api/training/worker/tasks/:taskId/complete",
      "POST /api/training/training-runs/:trainingRunId/poll",
      "POST /api/training/training-runs/:trainingRunId/cleanup",
      "POST /api/training/training-runs/:trainingRunId/create-preset",
    ],
    "agent workflow should enumerate the full HTTP-only path from project setup through LoRA preset creation",
  );
});

test("GET /api/training full workflow create-project step supports blank project creation", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as { steps: Array<{ id?: string; requestBody?: { requiredFields?: string[]; optionalFields?: string[] } }> } | undefined;
  const createProjectStep = fullWorkflow?.steps.find((step) => step.id === "create_project");

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(createProjectStep, "agent workflow should declare a create_project step");
  assert.deepEqual(
    createProjectStep.requestBody?.requiredFields,
    ["title", "triggerToken", "checkpointRelativePath"],
    "Blank training project creation should not require template ids.",
  );
  assert.ok(
    createProjectStep.requestBody?.optionalFields?.includes("templateId")
      && createProjectStep.requestBody.optionalFields.includes("trainingTemplateId"),
    "Template ids should remain optional when an agent wants to seed from a template.",
  );
});

test("GET /api/training full workflow steps include machine-actionable handoff metadata", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as { steps: Array<{ description?: string; id?: string; produces?: string[]; requires?: string[] }> } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const stepIds = fullWorkflow.steps.map((step) => step.id);

  assert.deepEqual(
    fullWorkflow.steps.filter((step) => !step.id || !step.description),
    [],
    "Every full workflow step should have a stable id and execution description for agents.",
  );
  assert.equal(
    new Set(stepIds).size,
    stepIds.length,
    "Full workflow step ids should be unique so agents can persist checkpoints.",
  );
  assert.ok(
    fullWorkflow.steps.some((step) => step.produces?.includes("projectId")),
    "Full workflow should declare where the projectId is produced.",
  );
  assert.ok(
    fullWorkflow.steps.some((step) => step.requires?.includes("projectId")),
    "Full workflow should declare which later steps require projectId.",
  );
  assert.ok(
    fullWorkflow.steps.some((step) => step.produces?.includes("taskId")),
    "Full workflow should declare where generation task ids are produced.",
  );
  assert.ok(
    fullWorkflow.steps.some((step) => step.produces?.includes("trainingRunId")),
    "Full workflow should declare where trainingRunId is produced.",
  );
  assert.ok(
    fullWorkflow.steps.some((step) => step.produces?.includes("presetId")),
    "Full workflow should declare where the reusable preset id is produced.",
  );
});

test("GET /api/training full workflow disambiguates reused route parameter names for agents", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as { steps: Array<{ id?: string; path: string; pathParams?: Record<string, string>; requires?: string[] }> } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  assert.deepEqual(
    fullWorkflow.steps
      .filter((step) => step.path.includes("/worker/tasks/:taskId/"))
      .map((step) => [step.id, step.pathParams?.taskId]),
    [
      ["heartbeat_generation_worker_task", "workerTaskId"],
      ["complete_generation_worker_task", "workerTaskId"],
      ["heartbeat_training_worker_task", "workerTaskId"],
      ["complete_training_worker_task", "workerTaskId"],
    ],
    "Worker task routes reuse :taskId, so workflow metadata must bind it to workerTaskId instead of a generation task id.",
  );

  assert.deepEqual(
    fullWorkflow.steps
      .filter((step) => step.pathParams)
      .filter((step) => Object.values(step.pathParams ?? {}).some((handoffId) => !step.requires?.includes(handoffId)))
      .map((step) => step.id),
    [],
    "Every declared path parameter binding should point at a required handoff id that the agent already has.",
  );
});

test("GET /api/training full workflow declares every dynamic path parameter binding", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as { steps: Array<{ id?: string; path: string; pathParams?: Record<string, string>; requires?: string[] }> } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const missingParamBindings = fullWorkflow.steps.flatMap((step) => {
    const params = [...step.path.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1]);
    return params
      .filter((param) => !step.pathParams?.[param])
      .map((param) => `${step.id ?? step.path}:${param}`);
  });

  assert.deepEqual(
    missingParamBindings,
    [],
    "Every dynamic full-workflow path parameter should declare which handoff id fills it.",
  );

  const pathParamsWithoutRequiredHandoff = fullWorkflow.steps
    .filter((step) => step.pathParams)
    .flatMap((step) => Object.entries(step.pathParams ?? {})
      .filter(([, handoffId]) => !step.requires?.includes(handoffId))
      .map(([param, handoffId]) => `${step.id ?? step.path}:${param}->${handoffId}`));

  assert.deepEqual(
    pathParamsWithoutRequiredHandoff,
    [],
    "Every path parameter binding should reference a handoff id listed in the same step's requires array.",
  );
});

test("GET /api/training full workflow declares response paths for every produced handoff", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as { steps: Array<{ id?: string; produces?: string[]; responsePaths?: Record<string, string> }> } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const missingResponsePaths = fullWorkflow.steps.flatMap((step) => (
    step.produces ?? []
  ).filter((handoffId) => !step.responsePaths?.[handoffId])
    .map((handoffId) => `${step.id ?? "unknown"}:${handoffId}`));

  assert.deepEqual(
    missingResponsePaths,
    [],
    "Every produced handoff should declare the JSON response path an agent can extract after the step completes.",
  );

  const responsePathByStep = new Map(fullWorkflow.steps.map((step) => [step.id, step.responsePaths ?? {}]));

  assert.deepEqual(
    Object.fromEntries(responsePathByStep.entries()),
    {
      create_project: { projectId: "$.data.id" },
      upload_reference_image: { imageId: "$.data.id" },
      save_profile: {},
      create_section: { sectionId: "$.data.id" },
      add_scene_block: { blockId: "$.data.id" },
      create_generation_task: { taskId: "$.data.id" },
      attach_generation_inputs: {},
      preview_generation_task: { preview: "$.data" },
      run_generation_task: { queuedGenerationTaskId: "$.data.id" },
      tick_generation_scheduler: { workerTaskQueued: "$.data.id" },
      lease_generation_worker_task: {
        workerTaskId: "$.data.id",
        workerTaskTargetId: "$.data.targetId",
        workerTaskTargetType: "$.data.targetType",
      },
      heartbeat_generation_worker_task: {},
      complete_generation_task: {
        imageResultId: "$.data.outputResultIds[0]",
        outputId: "$.data.outputResultIds[0]",
      },
      complete_generation_worker_task: {},
      list_generation_outputs: {
        imageResultId: "$.data[0].id",
        outputId: "$.data[0].id",
      },
      apply_output_to_reference: { imageId: "$.data.result.id" },
      review_image_result: {},
      generate_missing_captions: {},
      read_dataset_readiness: {},
      freeze_dataset_revision: { revisionId: "$.data.revision.id" },
      create_training_run: { trainingRunId: "$.data.id" },
      tick_training_scheduler: { workerTaskQueued: "$.data.id" },
      lease_training_worker_task: {
        workerTaskId: "$.data.id",
        workerTaskTargetId: "$.data.targetId",
        workerTaskTargetType: "$.data.targetType",
      },
      heartbeat_training_worker_task: {},
      report_training_progress: {},
      complete_training_run: { finalLoraArtifactId: "$.data.finalLoraArtifactId" },
      complete_training_worker_task: {},
      poll_training_run: {},
      cleanup_training_run: {},
      create_preset_from_training_run: { presetId: "$.data.id" },
    },
    "Full workflow response paths should match the current API response envelopes and handoff names.",
  );
});

test("GET /api/training full workflow declares request body bindings for non-path handoffs", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      pathParams?: Record<string, string>;
      requestBody?: {
        bodyParams?: Record<string, string>;
        contentType?: string;
        enumValues?: Record<string, string[]>;
        optionalFields?: string[];
        requiredFields?: string[];
      };
      requires?: string[];
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const steps = new Map(fullWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("create_generation_task")?.requestBody,
    {
      bodyParams: { sectionId: "sectionId" },
      contentType: "application/json",
      enumValues: {
        generationKind: ["text_generation", "image_generation"],
        taskType: [
          "profile_text_generation",
          "scene_description_generation",
          "image_prompt_generation",
          "caption_generation",
          "trainingset_generation",
          "reference_image_generation",
        ],
      },
      optionalFields: ["generationKind", "taskType", "supplementalPrompt", "paramsJson"],
      requiredFields: ["sectionId"],
    },
    "The generation draft route needs sectionId in the JSON body, not just in workflow memory.",
  );
  assert.deepEqual(
    steps.get("attach_generation_inputs")?.requires,
    ["taskId", "imageId"],
    "Attaching generation inputs should consume the uploaded reference image handoff.",
  );
  assert.deepEqual(
    steps.get("attach_generation_inputs")?.requestBody,
    {
      bodyParams: { referenceId: "imageId" },
      contentType: "application/json",
      requiredFields: ["referenceId"],
    },
    "The generation input route needs the uploaded image id as body.referenceId.",
  );
  assert.deepEqual(
    steps.get("create_training_run")?.requestBody,
    {
      bodyParams: { revisionId: "revisionId" },
      contentType: "application/json",
      optionalFields: ["config"],
      requiredFields: ["revisionId"],
    },
    "Starting training should bind the frozen dataset revision into the JSON body.",
  );

  const bodyParamsWithoutRequiredHandoff = fullWorkflow.steps.flatMap((step) =>
    Object.entries(step.requestBody?.bodyParams ?? {})
      .filter(([, handoffId]) => !step.requires?.includes(handoffId))
      .map(([bodyField, handoffId]) => `${step.id ?? "unknown"}:${bodyField}->${handoffId}`));

  assert.deepEqual(
    bodyParamsWithoutRequiredHandoff,
    [],
    "Every request body handoff binding should reference a handoff id listed in the same step's requires array.",
  );
});

test("GET /api/training generation task resources declare draft list filters", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    payload.data.resources.generationTasks.projectList,
    {
      method: "GET",
      path: "/api/training/projects/:projectId/generation-tasks",
      queryParamSchema: {
        optionalFields: ["status", "taskType"],
        enumValues: {
          status: ["draft", "queued", "running", "completed", "failed"],
          taskType: [
            "profile_text_generation",
            "scene_description_generation",
            "image_prompt_generation",
            "caption_generation",
            "trainingset_generation",
            "reference_image_generation",
          ],
        },
      },
    },
    "Agents should not need to infer how to rediscover draft generation tasks after handoff.",
  );
});

test("GET /api/training full workflow declares body expectations for every write step", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      method: string;
      requestBody?: {
        contentType?: string;
        contentTypes?: string[];
        optionalFields?: string[];
        requiredFields?: string[];
        requiredOneOf?: string[];
      };
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const writeSteps = fullWorkflow.steps.filter((step) => step.method !== "GET");
  const missingBodyExpectations = writeSteps
    .filter((step) => !step.requestBody)
    .map((step) => step.id ?? "unknown");
  const missingContentType = writeSteps
    .filter((step) => step.requestBody)
    .filter((step) => !step.requestBody?.contentType && !step.requestBody?.contentTypes?.length)
    .map((step) => step.id ?? "unknown");

  assert.deepEqual(
    missingBodyExpectations,
    [],
    "Every write step should tell agents whether to send JSON, multipart data, or no body.",
  );
  assert.deepEqual(
    missingContentType,
    [],
    "Every requestBody declaration should include contentType or contentTypes.",
  );

  const bodyByStep = new Map(fullWorkflow.steps.map((step) => [step.id, step.requestBody]));

  assert.deepEqual(
    bodyByStep.get("upload_reference_image")?.contentTypes,
    ["application/json", "multipart/form-data"],
    "Reference image upload supports artifact registration and multipart upload modes.",
  );
  assert.deepEqual(
    bodyByStep.get("save_profile")?.requiredOneOf,
    ["loraUsagePrompt", "characterDetailPrompt", "profileSummary"],
    "Profile updates require at least one supported profile field.",
  );
  assert.deepEqual(
    bodyByStep.get("preview_generation_task"),
    { contentType: "none" },
    "Previewing a generation task reads the draft and does not need a request body.",
  );
  assert.deepEqual(
    bodyByStep.get("run_generation_task"),
    { contentType: "none" },
    "Queueing a generation draft reads the draft and does not need a request body.",
  );
  assert.deepEqual(
    bodyByStep.get("review_image_result")?.requiredFields,
    ["reviewStatus"],
    "Image review requires a reviewStatus body field.",
  );
  assert.deepEqual(
    bodyByStep.get("complete_training_run")?.optionalFields,
    ["artifactName"],
    "Training completion can optionally name the final LoRA artifact.",
  );
});

test("GET /api/training full workflow heartbeat steps reuse the worker task HTTP contract", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      requestBody?: unknown;
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const steps = new Map(fullWorkflow.steps.map((step) => [step.id, step]));
  const workerHeartbeatRequestBody = payload.data.resources.workerTasks.heartbeat.requestBody;

  assert.deepEqual(
    steps.get("heartbeat_generation_worker_task")?.requestBody,
    workerHeartbeatRequestBody,
    "Generation heartbeat should use the same JSON body contract as /api/training/worker/tasks/:taskId/heartbeat.",
  );
  assert.deepEqual(
    steps.get("heartbeat_training_worker_task")?.requestBody,
    workerHeartbeatRequestBody,
    "Training heartbeat should use the same JSON body contract as /api/training/worker/tasks/:taskId/heartbeat.",
  );
});

test("GET /api/training full workflow scopes worker leases by worker type", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      path: string;
      queryParamBindings?: Record<string, string>;
      queryParams?: Record<string, string>;
      requires?: string[];
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const steps = new Map(fullWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("lease_generation_worker_task")?.queryParams,
    {
      leaseOwner: "agent",
      targetType: "generationRun",
      workerType: "image_generation",
    },
    "Generation workers should lease only image_generation worker tasks.",
  );
  assert.deepEqual(
    steps.get("lease_training_worker_task")?.queryParams,
    {
      leaseOwner: "agent",
      targetType: "trainingRun",
      workerType: "training",
    },
    "Training workers should lease only training worker tasks.",
  );
  assert.deepEqual(
    steps.get("lease_generation_worker_task")?.queryParamBindings,
    { targetId: "taskId" },
    "Generation workers should bind the queued generation task id into the targetId query parameter.",
  );
  assert.deepEqual(
    steps.get("lease_training_worker_task")?.queryParamBindings,
    { targetId: "trainingRunId" },
    "Training workers should bind the queued training run id into the targetId query parameter.",
  );

  const workerLeaseStepsMissingWorkerType = fullWorkflow.steps
    .filter((step) => step.path === "/api/training/worker/tasks/next")
    .filter((step) => !step.queryParams?.workerType)
    .map((step) => step.id ?? "unknown");

  assert.deepEqual(
    workerLeaseStepsMissingWorkerType,
    [],
    "Every full workflow worker lease should declare workerType so agents do not lease unrelated queued work.",
  );
});

test("GET /api/training full workflow binds scheduler ticks to the target run handoff", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      queryParamBindings?: Record<string, string>;
      queryParams?: Record<string, string>;
      requires?: string[];
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const steps = new Map(fullWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("tick_generation_scheduler")?.queryParams,
    { targetType: "generationRun" },
    "Generation scheduler ticks should only advance the queued generation task owned by this flow.",
  );
  assert.deepEqual(
    steps.get("tick_generation_scheduler")?.queryParamBindings,
    { targetId: "taskId" },
    "Generation scheduler ticks should bind the generation task id into targetId.",
  );
  assert.ok(
    steps.get("tick_generation_scheduler")?.requires?.includes("taskId"),
    "Generation scheduler ticks should require taskId before binding it into the query string.",
  );
  assert.deepEqual(
    steps.get("tick_training_scheduler")?.queryParams,
    { targetType: "trainingRun" },
    "Training scheduler ticks should only advance the queued training run owned by this flow.",
  );
  assert.deepEqual(
    steps.get("tick_training_scheduler")?.queryParamBindings,
    { targetId: "trainingRunId" },
    "Training scheduler ticks should bind the training run id into targetId.",
  );
  assert.ok(
    steps.get("tick_training_scheduler")?.requires?.includes("trainingRunId"),
    "Training scheduler ticks should require trainingRunId before binding it into the query string.",
  );
});

test("GET /api/training full workflow worker leases declare target verification metadata", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      expectedTarget?: { idHandoff: string; type: string };
      produces?: string[];
      requires?: string[];
      responsePaths?: Record<string, string>;
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const steps = new Map(fullWorkflow.steps.map((step) => [step.id, step]));

  assert.deepEqual(
    steps.get("lease_generation_worker_task"),
    {
      id: "lease_generation_worker_task",
      description: "Lease the next generation worker task and verify it matches the queued generation task.",
      method: "GET",
      path: "/api/training/worker/tasks/next",
      requires: ["workerTaskQueued", "taskId"],
      queryParams: {
        workerType: "image_generation",
        leaseOwner: "agent",
        targetType: "generationRun",
      },
      queryParamBindings: { targetId: "taskId" },
      produces: ["workerTaskId", "workerTaskTargetType", "workerTaskTargetId"],
      responsePaths: {
        workerTaskId: "$.data.id",
        workerTaskTargetType: "$.data.targetType",
        workerTaskTargetId: "$.data.targetId",
      },
      expectedTarget: { type: "generationRun", idHandoff: "taskId" },
    },
    "Generation worker leases should expose and verify the target returned by the worker task API.",
  );
  assert.deepEqual(
    steps.get("lease_training_worker_task"),
    {
      id: "lease_training_worker_task",
      description: "Lease the next training worker task and verify it matches the queued training run.",
      method: "GET",
      path: "/api/training/worker/tasks/next",
      requires: ["workerTaskQueued", "trainingRunId"],
      queryParams: {
        workerType: "training",
        leaseOwner: "agent",
        targetType: "trainingRun",
      },
      queryParamBindings: { targetId: "trainingRunId" },
      produces: ["workerTaskId", "workerTaskTargetType", "workerTaskTargetId"],
      responsePaths: {
        workerTaskId: "$.data.id",
        workerTaskTargetType: "$.data.targetType",
        workerTaskTargetId: "$.data.targetId",
      },
      expectedTarget: { type: "trainingRun", idHandoff: "trainingRunId" },
    },
    "Training worker leases should expose and verify the target returned by the worker task API.",
  );
});

test("GET /api/training full workflow scopes section alias routes with project query handoffs", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();
  const fullWorkflow = payload.data.workflows.find((workflow: { id: string }) =>
    workflow.id === "agent_full_training_flow"
  ) as {
    steps: Array<{
      id?: string;
      path: string;
      queryParamBindings?: Record<string, string>;
      requires?: string[];
    }>;
  } | undefined;

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(fullWorkflow, "agent manifest should include the full training workflow");

  const addSceneBlockStep = fullWorkflow.steps.find((step) => step.id === "add_scene_block");
  assert.deepEqual(
    addSceneBlockStep?.queryParamBindings,
    { projectId: "projectId" },
    "Section alias block creation should pass ?projectId=... so duplicate section ids stay scoped to the current project.",
  );
  assert.ok(
    addSceneBlockStep?.requires?.includes("projectId"),
    "Section alias block creation should require projectId before binding it into the query string.",
  );

  const queryParamBindingsWithoutRequiredHandoff = fullWorkflow.steps.flatMap((step) =>
    Object.entries(step.queryParamBindings ?? {})
      .filter(([, handoffId]) => !step.requires?.includes(handoffId))
      .map(([queryParam, handoffId]) => `${step.id ?? "unknown"}:${queryParam}->${handoffId}`));

  assert.deepEqual(
    queryParamBindingsWithoutRequiredHandoff,
    [],
    "Every query parameter handoff binding should reference a handoff id listed in the same step's requires array.",
  );
});

test("training route operation inventory includes re-exported route handlers", async () => {
  const routeOperations = await listRouteOperations();

  assert.ok(
    routeOperations.includes("POST /api/training/scene-description/presets"),
    "operation inventory should include POST handlers re-exported from another route module",
  );
  assert.ok(
    routeOperations.includes("PATCH /api/training/scene-description/presets/:presetId"),
    "operation inventory should include PATCH handlers re-exported from another route module",
  );
  assert.ok(
    routeOperations.includes("DELETE /api/training/scene-description/presets/:presetId"),
    "operation inventory should include DELETE handlers re-exported from another route module",
  );
});

test("implemented training API routes cover the backend design operation table", async () => {
  const routeOperations = await listRouteOperations();
  const designOperations = collectBackendDesignOperations();
  const missingOperations = designOperations.filter((designOperation) =>
    !routeOperations.some((routeOperation) => operationMatchesPattern(routeOperation, designOperation))
  );

  assert.ok(
    designOperations.length >= 80,
    "backend design operation table should stay broad enough to verify the training HTTP surface",
  );
  assert.deepEqual(
    missingOperations,
    [],
    "Every /api/training operation listed in the backend design document should have a matching route handler.",
  );
});

test("GET /api/training manifest covers every implemented training API route", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  const routeFiles = await listRouteFiles(join(process.cwd(), "src", "app", "api", "training"));
  const routePaths = routeFiles
    .map(routeFileToTrainingApiPath)
    .filter((path) => path !== "/api/training")
    .sort();
  const manifestPaths = collectManifestPaths(payload.data);
  const missingFromManifest = routePaths.filter((path) => !manifestPaths.has(path));

  assert.deepEqual(missingFromManifest, []);
});

test("GET /api/training manifest uses reference-image route names only", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  const manifestText = JSON.stringify(payload.data);
  const legacyReferenceRouteFragment = ["character", "images"].join("-");
  assert.doesNotMatch(
    manifestText,
    new RegExp(`${legacyReferenceRouteFragment}|legacyCharacterImages`, "i"),
    "The training agent manifest should advertise reference-images only.",
  );
});

test("GET /api/training manifest covers every implemented training HTTP operation", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  const routeOperations = await listRouteOperations();
  const manifestOperations = collectManifestOperations(payload.data);
  const missingFromManifest = routeOperations.filter((operation) => !manifestOperations.has(operation));

  assert.deepEqual(missingFromManifest, []);
});

test("GET /api/training manifest only advertises implemented training HTTP operations", async () => {
  const { GET } = await import("../src/app/api/training/route");
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  const routeOperations = await listRouteOperations();
  const manifestOperations = [...collectManifestOperations(payload.data)]
    .filter((operation) => operation.includes(TRAINING_API_OPERATION_PREFIX))
    .sort();
  const missingRoutes = manifestOperations.filter((manifestOperation) => !routeOperations.some((routeOperation) =>
    operationMatchesPattern(routeOperation, manifestOperation)
  ));

  assert.deepEqual(
    missingRoutes,
    [],
    "Every /api/training operation advertised to agents should have a matching route handler.",
  );
});

test("GET /api/models lists checkpoint or LoRA assets for training workflows", async () => {
  const { GET } = await import("../src/app/api/models/route");

  const checkpointResponse = await GET(new NextRequest("http://localhost/api/models?kind=checkpoint"));
  const checkpointPayload = await checkpointResponse.json();
  assert.equal(checkpointResponse.status, 200);
  assert.equal(checkpointPayload.ok, true);
  assert.ok(Array.isArray(checkpointPayload.data));

  const loraResponse = await GET(new NextRequest("http://localhost/api/models?kind=lora"));
  const loraPayload = await loraResponse.json();
  assert.equal(loraResponse.status, 200);
  assert.equal(loraPayload.ok, true);
  assert.ok(Array.isArray(loraPayload.data));
});

async function createManagedRunsForDeletionTest() {
  const {
    addManagedTrainingReferenceImageToResults,
    createManagedTrainingProject,
    enqueueManagedTrainingRun,
    enqueueManagedTrainingSectionGenerationRun,
    freezeManagedTrainingDataset,
    uploadManagedTrainingProjectReferenceImage,
  } = await import("../src/server/services/training/project-service");

  const project = await createManagedTrainingProject({
    title: `删除路由测试项目 ${Date.now()}`,
    characterName: "删除路由测试角色",
    triggerToken: `delete_route_${Date.now()}`,
    templateId: "character_identity_default",
    trainingTemplateId: "character_identity_default",
    checkpointRelativePath: "models/checkpoints/mock.safetensors",
    usagePrompt: "删除路由测试",
    detailPrompt: "删除路由测试项目资料",
    sections: [
      {
        id: "delete-route-section",
        title: "删除路由小节",
        enabled: true,
        blockCount: 1,
        blocks: [
          {
            id: "delete-route-block",
            source: "本地",
            title: "删除路由场景块",
            text: "删除路由测试场景。",
          },
        ],
        resolvedScene: "删除路由测试场景。",
        scenePreview: "删除路由测试场景。",
      },
    ],
    trainingDefaults: {
      autoFreezeDataset: false,
      autoGenerateSamples: false,
    },
  });

  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "delete-route.png", { type: "image/png" }));
  formData.append("role", "source");
  const uploadedReference = await uploadManagedTrainingProjectReferenceImage(project.id, formData);

  assert.ok(uploadedReference?.id, "managed delete-route fixture should upload a reference image");

  const result = await addManagedTrainingReferenceImageToResults(uploadedReference.id, {
    reviewStatus: "keep",
    captionDraft: "删除路由测试 caption",
  });

  assert.ok(result?.id, "managed delete-route fixture should add a kept result");

  const frozen = await freezeManagedTrainingDataset(project.id);
  assert.ok(frozen?.revision?.id, "managed delete-route fixture should freeze a dataset revision");

  const generationRun = await enqueueManagedTrainingSectionGenerationRun(project.sections[0].id, {
    userInstruction: "删除路由测试生成任务",
  });
  const trainingRun = await enqueueManagedTrainingRun(project.id, {
    revisionId: frozen.revision.id,
    config: {
      overrides: {
        ordinary: {
          targetSteps: 1200,
        },
      },
    },
  });

  assert.ok(generationRun?.id, "managed delete-route fixture should create a generation run");
  assert.ok(trainingRun?.id, "managed delete-route fixture should create a training run");

  return {
    generationRunId: generationRun.id,
    projectId: project.id,
    trainingRunId: trainingRun.id,
  };
}

async function createManagedCompletedRunFixtures() {
  const {
    addManagedTrainingReferenceImageToResults,
    completeManagedGenerationRun,
    completeManagedTrainingRun,
    createManagedTrainingProject,
    enqueueManagedTrainingRun,
    enqueueManagedTrainingSectionGenerationRun,
    freezeManagedTrainingDataset,
    progressManagedTrainingRun,
    uploadManagedTrainingProjectReferenceImage,
  } = await import("../src/server/services/training/project-service");

  const project = await createManagedTrainingProject({
    title: `已完成运行测试项目 ${Date.now()}`,
    characterName: "已完成运行测试角色",
    triggerToken: `completed_fixture_${Date.now()}`,
    templateId: "character_identity_default",
    trainingTemplateId: "character_identity_default",
    checkpointRelativePath: "models/checkpoints/mock.safetensors",
    usagePrompt: "已完成运行测试",
    detailPrompt: "已完成运行测试资料",
    sections: [
      {
        id: "completed-fixture-section",
        title: "已完成运行小节",
        enabled: true,
        blockCount: 1,
        blocks: [
          {
            id: "completed-fixture-block",
            source: "本地",
            title: "已完成运行场景块",
            text: "已完成运行测试场景。",
          },
        ],
        resolvedScene: "已完成运行测试场景。",
        scenePreview: "已完成运行测试场景。",
      },
    ],
    trainingDefaults: {
      autoFreezeDataset: false,
      autoGenerateSamples: false,
    },
  });

  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "completed-fixture.png", { type: "image/png" }));
  formData.append("role", "source");
  const uploadedReference = await uploadManagedTrainingProjectReferenceImage(project.id, formData);
  assert.ok(uploadedReference?.id, "completed-run fixture should upload a reference image");

  const keptReferenceResult = await addManagedTrainingReferenceImageToResults(uploadedReference.id, {
    reviewStatus: "keep",
    captionDraft: "已完成运行 fixture caption",
  });
  assert.ok(keptReferenceResult?.id, "completed-run fixture should materialize a kept result");

  const generationRun = await enqueueManagedTrainingSectionGenerationRun(project.sections[0].id, {
    projectId: project.id,
    sourceImageIds: [uploadedReference.id],
    userInstruction: "已完成运行 fixture 生成任务",
  });
  assert.ok(generationRun?.id, "completed-run fixture should create a generation run");

  const completedGenerationRun = await completeManagedGenerationRun(generationRun.id, {
    captionDraft: "已完成生成结果",
    reviewStatus: "keep",
  });
  assert.ok(completedGenerationRun?.id, "completed-run fixture should complete the generation run");
  assert.ok(completedGenerationRun?.outputResultIds?.length, "completed-run fixture should expose a generation output");

  const frozen = await freezeManagedTrainingDataset(project.id);
  assert.ok(frozen?.revision?.id, "completed-run fixture should freeze a dataset revision");

  const trainingRun = await enqueueManagedTrainingRun(project.id, {
    revisionId: frozen.revision.id,
    config: {
      overrides: {
        ordinary: {
          targetSteps: 1200,
        },
      },
    },
  });
  assert.ok(trainingRun?.id, "completed-run fixture should create a training run");

  const progressedTrainingRun = await progressManagedTrainingRun(trainingRun.id, {
    currentStep: 1200,
    schedulerMessage: "fixture training progress",
    targetSteps: 1200,
  });
  assert.ok(progressedTrainingRun?.id, "completed-run fixture should advance the training run");

  const completedTrainingRun = await completeManagedTrainingRun(trainingRun.id, {
    artifactName: "completed-fixture.safetensors",
  });
  assert.ok(completedTrainingRun?.id, "completed-run fixture should complete the training run");
  assert.ok(completedTrainingRun?.finalLoraArtifactId, "completed-run fixture should expose a final LoRA artifact");

  return {
    generationRunId: completedGenerationRun.id,
    outputResultId: completedGenerationRun.outputResultIds?.[0] ?? null,
    projectId: project.id,
    trainingRunId: completedTrainingRun.id,
  };
}

async function createManagedReferenceSeedProject() {
  const {
    addManagedTrainingReferenceImageToResults,
    createManagedTrainingProject,
    uploadManagedTrainingProjectReferenceImage,
  } = await import("../src/server/services/training/project-service");

  const project = await createManagedTrainingProject({
    title: `参考源项目 ${Date.now()}`,
    characterName: "参考源角色",
    projectName: "参考源项目",
    triggerToken: `reference_seed_${Date.now()}`,
    templateId: "character_identity_default",
    trainingTemplateId: "character_identity_default",
    checkpointRelativePath: "models/checkpoints/mock.safetensors",
    usagePrompt: "参考源使用提示词",
    detailPrompt: "参考源细节描述",
    sections: [
      {
        id: "reference-seed-section",
        title: "参考源小节",
        enabled: true,
        blockCount: 1,
        blocks: [
          {
            id: "reference-seed-block",
            source: "本地",
            title: "参考源场景块",
            text: "参考源场景",
          },
        ],
        resolvedScene: "参考源场景",
        scenePreview: "参考源场景",
      },
    ],
    trainingDefaults: {
      autoFreezeDataset: false,
      autoGenerateSamples: false,
    },
  });

  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "reference-seed.png", { type: "image/png" }));
  formData.append("role", "source");
  const uploadedReference = await uploadManagedTrainingProjectReferenceImage(project.id, formData);
  assert.ok(uploadedReference?.id, "reference-seed fixture should upload a reference image");

  const keptResult = await addManagedTrainingReferenceImageToResults(uploadedReference.id, {
    reviewStatus: "keep",
    captionDraft: "参考源保留结果",
  });
  assert.ok(keptResult?.id, "reference-seed fixture should create a kept result");

  return {
    projectId: project.id,
    projectSelectionId: `project-${project.id}`,
    resultSelectionId: `result-${keptResult.id}`,
    resultSourceLabel: keptResult.sourceLabel,
    title: project.title,
  };
}

async function createManagedProjectFixture(input: {
  detailPrompt?: string;
  sections?: Array<{
    id: string;
    title: string;
    enabled: boolean;
    blockCount: number;
    blocks: Array<{
      id: string;
      source: "本地" | "预制";
      title: string;
      text: string;
    }>;
    resolvedScene: string;
    scenePreview: string;
  }>;
  title: string;
  triggerToken?: string;
  usagePrompt?: string;
}) {
  const { createManagedTrainingProject } = await import("../src/server/services/training/project-service");
  return createManagedTrainingProject({
    title: input.title,
    characterName: input.title,
    projectName: input.title,
    triggerToken: input.triggerToken ?? `fixture_${Date.now()}`,
    templateId: "character_identity_default",
    trainingTemplateId: "character_identity_default",
    checkpointRelativePath: "models/checkpoints/mock.safetensors",
    usagePrompt: input.usagePrompt ?? `${input.title} usage`,
    detailPrompt: input.detailPrompt ?? `${input.title} detail`,
    selectedReferenceIds: [],
    sections: input.sections ?? [
      {
        id: "fixture-section",
        title: "Fixture Section",
        enabled: true,
        blockCount: 1,
        blocks: [
          {
            id: "fixture-block",
            source: "本地",
            title: "Fixture Block",
            text: "fixture scene",
          },
        ],
        resolvedScene: "fixture scene",
        scenePreview: "fixture scene",
      },
    ],
    trainingDefaults: {
      autoGenerateSamples: false,
      autoFreezeDataset: false,
    },
  });
}

test("GET /api/training/projects lists training projects", async () => {
  const projects = await listProjects();
  assert.equal(typeof projects[0]?.id, "string");
});

test("training project reorder route persists managed project order through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const reorderRoute = await import("../src/app/api/training/projects/reorder/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const first = await createManagedProjectFixture({ title: `项目排序 A ${Date.now()}` });
    const second = await createManagedProjectFixture({ title: `项目排序 B ${Date.now()}` });
    const third = await createManagedProjectFixture({ title: `项目排序 C ${Date.now()}` });

    const reorderResponse = await reorderRoute.POST(
      new Request("http://localhost/api/training/projects/reorder", {
        method: "POST",
        body: JSON.stringify({
          orderedProjectIds: [third.id, first.id, second.id],
        }),
      }),
    );
    const reorderPayload = await reorderResponse.json();
    assert.equal(reorderResponse.status, 200);
    assert.equal(reorderPayload.ok, true);
    assert.deepEqual(reorderPayload.data.orderedProjectIds, [third.id, first.id, second.id]);

    const listResponse = await projectsRoute.GET(new Request("http://localhost/api/training/projects"));
    const listPayload = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listPayload.ok, true);
    const visibleOrderedIds = (listPayload.data as Array<{ id: string }>)
      .filter((project) => [first.id, second.id, third.id].includes(project.id))
      .map((project) => project.id);
    assert.deepEqual(visibleOrderedIds.slice(0, 3), [third.id, first.id, second.id]);
  });
});

test("managed training projects suppress demo project fixtures on /api/training/projects", async () => {
  const { createManagedTrainingProject } = await import("../src/server/services/training/project-service");

  await withTrainingManagedStoreSnapshot(async () => {
    const created = await createManagedTrainingProject({
      title: `Managed Only List ${Date.now()}`,
      characterName: "Managed Only List",
      projectName: "Managed Only List",
      triggerToken: `managed_only_list_${Date.now()}`,
      templateId: "character_identity_default",
      trainingTemplateId: "character_identity_default",
      checkpointRelativePath: "models/checkpoints/mock.safetensors",
      usagePrompt: "managed only list usage",
      detailPrompt: "managed only list detail",
      sections: [
        {
          id: "managed-only-section",
          title: "Managed Only Section",
          enabled: true,
          blockCount: 1,
          blocks: [
            {
              id: "managed-only-block",
              source: "本地",
              title: "Managed Only Block",
              text: "managed only scene",
            },
          ],
          resolvedScene: "managed only scene",
          scenePreview: "managed only scene",
        },
      ],
      trainingDefaults: {
        autoGenerateSamples: false,
        autoFreezeDataset: false,
      },
    });

    const projects = await listProjects();
    assert.ok(projects.some((project) => project.id === created.id));
    assert.ok(projects.every((project) => project.id !== "project-vela-neon"));
  });
});

test("managed training project creation can seed references from existing managed projects and kept results", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const title = `引用 managed 资料项目 ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `managed_reference_copy_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "managed 引用复制测试",
          detailPrompt: "managed 引用复制测试细节",
          selectedReferenceIds: [seedProject.projectSelectionId, seedProject.resultSelectionId],
          sections: [
            {
              id: "managed-reference-copy-section",
              title: "managed reference copy",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "managed-reference-copy-block",
                  source: "本地",
                  title: "managed reference copy block",
                  text: "managed reference copy scene",
                },
              ],
              resolvedScene: "managed reference copy scene",
              scenePreview: "managed reference copy scene",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const projectId = createPayload.data.id as string;
    const referenceResponse = await referenceRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
      { params: Promise.resolve({ projectId }) },
    );
    const referencePayload = await referenceResponse.json();
    assert.equal(referenceResponse.status, 200);
    assert.equal(referencePayload.ok, true);
    assert.ok(Array.isArray(referencePayload.data));
    assert.ok((referencePayload.data as Array<{ label: string }>).some((image) => image.label === seedProject.title));
    assert.ok((referencePayload.data as Array<{ label: string }>).some((image) => image.label === seedProject.resultSourceLabel));
  });
});

test("POST /api/training/projects creates a blank project without template ids", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const title = `无模板空训练项目 ${Date.now()}`;
    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `blank_project_${Date.now()}`,
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "无模板创建后再补资料。",
          detailPrompt: "无模板创建不应该要求来源训练模板。",
          selectedReferenceIds: [],
          sections: [],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);
    assert.equal(createPayload.data.title, title);
    assert.equal(createPayload.data.sectionCount, 0);
    assert.deepEqual(createPayload.data.sections, []);
  });
});

test("GET /api/training/projects/:projectId returns one project detail", async () => {
  const { GET } = await import("../src/app/api/training/projects/[projectId]/route");
  const projects = await listProjects();
  const projectId = pickProjectWithSections(projects).id;

  const response = await GET(
    new Request(`http://localhost/api/training/projects/${projectId}`),
    { params: Promise.resolve({ projectId }) },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, projectId);
  assert.ok(Array.isArray(payload.data.sections));
  assert.ok(payload.data.sections.length > 0);
});

test("GET project-scoped training resources expose sections, results, dataset revisions, and scoped run lists", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const resultsRoute = await import("../src/app/api/training/projects/[projectId]/image-results/route");
  const readinessRoute = await import("../src/app/api/training/projects/[projectId]/dataset-readiness/route");
  const revisionDetailRoute = await import("../src/app/api/training/dataset-revisions/[revisionId]/route");
  const revisionsRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const trainingRunsRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const generationTasksRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const { generationRunId, projectId, trainingRunId } = await createManagedCompletedRunFixtures();

    const params = { params: Promise.resolve({ projectId }) };
    const [sectionsResponse, resultsResponse, readinessResponse, revisionsResponse, trainingRunsResponse, generationTasksResponse] = await Promise.all([
      sectionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/sections`), params),
      resultsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/image-results`), params),
      readinessRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/dataset-readiness`), params),
      revisionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/dataset-revisions`), params),
      trainingRunsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/training-runs`), params),
      generationTasksRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks`), params),
    ]);

    const [sectionsPayload, resultsPayload, readinessPayload, revisionsPayload, trainingRunsPayload, generationTasksPayload] = await Promise.all([
      sectionsResponse.json(),
      resultsResponse.json(),
      readinessResponse.json(),
      revisionsResponse.json(),
      trainingRunsResponse.json(),
      generationTasksResponse.json(),
    ]);

    assert.equal(sectionsResponse.status, 200);
    assert.equal(resultsResponse.status, 200);
    assert.equal(readinessResponse.status, 200);
    assert.equal(revisionsResponse.status, 200);
    assert.equal(trainingRunsResponse.status, 200);
    assert.equal(generationTasksResponse.status, 200);

    assert.ok(Array.isArray(sectionsPayload.data));
    assert.ok(sectionsPayload.data.length > 0);
    assert.ok(Array.isArray(resultsPayload.data));
    assert.ok(resultsPayload.data.length > 0);
    assert.equal(readinessPayload.data.projectId, projectId);
    assert.equal(typeof readinessPayload.data.readyForTraining, "boolean");
    assert.ok(Array.isArray(revisionsPayload.data));
    assert.ok(revisionsPayload.data.length > 0);
    const revisionId = revisionsPayload.data[0].id as string;
    const revisionDetailResponse = await revisionDetailRoute.GET(
      new Request(`http://localhost/api/training/dataset-revisions/${revisionId}`),
      { params: Promise.resolve({ revisionId }) },
    );
    const revisionDetailPayload = await revisionDetailResponse.json();
    assert.equal(revisionDetailResponse.status, 200);
    assert.equal(revisionDetailPayload.ok, true);
    assert.equal(revisionDetailPayload.data.id, revisionId);
    assert.ok((trainingRunsPayload.data as Array<{ id: string; kind: string; projectId: string }>).some((run) => run.id === trainingRunId));
    assert.ok((generationTasksPayload.data as Array<{ id: string; kind: string; projectId: string }>).some((run) => run.id === generationRunId));
    assert.ok(trainingRunsPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "training" && run.projectId === projectId));
    assert.ok(generationTasksPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "generation" && run.projectId === projectId));
  });
});

test("GET /api/training/sections/:sectionId/scene-description returns the resolved training scene text and source blocks", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const sceneDescriptionRoute = await import("../src/app/api/training/sections/[sectionId]/scene-description/route");
  const projects = await listProjects();
  const projectId = (
    projects.find((project) => (project.sectionCount ?? 0) > 0)
    ?? projects[0]
  ).id;

  const sectionsResponse = await sectionsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`),
    { params: Promise.resolve({ projectId }) },
  );
  const sectionsPayload = await sectionsResponse.json();

  assert.equal(sectionsResponse.status, 200);
  assert.equal(sectionsPayload.ok, true);

  const sectionId = sectionsPayload.data[0].id as string;
  const sceneDescriptionResponse = await sceneDescriptionRoute.GET(
    new Request(`http://localhost/api/training/sections/${sectionId}/scene-description`),
    { params: Promise.resolve({ sectionId }) },
  );
  const sceneDescriptionPayload = await sceneDescriptionResponse.json();

  assert.equal(sceneDescriptionResponse.status, 200);
  assert.equal(sceneDescriptionPayload.ok, true);
  assert.equal(typeof sceneDescriptionPayload.data.text, "string");
  assert.ok(sceneDescriptionPayload.data.text.length > 0);
  assert.ok(Array.isArray(sceneDescriptionPayload.data.blocks));
  assert.ok(sceneDescriptionPayload.data.blocks.length > 0);
});

test("training section and block alias routes honor project scope when ids overlap", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionAliasRoute = await import("../src/app/api/training/sections/[sectionId]/route");
    const sceneDescriptionRoute = await import("../src/app/api/training/sections/[sectionId]/scene-description/route");
    const blockDetailRoute = await import("../src/app/api/training/blocks/[blockId]/route");
    const projectSectionRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");

    const createProject = async (title: string, scene: string, blockText: string) => {
      const response = await projectsRoute.POST(
        new Request("http://localhost/api/training/projects", {
          method: "POST",
          body: JSON.stringify({
            title,
            characterName: title,
            projectName: title,
            triggerToken: `overlap_alias_${Date.now()}_${title}`,
            templateId: "character_identity_default",
            trainingTemplateId: "character_identity_default",
            checkpointRelativePath: "models/checkpoints/mock.safetensors",
            usagePrompt: `${title} usage`,
            detailPrompt: `${title} detail`,
            sections: [
              {
                id: "shared-section",
                title: `${title} 小节`,
                enabled: true,
                blockCount: 1,
                blocks: [
                  {
                    id: "shared-block",
                    source: "本地",
                    title: `${title} block`,
                    text: blockText,
                  },
                ],
                resolvedScene: scene,
                scenePreview: scene,
              },
            ],
            trainingDefaults: {
              autoGenerateSamples: false,
              autoFreezeDataset: false,
            },
          }),
        }),
      );
      const payload = await response.json();
      assert.equal(response.status, 201);
      assert.equal(payload.ok, true);
      return payload.data as { id: string };
    };

    const firstProject = await createProject(`重复别名项目 A ${Date.now()}`, "scene a", "block text a");
    const secondProject = await createProject(`重复别名项目 B ${Date.now()}`, "scene b", "block text b");

    const sectionAliasResponse = await sectionAliasRoute.GET(
      new Request(`http://localhost/api/training/sections/shared-section?projectId=${encodeURIComponent(secondProject.id)}`),
      { params: Promise.resolve({ sectionId: "shared-section" }) },
    );
    const sectionAliasPayload = await sectionAliasResponse.json();
    assert.equal(sectionAliasResponse.status, 200);
    assert.equal(sectionAliasPayload.ok, true);
    assert.match(sectionAliasPayload.data.title, /重复别名项目 B/);

    const sceneDescriptionResponse = await sceneDescriptionRoute.GET(
      new Request(`http://localhost/api/training/sections/shared-section/scene-description?projectId=${encodeURIComponent(secondProject.id)}`),
      { params: Promise.resolve({ sectionId: "shared-section" }) },
    );
    const sceneDescriptionPayload = await sceneDescriptionResponse.json();
    assert.equal(sceneDescriptionResponse.status, 200);
    assert.equal(sceneDescriptionPayload.ok, true);
    assert.equal(sceneDescriptionPayload.data.projectId, secondProject.id);
    assert.equal(sceneDescriptionPayload.data.text, "scene b");

    const sectionRunsRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
    const firstRunResponse = await sectionRunsRoute.POST(
      new Request("http://localhost/api/training/sections/shared-section/runs", {
        method: "POST",
        body: JSON.stringify({
          projectId: firstProject.id,
          userInstruction: "first overlap run",
        }),
      }),
      { params: Promise.resolve({ sectionId: "shared-section" }) },
    );
    const firstRunPayload = await firstRunResponse.json();
    assert.equal(firstRunResponse.status, 201);
    assert.equal(firstRunPayload.ok, true);

    const secondRunResponse = await sectionRunsRoute.POST(
      new Request("http://localhost/api/training/sections/shared-section/runs", {
        method: "POST",
        body: JSON.stringify({
          projectId: secondProject.id,
          userInstruction: "second overlap run",
        }),
      }),
      { params: Promise.resolve({ sectionId: "shared-section" }) },
    );
    const secondRunPayload = await secondRunResponse.json();
    assert.equal(secondRunResponse.status, 201);
    assert.equal(secondRunPayload.ok, true);

    const scopedRunsResponse = await sectionRunsRoute.GET(
      new Request(`http://localhost/api/training/sections/shared-section/runs?projectId=${encodeURIComponent(secondProject.id)}`),
      { params: Promise.resolve({ sectionId: "shared-section" }) },
    );
    const scopedRunsPayload = await scopedRunsResponse.json();
    assert.equal(scopedRunsResponse.status, 200);
    assert.equal(scopedRunsPayload.ok, true);
    assert.ok(Array.isArray(scopedRunsPayload.data));
    assert.ok((scopedRunsPayload.data as Array<{ id: string; projectId: string }>).some((run) => run.id === secondRunPayload.data.id));
    assert.ok((scopedRunsPayload.data as Array<{ id: string; projectId: string }>).every((run) => run.projectId === secondProject.id));
    assert.ok(!(scopedRunsPayload.data as Array<{ id: string }>).some((run) => run.id === firstRunPayload.data.id));

    const blockPatchResponse = await blockDetailRoute.PATCH(
      new Request(`http://localhost/api/training/blocks/shared-block?projectId=${encodeURIComponent(secondProject.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          text: "block text b updated",
        }),
      }),
      { params: Promise.resolve({ blockId: "shared-block" }) },
    );
    const blockPatchPayload = await blockPatchResponse.json();
    assert.equal(blockPatchResponse.status, 200);
    assert.equal(blockPatchPayload.ok, true);
    assert.equal(blockPatchPayload.data.text, "block text b updated");

    const firstSectionResponse = await projectSectionRoute.GET(
      new Request(`http://localhost/api/training/projects/${firstProject.id}/sections/shared-section`),
      { params: Promise.resolve({ projectId: firstProject.id, sectionId: "shared-section" }) },
    );
    const firstSectionPayload = await firstSectionResponse.json();
    assert.equal(firstSectionResponse.status, 200);
    assert.equal(firstSectionPayload.ok, true);
    assert.equal(firstSectionPayload.data.blocks[0].text, "block text a");

    const secondSectionResponse = await projectSectionRoute.GET(
      new Request(`http://localhost/api/training/projects/${secondProject.id}/sections/shared-section`),
      { params: Promise.resolve({ projectId: secondProject.id, sectionId: "shared-section" }) },
    );
    const secondSectionPayload = await secondSectionResponse.json();
    assert.equal(secondSectionResponse.status, 200);
    assert.equal(secondSectionPayload.ok, true);
    assert.equal(secondSectionPayload.data.blocks[0].text, "block text b updated");
  });
});

test("GET /api/training/sections/:sectionId/runs lists generation runs scoped to one training section", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const sectionRunsRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const projects = await listProjects();
  const projectId = (
    projects.find((project) => (project.sectionCount ?? 0) > 0 && (project.imageCount ?? 0) > 0)
    ?? projects.find((project) => (project.sectionCount ?? 0) > 0)
    ?? projects[0]
  ).id;

  const sectionsResponse = await sectionsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`),
    { params: Promise.resolve({ projectId }) },
  );
  const sectionsPayload = await sectionsResponse.json();
  assert.equal(sectionsResponse.status, 200);
  assert.equal(sectionsPayload.ok, true);

  const sectionId = sectionsPayload.data[0].id as string;
  const sectionRunsResponse = await sectionRunsRoute.GET(
    new Request(`http://localhost/api/training/sections/${sectionId}/runs`),
    { params: Promise.resolve({ sectionId }) },
  );
  const sectionRunsPayload = await sectionRunsResponse.json();

  assert.equal(sectionRunsResponse.status, 200);
  assert.equal(sectionRunsPayload.ok, true);
  assert.ok(Array.isArray(sectionRunsPayload.data));
  assert.ok(sectionRunsPayload.data.every((run: { kind: string; sectionId: string }) => run.kind === "generation" && run.sectionId === sectionId));
});

test("training project section route reads and updates a saved section through /api/training", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const sectionDetailRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");
  const projects = await listProjects();
  const projectId = pickProjectWithSections(projects).id;
  const params = { params: Promise.resolve({ projectId }) };
  const sectionsResponse = await sectionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/sections`), params);
  const sectionsPayload = await sectionsResponse.json();
  const firstSection = sectionsPayload.data[0];

  assert.equal(sectionsResponse.status, 200);
  assert.equal(sectionsPayload.ok, true);
  assert.equal(typeof firstSection.id, "string");

  const detailParams = { params: Promise.resolve({ projectId, sectionId: firstSection.id }) };
  const getBeforeResponse = await sectionDetailRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${firstSection.id}`),
    detailParams,
  );
  const getBeforePayload = await getBeforeResponse.json();

  assert.equal(getBeforeResponse.status, 200);
  assert.equal(getBeforePayload.ok, true);

  const original = getBeforePayload.data as {
    blocks: Array<{ id: string; source: string; text: string; title: string }>;
    enabled: boolean;
    id: string;
    imagePrompt: string;
    resolvedScene: string;
    title: string;
  };

  const updatedTitle = `${original.title} ${Date.now()}`;
  const updatedBlocks = [
    ...original.blocks,
    {
      id: `${original.id}-test-block`,
      source: "本地",
      title: "测试补充块",
      text: "测试保存到正式训练小节接口。",
    },
  ];

  const patchResponse = await sectionDetailRoute.PATCH(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${firstSection.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: updatedTitle,
        enabled: original.enabled,
        blocks: updatedBlocks,
        resolvedScene: `${original.resolvedScene}\n\n测试保存到正式训练小节接口。`,
        imagePrompt: original.imagePrompt,
      }),
    }),
    detailParams,
  );
  const patchPayload = await patchResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.ok, true);
  assert.equal(patchPayload.data.title, updatedTitle);
  assert.equal(patchPayload.data.blocks.length, updatedBlocks.length);

  const getAfterResponse = await sectionDetailRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${firstSection.id}`),
    detailParams,
  );
  const getAfterPayload = await getAfterResponse.json();

  assert.equal(getAfterResponse.status, 200);
  assert.equal(getAfterPayload.ok, true);
  assert.equal(getAfterPayload.data.title, updatedTitle);
  assert.equal(getAfterPayload.data.blocks.length, updatedBlocks.length);

  await sectionDetailRoute.PATCH(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${firstSection.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: original.title,
        enabled: original.enabled,
        blocks: original.blocks,
        resolvedScene: original.resolvedScene,
        imagePrompt: original.imagePrompt,
      }),
    }),
    detailParams,
  );
});

test("training scene block routes create, update, detach, reorder, and delete blocks through /api/training", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const blockCreateRoute = await import("../src/app/api/training/sections/[sectionId]/blocks/route");
  const blockReorderRoute = await import("../src/app/api/training/sections/[sectionId]/blocks/reorder/route");
  const blockDetailRoute = await import("../src/app/api/training/blocks/[blockId]/route");
  const blockDetachRoute = await import("../src/app/api/training/blocks/[blockId]/detach/route");
  const sectionDetailRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");
  const projects = await listProjects();
  const projectId = pickProjectWithSections(projects).id;
  const sectionsResponse = await sectionsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`),
    { params: Promise.resolve({ projectId }) },
  );
  const sectionsPayload = await sectionsResponse.json();
  assert.equal(sectionsResponse.status, 200);
  assert.equal(sectionsPayload.ok, true);
  const sectionId = sectionsPayload.data[0].id as string;
  const sectionDetailResponse = await sectionDetailRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${sectionId}`),
    { params: Promise.resolve({ projectId, sectionId }) },
  );
  const sectionDetailPayload = await sectionDetailResponse.json();
  const section = sectionDetailPayload.data as {
    blocks: Array<{ id: string; source: string; text: string; title: string }>;
    enabled: boolean;
    id: string;
    imagePrompt: string;
    resolvedScene: string;
    title: string;
  };
  const originalBlocks = section.blocks;

  const createResponse = await blockCreateRoute.POST(
    new Request(`http://localhost/api/training/sections/${sectionId}/blocks`, {
      method: "POST",
      body: JSON.stringify({
        title: "HTTP 新场景块",
        text: "通过正式 block API 新增的场景块。",
        source: "本地",
      }),
    }),
    { params: Promise.resolve({ sectionId }) },
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.data.title, "HTTP 新场景块");

  const createdBlockId = createPayload.data.id as string;

  const patchResponse = await blockDetailRoute.PATCH(
    new Request(`http://localhost/api/training/blocks/${createdBlockId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "HTTP 新场景块 已更新",
        text: "通过正式 block API 更新后的场景块。",
      }),
    }),
    { params: Promise.resolve({ blockId: createdBlockId }) },
  );
  const patchPayload = await patchResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.ok, true);
  assert.equal(patchPayload.data.title, "HTTP 新场景块 已更新");

  const detachResponse = await blockDetachRoute.POST(
    new Request(`http://localhost/api/training/blocks/${createdBlockId}/detach`, {
      method: "POST",
      body: JSON.stringify({
        editedText: "detach 后的本地文本",
      }),
    }),
    { params: Promise.resolve({ blockId: createdBlockId }) },
  );
  const detachPayload = await detachResponse.json();

  assert.equal(detachResponse.status, 200);
  assert.equal(detachPayload.ok, true);
  assert.equal(detachPayload.data.source, "本地");
  assert.equal(detachPayload.data.text, "detach 后的本地文本");

  const afterCreateSectionResponse = await sectionDetailRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${sectionId}`),
    { params: Promise.resolve({ projectId, sectionId }) },
  );
  const afterCreateSectionPayload = await afterCreateSectionResponse.json();
  const blockIds = (afterCreateSectionPayload.data.blocks as Array<{ id: string }>).map((block) => block.id);
  const reorderedIds = [...blockIds].reverse();

  const reorderResponse = await blockReorderRoute.POST(
    new Request(`http://localhost/api/training/sections/${sectionId}/blocks/reorder`, {
      method: "POST",
      body: JSON.stringify({ ids: reorderedIds }),
    }),
    { params: Promise.resolve({ sectionId }) },
  );
  const reorderPayload = await reorderResponse.json();

  assert.equal(reorderResponse.status, 200);
  assert.equal(reorderPayload.ok, true);
  assert.equal(reorderPayload.data[0].id, reorderedIds[0]);

  const deleteResponse = await blockDetailRoute.DELETE(
    new Request(`http://localhost/api/training/blocks/${createdBlockId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ blockId: createdBlockId }) },
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
  assert.equal(deletePayload.data.id, createdBlockId);

  await sectionDetailRoute.PATCH(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: section.title,
        enabled: section.enabled,
        blocks: originalBlocks,
        resolvedScene: section.resolvedScene,
        imagePrompt: section.imagePrompt,
      }),
    }),
    { params: Promise.resolve({ projectId, sectionId }) },
  );
});

test("training project sections create, copy, delete, and reorder through /api/training", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const reorderRoute = await import("../src/app/api/training/projects/[projectId]/sections/reorder/route");
  const sectionDetailRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");
  const projects = await listProjects();
  const projectId = pickProjectWithSections(projects).id;
  const params = { params: Promise.resolve({ projectId }) };

  const beforeResponse = await sectionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/sections`), params);
  const beforePayload = await beforeResponse.json();
  const beforeSections = beforePayload.data as Array<{ id: string; title: string }>;
  const sourceSectionId = beforeSections[0].id;

  const createResponse = await sectionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
    params,
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(typeof createPayload.data.id, "string");

  const createdSectionId = createPayload.data.id as string;

  const copyResponse = await sectionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`, {
      method: "POST",
      body: JSON.stringify({ sourceSectionId }),
    }),
    params,
  );
  const copyPayload = await copyResponse.json();

  assert.equal(copyResponse.status, 200);
  assert.equal(copyPayload.ok, true);
  assert.equal(typeof copyPayload.data.id, "string");

  const copiedSectionId = copyPayload.data.id as string;

  const afterCreateResponse = await sectionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/sections`), params);
  const afterCreatePayload = await afterCreateResponse.json();
  const afterCreateSections = afterCreatePayload.data as Array<{ id: string }>;

  assert.equal(afterCreateSections.length, beforeSections.length + 2);

  const reversedIds = [...afterCreateSections.map((section) => section.id)].reverse();
  const reorderResponse = await reorderRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/reorder`, {
      method: "POST",
      body: JSON.stringify({ orderedSectionIds: reversedIds }),
    }),
    params,
  );
  const reorderPayload = await reorderResponse.json();

  assert.equal(reorderResponse.status, 200);
  assert.equal(reorderPayload.ok, true);
  assert.equal(reorderPayload.data[0].id, reversedIds[0]);

  const deleteCreatedResponse = await sectionDetailRoute.DELETE(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${createdSectionId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ projectId, sectionId: createdSectionId }) },
  );
  const deleteCreatedPayload = await deleteCreatedResponse.json();
  assert.equal(deleteCreatedResponse.status, 200);
  assert.equal(deleteCreatedPayload.ok, true);

  const deleteCopiedResponse = await sectionDetailRoute.DELETE(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/${copiedSectionId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ projectId, sectionId: copiedSectionId }) },
  );
  const deleteCopiedPayload = await deleteCopiedResponse.json();
  assert.equal(deleteCopiedResponse.status, 200);
  assert.equal(deleteCopiedPayload.ok, true);

  await reorderRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/sections/reorder`, {
      method: "POST",
      body: JSON.stringify({ orderedSectionIds: beforeSections.map((section) => section.id) }),
    }),
    params,
  );
});

test("training section alias route reads, updates, and deletes by /api/training/sections/:sectionId", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const sectionAliasRoute = await import("../src/app/api/training/sections/[sectionId]/route");
  const projects = await listProjects();
  const projectId = pickProjectWithSections(projects).id;

  const createSectionResponse = await sectionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const createSectionPayload = await createSectionResponse.json();
  assert.equal(createSectionResponse.status, 200);
  assert.equal(createSectionPayload.ok, true);

  const sectionId = createSectionPayload.data.id as string;
  const sectionParams = { params: Promise.resolve({ sectionId }) };

  const getResponse = await sectionAliasRoute.GET(
    new Request(`http://localhost/api/training/sections/${sectionId}`),
    sectionParams,
  );
  const getPayload = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.data.id, sectionId);

  const updateResponse = await sectionAliasRoute.PATCH(
    new Request(`http://localhost/api/training/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Section Alias 已更新",
        enabled: true,
        blocks: [
          {
            id: "section-alias-block",
            source: "本地",
            title: "Section Alias Block",
            text: "section alias 更新后的场景描述",
          },
        ],
        resolvedScene: "section alias 更新后的场景描述",
        imagePrompt: "section alias 更新后的图片提示词",
      }),
    }),
    sectionParams,
  );
  const updatePayload = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.data.title, "Section Alias 已更新");
  assert.equal(updatePayload.data.resolvedScene, "section alias 更新后的场景描述");

  const deleteResponse = await sectionAliasRoute.DELETE(
    new Request(`http://localhost/api/training/sections/${sectionId}`, {
      method: "DELETE",
    }),
    sectionParams,
  );
  const deletePayload = await deleteResponse.json();
  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
  assert.equal(deletePayload.data.success, true);

  const getAfterDeleteResponse = await sectionAliasRoute.GET(
    new Request(`http://localhost/api/training/sections/${sectionId}`),
    sectionParams,
  );
  const getAfterDeletePayload = await getAfterDeleteResponse.json();
  assert.equal(getAfterDeleteResponse.status, 404);
  assert.equal(getAfterDeletePayload.ok, false);
});

test("GET /api/training/runs filters the global training workspace by kind and status", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const { generationRunId } = await createManagedCompletedRunFixtures();
    const runs = await listRuns("?kind=generation&status=completed");

    assert.ok(runs.length > 0);
    assert.ok(runs.some((run) => run.id === generationRunId));
    assert.ok(runs.every((run) => run.kind === "generation" && run.status === "completed"));
  });
});

test("GET /api/training/training-runs/:trainingRunId returns training run detail", async () => {
  const { GET } = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const { trainingRunId } = await createManagedCompletedRunFixtures();

    const response = await GET(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.id, trainingRunId);
    assert.equal(payload.data.kind, "training");
  });
});

test("POST /api/training/training-runs/:trainingRunId/create-preset creates a training preset from a completed training run", async () => {
  const trainingRunDetailRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
  const createPresetRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/create-preset/route");
  const presetsRoute = await import("../src/app/api/training/presets/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const { trainingRunId } = await createManagedCompletedRunFixtures();
    await clearTrainingRunPresetState(trainingRunId);

    const presetTitle = `训练完成预制 ${Date.now()}`;
    const createResponse = await createPresetRoute.POST(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}/create-preset`, {
        method: "POST",
        body: JSON.stringify({
          presetName: presetTitle,
          category: "训练产物",
          folder: "LoRA 产物",
        }),
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const createPayload = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);
    assert.equal(createPayload.data.title, presetTitle);

    const presetListResponse = await presetsRoute.GET();
    const presetListPayload = await presetListResponse.json();
    assert.equal(presetListResponse.status, 200);
    assert.equal(presetListPayload.ok, true);
    assert.ok((presetListPayload.data as Array<{ id: string; title: string }>).some((preset) => preset.id === createPayload.data.id && preset.title === presetTitle));

    const runDetailResponse = await trainingRunDetailRoute.GET(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const runDetailPayload = await runDetailResponse.json();
    assert.equal(runDetailResponse.status, 200);
    assert.equal(runDetailPayload.ok, true);
    assert.equal(typeof runDetailPayload.data.presetCreatedAt, "string");

    const duplicateResponse = await createPresetRoute.POST(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}/create-preset`, {
        method: "POST",
        body: JSON.stringify({
          presetName: `${presetTitle} 再次创建`,
        }),
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const duplicatePayload = await duplicateResponse.json();
    assert.equal(duplicateResponse.status, 409);
    assert.equal(duplicatePayload.ok, false);
  });
});

test("POST /api/training/training-runs/:trainingRunId/poll returns the current training run snapshot", async () => {
  const pollRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/poll/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const { trainingRunId } = await createManagedCompletedRunFixtures();

    const response = await pollRoute.POST(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}/poll`, {
        method: "POST",
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.id, trainingRunId);
    assert.equal(payload.data.kind, "training");
  });
});

test("POST /api/training/training-runs/:trainingRunId/cleanup returns an idempotent cleanup summary", async () => {
  const cleanupRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/cleanup/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const { trainingRunId } = await createManagedCompletedRunFixtures();

    const response = await cleanupRoute.POST(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}/cleanup`, {
        method: "POST",
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.trainingRunId, trainingRunId);
    assert.equal(typeof payload.data.cleaned, "boolean");
    assert.ok(Array.isArray(payload.data.cleanedArtifacts));
  });
});

test("GET /api/training/generation-tasks/:taskId returns generation task detail", async () => {
  const { GET } = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const taskId = (await listRuns("?kind=generation"))[0].id;

  const response = await GET(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}`),
    { params: Promise.resolve({ taskId }) },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, taskId);
  assert.equal(payload.data.kind, "generation");
});

test("GET /api/training/generation-tasks/:taskId/outputs returns generation outputs mapped into project results", async () => {
  const outputsRoute = await import("../src/app/api/training/generation-tasks/[taskId]/outputs/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const { generationRunId, outputResultId } = await createManagedCompletedRunFixtures();
    assert.ok(outputResultId, "completed-run fixture should expose an output result id");

    const response = await outputsRoute.GET(
      new Request(`http://localhost/api/training/generation-tasks/${generationRunId}/outputs`),
      { params: Promise.resolve({ taskId: generationRunId }) },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.data));
    assert.ok((payload.data as Array<{ id: string }>).some((result) => result.id === outputResultId));
    assert.ok(payload.data.every((result: { id: string; sourceLabel: string }) => typeof result.id === "string" && typeof result.sourceLabel === "string"));
  });
});

test("GET /api/training/section-runs/:runId reads generation run detail and POST cancel updates it through the section-run alias", async () => {
  const sectionRunRoute = await import("../src/app/api/training/section-runs/[runId]/route");
  const sectionRunCancelRoute = await import("../src/app/api/training/section-runs/[runId]/cancel/route");
  const {
    createManagedTrainingProject,
    enqueueManagedTrainingSectionGenerationRun,
  } = await import("../src/server/services/training/project-service");

  const createdProject = await createManagedTrainingProject({
    title: `Section Run Alias ${Date.now()}`,
    characterName: "Section Run Alias",
    projectName: "Section Run Alias",
    triggerToken: `section_run_alias_${Date.now()}`,
    templateId: "character_identity_default",
    trainingTemplateId: "character_identity_default",
    checkpointRelativePath: "models/checkpoints/mock.safetensors",
    usagePrompt: "section run alias usage",
    detailPrompt: "section run alias detail",
    sections: [
      {
        id: "section-run-alias-section",
        title: "Section Run Alias Section",
        enabled: true,
        blockCount: 1,
        blocks: [
          {
            id: "section-run-alias-block",
            source: "本地",
            title: "Section Run Alias Block",
            text: "section run alias scene",
          },
        ],
        resolvedScene: "section run alias scene",
        scenePreview: "section run alias scene",
      },
    ],
    trainingDefaults: {
      autoGenerateSamples: false,
      autoFreezeDataset: false,
    },
  });
  const createdRun = await enqueueManagedTrainingSectionGenerationRun(createdProject.sections[0].id, {
    userInstruction: "section run alias test",
  });

  assert.ok(createdRun?.id, "expected a managed generation run for section-run alias tests");

  const getResponse = await sectionRunRoute.GET(
    new Request(`http://localhost/api/training/section-runs/${createdRun.id}`),
    { params: Promise.resolve({ runId: createdRun.id }) },
  );
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.data.id, createdRun.id);
  assert.equal(getPayload.data.kind, "generation");

  const cancelResponse = await sectionRunCancelRoute.POST(
    new Request(`http://localhost/api/training/section-runs/${createdRun.id}/cancel`, {
      method: "POST",
    }),
    { params: Promise.resolve({ runId: createdRun.id }) },
  );
  const cancelPayload = await cancelResponse.json();

  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelPayload.ok, true);
  assert.equal(cancelPayload.data.id, createdRun.id);
  assert.equal(cancelPayload.data.kind, "generation");
});

test("DELETE /api/training run detail routes hide managed runs from global and project-scoped lists", async () => {
  const generationDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const trainingDetailRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
  const projectGenerationRunsRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");
  const projectTrainingRunsRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const { generationRunId, projectId, trainingRunId } = await createManagedRunsForDeletionTest();

  const deleteGenerationResponse = await generationDetailRoute.DELETE(
    new Request(`http://localhost/api/training/generation-tasks/${generationRunId}`, { method: "DELETE" }),
    { params: Promise.resolve({ taskId: generationRunId }) },
  );
  const deleteGenerationPayload = await deleteGenerationResponse.json();

  assert.equal(deleteGenerationResponse.status, 200);
  assert.equal(deleteGenerationPayload.ok, true);
  assert.equal(deleteGenerationPayload.data.id, generationRunId);

  const deleteTrainingResponse = await trainingDetailRoute.DELETE(
    new Request(`http://localhost/api/training/training-runs/${trainingRunId}`, { method: "DELETE" }),
    { params: Promise.resolve({ trainingRunId }) },
  );
  const deleteTrainingPayload = await deleteTrainingResponse.json();

  assert.equal(deleteTrainingResponse.status, 200);
  assert.equal(deleteTrainingPayload.ok, true);
  assert.equal(deleteTrainingPayload.data.id, trainingRunId);

  const hiddenGenerationDetailResponse = await generationDetailRoute.GET(
    new Request(`http://localhost/api/training/generation-tasks/${generationRunId}`),
    { params: Promise.resolve({ taskId: generationRunId }) },
  );
  const hiddenGenerationDetailPayload = await hiddenGenerationDetailResponse.json();

  assert.equal(hiddenGenerationDetailResponse.status, 404);
  assert.equal(hiddenGenerationDetailPayload.ok, false);

  const hiddenTrainingDetailResponse = await trainingDetailRoute.GET(
    new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
    { params: Promise.resolve({ trainingRunId }) },
  );
  const hiddenTrainingDetailPayload = await hiddenTrainingDetailResponse.json();

  assert.equal(hiddenTrainingDetailResponse.status, 404);
  assert.equal(hiddenTrainingDetailPayload.ok, false);

  const generationRuns = await listRuns("?kind=generation");
  const trainingRuns = await listRuns("?kind=training");
  assert.ok(!generationRuns.some((run) => run.id === generationRunId), "deleted generation runs should disappear from the global training workspace");
  assert.ok(!trainingRuns.some((run) => run.id === trainingRunId), "deleted training runs should disappear from the global training workspace");

  const projectGenerationRunsResponse = await projectGenerationRunsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks`),
    { params: Promise.resolve({ projectId }) },
  );
  const projectGenerationRunsPayload = await projectGenerationRunsResponse.json();
  assert.equal(projectGenerationRunsResponse.status, 200);
  assert.equal(projectGenerationRunsPayload.ok, true);
  assert.ok(!projectGenerationRunsPayload.data.some((run: { id: string }) => run.id === generationRunId), "deleted generation runs should disappear from project-scoped lists");

  const projectTrainingRunsResponse = await projectTrainingRunsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/training-runs`),
    { params: Promise.resolve({ projectId }) },
  );
  const projectTrainingRunsPayload = await projectTrainingRunsResponse.json();
  assert.equal(projectTrainingRunsResponse.status, 200);
  assert.equal(projectTrainingRunsPayload.ok, true);
  assert.ok(!projectTrainingRunsPayload.data.some((run: { id: string }) => run.id === trainingRunId), "deleted training runs should disappear from project-scoped lists");
});

test("GET /api/training/presets and /api/training/templates expose training resource libraries", async () => {
  const presetsRoute = await import("../src/app/api/training/presets/route");
  const sceneDescriptionTreeRoute = await import("../src/app/api/training/scene-description/categories/route");
  const templatesRoute = await import("../src/app/api/training/templates/route");

  const [presetsResponse, sceneDescriptionTreeResponse, templatesResponse] = await Promise.all([
    presetsRoute.GET(),
    sceneDescriptionTreeRoute.GET(new Request("http://localhost/api/training/scene-description/categories")),
    templatesRoute.GET(),
  ]);
  const [presetsPayload, sceneDescriptionTreePayload, templatesPayload] = await Promise.all([
    presetsResponse.json(),
    sceneDescriptionTreeResponse.json(),
    templatesResponse.json(),
  ]);

  assert.equal(presetsResponse.status, 200);
  assert.equal(presetsPayload.ok, true);
  assert.ok(Array.isArray(presetsPayload.data));
  assert.ok(presetsPayload.data.some((preset: { id: string }) => preset.id === "rainy-street"));
  const builtInPresetUsages = (presetsPayload.data as Array<{ id: string; projectUsage: string[] }>)
    .filter((preset) => ["cyan-rim-light", "rainy-street", "white-studio"].includes(preset.id))
    .flatMap((preset) => preset.projectUsage);
  assert.ok(builtInPresetUsages.every((usage) => !/Vela Neon Jacket|Noir Runner/i.test(usage)));
  assert.equal(sceneDescriptionTreeResponse.status, 200);
  assert.equal(sceneDescriptionTreePayload.ok, true);
  assert.ok(Array.isArray(sceneDescriptionTreePayload.data.categories));
  assert.ok(sceneDescriptionTreePayload.data.categories.length > 0);
  assert.ok(sceneDescriptionTreePayload.data.categories.some((category: {
    folders?: Array<{ presets: Array<{ id: string }> }>;
    presets: Array<{ id: string }>;
  }) =>
    category.presets.some((preset) => preset.id === "rainy-street")
    || (category.folders ?? []).some((folder) => folder.presets.some((preset) => preset.id === "rainy-street"))),
  );

  assert.equal(templatesResponse.status, 200);
  assert.equal(templatesPayload.ok, true);
  assert.ok(Array.isArray(templatesPayload.data));
  assert.ok(templatesPayload.data.length > 0);
  assert.equal(typeof templatesPayload.data[0]?.id, "string");
  assert.equal(typeof templatesPayload.data[0]?.title, "string");
  assert.ok(templatesPayload.data.some((template: { sectionCount: number }) => template.sectionCount >= 1));
  assert.ok(templatesPayload.data.some((template: { sections: Array<{ title: string }> }) => template.sections.some((section) => section.title.length > 0)));
});

test("training preset routes create, update, read, and delete presets through /api/training", async () => {
  const presetsRoute = await import("../src/app/api/training/presets/route");
  const presetDetailRoute = await import("../src/app/api/training/presets/[presetId]/route");
  const presetName = `测试训练预制 ${Date.now()}`;

  const createResponse = await presetsRoute.POST(
    new Request("http://localhost/api/training/presets", {
      method: "POST",
      body: JSON.stringify({
        title: presetName,
        category: "测试分类",
        folder: "测试文件夹",
        sceneDescriptionText: "测试训练场景描述文本。",
      }),
    }),
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(typeof createPayload.data.id, "string");
  assert.equal(createPayload.data.title, presetName);
  assert.equal(createPayload.data.sceneDescriptionText, "测试训练场景描述文本。");

  const presetId = createPayload.data.id as string;
  const detailParams = { params: Promise.resolve({ presetId }) };
  const presetUsageRoute = await import("../src/app/api/training/scene-description/presets/[presetId]/usage/route");
  const presetCascadeRoute = await import("../src/app/api/training/scene-description/presets/[presetId]/cascade/route");

  const updateResponse = await presetDetailRoute.PATCH(
    new Request(`http://localhost/api/training/presets/${presetId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: `${presetName} 已更新`,
        category: "测试分类",
        folder: "测试文件夹",
        sceneDescriptionText: "更新后的训练场景描述文本。",
      }),
    }),
    detailParams,
  );
  const updatePayload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.data.title, `${presetName} 已更新`);
  assert.equal(updatePayload.data.sceneDescriptionText, "更新后的训练场景描述文本。");

  const getResponse = await presetDetailRoute.GET(
    new Request(`http://localhost/api/training/presets/${presetId}`),
    detailParams,
  );
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.data.id, presetId);
  assert.equal(getPayload.data.title, `${presetName} 已更新`);

  const usageResponse = await presetUsageRoute.GET(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}/usage`),
    detailParams,
  );
  const usagePayload = await usageResponse.json();

  assert.equal(usageResponse.status, 200);
  assert.equal(usagePayload.ok, true);
  assert.ok(Array.isArray(usagePayload.data.projectUsage));
  assert.ok(Array.isArray(usagePayload.data.templateUsage));

  const deleteResponse = await presetCascadeRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}/cascade`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    }),
    detailParams,
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
});

test("scene-description preset alias routes mirror training preset CRUD under /api/training", async () => {
  const presetAliasRoute = await import("../src/app/api/training/scene-description/presets/route");
  const presetAliasDetailRoute = await import("../src/app/api/training/scene-description/presets/[presetId]/route");
  const presetName = `场景描述 alias 预制 ${Date.now()}`;

  const createResponse = await presetAliasRoute.POST(
    new Request("http://localhost/api/training/scene-description/presets", {
      method: "POST",
      body: JSON.stringify({
        title: presetName,
        category: "别名测试分类",
        folder: "别名测试文件夹",
        sceneDescriptionText: "别名创建的训练场景描述文本。",
      }),
    }),
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(createPayload.ok, true);
  assert.equal(typeof createPayload.data.id, "string");
  assert.equal(createPayload.data.title, presetName);

  const presetId = createPayload.data.id as string;
  const detailParams = { params: Promise.resolve({ presetId }) };

  const updateResponse = await presetAliasDetailRoute.PATCH(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: `${presetName} 已更新`,
        category: "别名测试分类",
        folder: "别名测试文件夹",
        sceneDescriptionText: "别名更新后的训练场景描述文本。",
      }),
    }),
    detailParams,
  );
  const updatePayload = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.ok, true);
  assert.equal(updatePayload.data.title, `${presetName} 已更新`);
  assert.equal(updatePayload.data.sceneDescriptionText, "别名更新后的训练场景描述文本。");

  const getResponse = await presetAliasDetailRoute.GET(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}`),
    detailParams,
  );
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.data.id, presetId);
  assert.equal(getPayload.data.title, `${presetName} 已更新`);

  const deleteResponse = await presetAliasDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}`, {
      method: "DELETE",
    }),
    detailParams,
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
  assert.equal(deletePayload.data.success, true);
});

test("scene-description category and folder routes create, update, guard non-empty delete, and delete through /api/training", async () => {
  const categoryTreeRoute = await import("../src/app/api/training/scene-description/categories/route");
  const categoryDetailRoute = await import("../src/app/api/training/scene-description/categories/[categoryId]/route");
  const folderCreateRoute = await import("../src/app/api/training/scene-description/folders/route");
  const folderDetailRoute = await import("../src/app/api/training/scene-description/folders/[folderId]/route");
  const presetAliasRoute = await import("../src/app/api/training/scene-description/presets/route");
  const presetAliasDetailRoute = await import("../src/app/api/training/scene-description/presets/[presetId]/route");

  const categoryName = `分类 CRUD ${Date.now()}`;
  const categorySlug = `training-category-crud-${Date.now()}`;
  const folderName = `文件夹 CRUD ${Date.now()}`;

  const createCategoryResponse = await categoryTreeRoute.POST(
    new Request("http://localhost/api/training/scene-description/categories", {
      method: "POST",
      body: JSON.stringify({
        name: categoryName,
        slug: categorySlug,
        icon: "FolderTree",
        color: "hsl(160 72% 42%)",
        sortOrder: 91,
        sceneDescriptionOrder: 17,
      }),
    }),
  );
  const createCategoryPayload = await createCategoryResponse.json();

  assert.equal(createCategoryResponse.status, 200);
  assert.equal(createCategoryPayload.ok, true);
  assert.equal(createCategoryPayload.data.name, categoryName);
  assert.equal(createCategoryPayload.data.slug, categorySlug);
  assert.equal(createCategoryPayload.data.sceneDescriptionOrder, 17);

  const categoryId = createCategoryPayload.data.id as string;
  const categoryParams = { params: Promise.resolve({ categoryId }) };

  const updateCategoryResponse = await categoryDetailRoute.PATCH(
    new Request(`http://localhost/api/training/scene-description/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: `${categoryName} 已更新`,
        icon: "Folders",
        color: "hsl(190 72% 42%)",
        sortOrder: 92,
        sceneDescriptionOrder: 23,
      }),
    }),
    categoryParams,
  );
  const updateCategoryPayload = await updateCategoryResponse.json();

  assert.equal(updateCategoryResponse.status, 200);
  assert.equal(updateCategoryPayload.ok, true);
  assert.equal(updateCategoryPayload.data.name, `${categoryName} 已更新`);
  assert.equal(updateCategoryPayload.data.sceneDescriptionOrder, 23);

  const createFolderResponse = await folderCreateRoute.POST(
    new Request("http://localhost/api/training/scene-description/folders", {
      method: "POST",
      body: JSON.stringify({
        categoryId,
        name: folderName,
        sortOrder: 7,
      }),
    }),
  );
  const createFolderPayload = await createFolderResponse.json();

  assert.equal(createFolderResponse.status, 200);
  assert.equal(createFolderPayload.ok, true);
  assert.equal(createFolderPayload.data.categoryId, categoryId);
  assert.equal(createFolderPayload.data.name, folderName);

  const folderId = createFolderPayload.data.id as string;
  const folderParams = { params: Promise.resolve({ folderId }) };

  const updateFolderResponse = await folderDetailRoute.PATCH(
    new Request(`http://localhost/api/training/scene-description/folders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: `${folderName} 已更新`,
        sortOrder: 11,
      }),
    }),
    folderParams,
  );
  const updateFolderPayload = await updateFolderResponse.json();

  assert.equal(updateFolderResponse.status, 200);
  assert.equal(updateFolderPayload.ok, true);
  assert.equal(updateFolderPayload.data.name, `${folderName} 已更新`);
  assert.equal(updateFolderPayload.data.sortOrder, 11);

  const foldersResponse = await folderCreateRoute.GET(
    new Request("http://localhost/api/training/scene-description/folders"),
  );
  const foldersPayload = await foldersResponse.json();

  assert.equal(foldersResponse.status, 200);
  assert.equal(foldersPayload.ok, true);
  assert.ok(Array.isArray(foldersPayload.data.folders));
  assert.ok(foldersPayload.data.folders.some((folder: {
    categoryId: string;
    id: string;
    name: string;
  }) => folder.id === folderId
    && folder.categoryId === categoryId
    && folder.name === `${folderName} 已更新`));

  const treeResponse = await categoryTreeRoute.GET(
    new Request("http://localhost/api/training/scene-description/categories"),
  );
  const treePayload = await treeResponse.json();

  assert.equal(treeResponse.status, 200);
  assert.equal(treePayload.ok, true);
  assert.ok(treePayload.data.categories.some((category: {
    folders?: Array<{ id: string; name: string }>;
    id: string;
  }) => category.id === categoryId && (category.folders ?? []).some((folder) => folder.id === folderId)));

  const createPresetResponse = await presetAliasRoute.POST(
    new Request("http://localhost/api/training/scene-description/presets", {
      method: "POST",
      body: JSON.stringify({
        title: `分类文件夹约束预制 ${Date.now()}`,
        category: `${categoryName} 已更新`,
        folder: `${folderName} 已更新`,
        sceneDescriptionText: "用于验证非空分类/文件夹不可直接删除。",
      }),
    }),
  );
  const createPresetPayload = await createPresetResponse.json();

  assert.equal(createPresetResponse.status, 200);
  assert.equal(createPresetPayload.ok, true);

  const presetId = createPresetPayload.data.id as string;
  const presetParams = { params: Promise.resolve({ presetId }) };

  const deleteNonEmptyFolderResponse = await folderDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/folders/${folderId}`, {
      method: "DELETE",
    }),
    folderParams,
  );
  const deleteNonEmptyFolderPayload = await deleteNonEmptyFolderResponse.json();
  assert.equal(deleteNonEmptyFolderResponse.status, 409);
  assert.equal(deleteNonEmptyFolderPayload.ok, false);

  const deleteNonEmptyCategoryResponse = await categoryDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/categories/${categoryId}`, {
      method: "DELETE",
    }),
    categoryParams,
  );
  const deleteNonEmptyCategoryPayload = await deleteNonEmptyCategoryResponse.json();
  assert.equal(deleteNonEmptyCategoryResponse.status, 409);
  assert.equal(deleteNonEmptyCategoryPayload.ok, false);

  const deletePresetResponse = await presetAliasDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/presets/${presetId}`, {
      method: "DELETE",
    }),
    presetParams,
  );
  const deletePresetPayload = await deletePresetResponse.json();
  assert.equal(deletePresetResponse.status, 200);
  assert.equal(deletePresetPayload.ok, true);

  const deleteFolderResponse = await folderDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/folders/${folderId}`, {
      method: "DELETE",
    }),
    folderParams,
  );
  const deleteFolderPayload = await deleteFolderResponse.json();
  assert.equal(deleteFolderResponse.status, 200);
  assert.equal(deleteFolderPayload.ok, true);
  assert.equal(deleteFolderPayload.data.success, true);

  const deleteCategoryResponse = await categoryDetailRoute.DELETE(
    new Request(`http://localhost/api/training/scene-description/categories/${categoryId}`, {
      method: "DELETE",
    }),
    categoryParams,
  );
  const deleteCategoryPayload = await deleteCategoryResponse.json();
  assert.equal(deleteCategoryResponse.status, 200);
  assert.equal(deleteCategoryPayload.ok, true);
  assert.equal(deleteCategoryPayload.data.success, true);
});

test("generation output apply can add a managed output into project reference images through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const resultUploadRoute = await import("../src/app/api/training/projects/[projectId]/image-results/upload/route");
  const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const schedulerTickRoute = await import("../src/app/api/training/scheduler/tick/route");
  const workerGenerationCompleteRoute = await import("../src/app/api/training/worker/generation-tasks/[taskId]/complete/route");
  const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const generationOutputApplyRoute = await import("../src/app/api/training/generation-outputs/[outputId]/apply/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const title = `测试输出应用项目 ${Date.now()}`;
    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `test_output_apply_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "测试输出应用提示词",
          detailPrompt: "测试输出应用细节",
          selectedReferenceIds: [seedProject.projectSelectionId],
          sections: [
            {
              id: "output-apply-section",
              title: "输出应用小节",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "output-apply-block",
                  source: "本地",
                  title: "输出应用 block",
                  text: "output apply 场景描述",
                },
              ],
              resolvedScene: "output apply 场景描述",
              scenePreview: "output apply 场景描述",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const projectId = createPayload.data.id as string;
    const sectionId = createPayload.data.sections[0].id as string;
    const projectParams = { params: Promise.resolve({ projectId }) };

    const beforeReferenceResponse = await referenceRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
      projectParams,
    );
    const beforeReferencePayload = await beforeReferenceResponse.json();
    assert.equal(beforeReferenceResponse.status, 200);
    assert.equal(beforeReferencePayload.ok, true);
    const beforeReferenceCount = beforeReferencePayload.data.length as number;

    const runResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          userInstruction: "output apply generation",
        }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const runPayload = await runResponse.json();
    assert.equal(runResponse.status, 201);
    assert.equal(runPayload.ok, true);
    const taskId = runPayload.data.id as string;

    const tickResponse = await schedulerTickRoute.POST();
    const tickPayload = await tickResponse.json();
    assert.equal(tickResponse.status, 200);
    assert.equal(tickPayload.ok, true);
    assert.equal(tickPayload.data.id, taskId);

    const uploadFormData = new FormData();
    uploadFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "managed-output-apply.png", { type: "image/png" }));
    uploadFormData.append("sectionId", sectionId);
    uploadFormData.append("captionDraft", "用于应用到资料图的输出");
    uploadFormData.append("reviewStatus", "keep");
    const uploadResultResponse = await resultUploadRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/image-results/upload`, {
        method: "POST",
        body: uploadFormData,
      }),
      projectParams,
    );
    const uploadResultPayload = await uploadResultResponse.json();
    assert.equal(uploadResultResponse.status, 201);
    assert.equal(uploadResultPayload.ok, true);
    const uploadedResultId = uploadResultPayload.data.id as string;

    const completeResponse = await workerGenerationCompleteRoute.POST(
      new Request(`http://localhost/api/training/worker/generation-tasks/${taskId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          resultImageResultId: uploadedResultId,
        }),
      }),
      { params: Promise.resolve({ taskId }) },
    );
    const completePayload = await completeResponse.json();
    assert.equal(completeResponse.status, 200);
    assert.equal(completePayload.ok, true);

    const taskDetailResponse = await generationTaskDetailRoute.GET(
      new Request(`http://localhost/api/training/generation-tasks/${taskId}`),
      { params: Promise.resolve({ taskId }) },
    );
    const taskDetailPayload = await taskDetailResponse.json();
    assert.equal(taskDetailResponse.status, 200);
    assert.equal(taskDetailPayload.ok, true);
    const outputId = taskDetailPayload.data.outputResultIds[0] as string;

    const applyResponse = await generationOutputApplyRoute.POST(
      new Request(`http://localhost/api/training/generation-outputs/${outputId}/apply`, {
        method: "POST",
        body: JSON.stringify({
          targetEntityType: "reference_image",
          targetEntityId: projectId,
        }),
      }),
      { params: Promise.resolve({ outputId }) },
    );
    const applyPayload = await applyResponse.json();
    assert.equal(applyResponse.status, 200);
    assert.equal(applyPayload.ok, true);
    assert.equal(applyPayload.data.targetEntityType, "reference_image");
    assert.equal(applyPayload.data.targetEntityId, projectId);
    assert.equal(applyPayload.data.created, true);
    assert.equal(applyPayload.data.result.kind, "generated");

    const afterReferenceResponse = await referenceRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
      projectParams,
    );
    const afterReferencePayload = await afterReferenceResponse.json();
    assert.equal(afterReferenceResponse.status, 200);
    assert.equal(afterReferencePayload.ok, true);
    assert.equal(afterReferencePayload.data.length, beforeReferenceCount + 1);

    const repeatApplyResponse = await generationOutputApplyRoute.POST(
      new Request(`http://localhost/api/training/generation-outputs/${outputId}/apply`, {
        method: "POST",
        body: JSON.stringify({
          targetEntityType: "reference_image",
          targetEntityId: projectId,
        }),
      }),
      { params: Promise.resolve({ outputId }) },
    );
    const repeatApplyPayload = await repeatApplyResponse.json();
    assert.equal(repeatApplyResponse.status, 200);
    assert.equal(repeatApplyPayload.ok, true);
    assert.equal(repeatApplyPayload.data.created, false);
  });
});

test("generation output apply can idempotently project a production candidate output into reference images through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const generationOutputApplyRoute = await import("../src/app/api/training/generation-outputs/[outputId]/apply/route");

  const title = `测试真实输出应用项目 ${Date.now()}`;
  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_real_output_apply_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        baseModel: "继承训练默认模型",
        captionStrategy: "先触发词后描述",
        usagePrompt: "测试真实输出应用提示词",
        detailPrompt: "测试真实输出应用细节描述",
        perSectionImageCount: "4",
        trainingSteps: "2400",
        selectedReferenceIds: [],
        sections: [
          {
            id: "real-output-section",
            title: "真实输出应用小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "real-output-block",
                source: "本地",
                title: "本地场景描述",
                text: "真实输出应用场景描述",
              },
            ],
            resolvedScene: "真实输出应用场景描述",
            scenePreview: "真实输出应用场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);

  const projectId = createPayload.data.id as string;
  const params = { params: Promise.resolve({ projectId }) };

  const referenceUploadFormData = new FormData();
  referenceUploadFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "production-output-source.png", { type: "image/png" }));
  referenceUploadFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: referenceUploadFormData,
    }),
    params,
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);

  const beforeReferenceResponse = await referenceRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
    params,
  );
  const beforeReferencePayload = await beforeReferenceResponse.json();
  assert.equal(beforeReferenceResponse.status, 200);
  assert.equal(beforeReferencePayload.ok, true);
  const beforeReferenceCount = beforeReferencePayload.data.length as number;
  const imageId = uploadReferencePayload.data.id as string;

  const candidateResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "pending",
        captionDraft: "真实输出应用候选图",
      }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const candidatePayload = await candidateResponse.json();
  assert.equal(candidateResponse.status, 201);
  assert.equal(candidatePayload.ok, true);
  const outputId = candidatePayload.data.id as string;

  const applyResponse = await generationOutputApplyRoute.POST(
    new Request(`http://localhost/api/training/generation-outputs/${outputId}/apply`, {
      method: "POST",
      body: JSON.stringify({
        targetEntityType: "reference_image",
        targetEntityId: projectId,
      }),
    }),
    { params: Promise.resolve({ outputId }) },
  );
  const applyPayload = await applyResponse.json();
  assert.equal(applyResponse.status, 200);
  assert.equal(applyPayload.ok, true);
  assert.equal(applyPayload.data.targetEntityType, "reference_image");
  assert.equal(applyPayload.data.targetEntityId, projectId);

  const afterReferenceResponse = await referenceRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
    params,
  );
  const afterReferencePayload = await afterReferenceResponse.json();
  assert.equal(afterReferenceResponse.status, 200);
  assert.equal(afterReferencePayload.ok, true);
  assert.ok(afterReferencePayload.data.length >= beforeReferenceCount);

  const repeatApplyResponse = await generationOutputApplyRoute.POST(
    new Request(`http://localhost/api/training/generation-outputs/${outputId}/apply`, {
      method: "POST",
      body: JSON.stringify({
        targetEntityType: "reference_image",
        targetEntityId: projectId,
      }),
    }),
    { params: Promise.resolve({ outputId }) },
  );
  const repeatApplyPayload = await repeatApplyResponse.json();
  assert.equal(repeatApplyResponse.status, 200);
  assert.equal(repeatApplyPayload.ok, true);
  assert.equal(repeatApplyPayload.data.created, false);
});

test("training preset sort rules reorder categories and presets through /api/training", async () => {
  const presetsRoute = await import("../src/app/api/training/presets/route");
  const sortRulesRoute = await import("../src/app/api/training/presets/sort-rules/route");

  const originalResponse = await presetsRoute.GET();
  const originalPayload = await originalResponse.json();
  const originalPresets = originalPayload.data as Array<{ category: string; id: string }>;
  const originalCategoryOrder = [...new Set(originalPresets.map((preset) => preset.category))];
  const originalPresetOrder = originalPresets.map((preset) => preset.id);

  const reversedCategoryOrder = [...originalCategoryOrder].reverse();
  const reversedPresetOrder = [...originalPresetOrder].reverse();

  const reorderResponse = await sortRulesRoute.POST(
    new Request("http://localhost/api/training/presets/sort-rules", {
      method: "POST",
      body: JSON.stringify({
        categoryOrder: reversedCategoryOrder,
        presetOrder: reversedPresetOrder,
      }),
    }),
  );
  const reorderPayload = await reorderResponse.json();

  assert.equal(reorderResponse.status, 200);
  assert.equal(reorderPayload.ok, true);
  assert.equal(reorderPayload.data.categoryOrder[0], reversedCategoryOrder[0]);
  assert.equal(reorderPayload.data.presetOrder[0], reversedPresetOrder[0]);

  const afterResponse = await presetsRoute.GET();
  const afterPayload = await afterResponse.json();
  const afterPresets = afterPayload.data as Array<{ category: string; id: string }>;
  const afterCategoryOrder = [...new Set(afterPresets.map((preset) => preset.category))];

  assert.equal(afterResponse.status, 200);
  assert.equal(afterPayload.ok, true);
  assert.equal(afterCategoryOrder[0], reversedCategoryOrder[0]);

  await sortRulesRoute.POST(
    new Request("http://localhost/api/training/presets/sort-rules", {
      method: "POST",
      body: JSON.stringify({
        categoryOrder: originalCategoryOrder,
        presetOrder: originalPresetOrder,
      }),
    }),
  );
});

test("training template routes create, update, read, and delete templates through /api/training", async () => {
  const templatesRoute = await import("../src/app/api/training/templates/route");
  const templateDetailRoute = await import("../src/app/api/training/templates/[templateId]/route");
  const templateSectionsRoute = await import("../src/app/api/training/templates/[templateId]/sections/route");
  const templateSectionReorderRoute = await import("../src/app/api/training/templates/[templateId]/sections/reorder/route");
  const sectionRoute = await import("../src/app/api/training/templates/[templateId]/sections/[sectionId]/route");
  const templateBlockRoute = await import("../src/app/api/training/templates/[templateId]/blocks/[blockId]/route");
  const templateBlockCollectionRoute = await import("../src/app/api/training/templates/[templateId]/sections/[sectionId]/blocks/route");
  const templateBlockReorderRoute = await import("../src/app/api/training/templates/[templateId]/sections/[sectionId]/blocks/reorder/route");
  const templateTitle = `测试训练模板 ${Date.now()}`;

  const createResponse = await templatesRoute.POST(
    new Request("http://localhost/api/training/templates", {
      method: "POST",
      body: JSON.stringify({
        title: templateTitle,
        description: "模板描述",
        imageGuidance: "图片指引",
        captionGuidance: "说明文本指引",
        sections: [
          {
            id: "template-section-1",
            title: "模板小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "template-block-1",
                source: "本地",
                title: "本地场景描述",
                text: "模板文本",
              },
            ],
            resolvedScene: "模板文本",
            scenePreview: "模板文本",
          },
        ],
      }),
    }),
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.data.title, templateTitle);
  assert.equal(createPayload.data.sections.length, 1);

  const templateId = createPayload.data.id as string;
  const sectionId = createPayload.data.sections[0].id as string;
  const detailParams = { params: Promise.resolve({ templateId }) };

  const patchResponse = await templateDetailRoute.PATCH(
    new Request(`http://localhost/api/training/templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: `${templateTitle} 已更新`,
        description: "更新模板描述",
        imageGuidance: "更新图片指引",
        captionGuidance: "更新说明文本指引",
        sections: createPayload.data.sections,
      }),
    }),
    detailParams,
  );
  const patchPayload = await patchResponse.json();

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.ok, true);
  assert.equal(patchPayload.data.title, `${templateTitle} 已更新`);

  const sectionPatchResponse = await sectionRoute.PATCH(
    new Request(`http://localhost/api/training/templates/${templateId}/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "模板小节已更新",
        enabled: true,
        blocks: [
          {
            id: "template-block-1",
            source: "本地",
            title: "本地场景描述",
            text: "模板文本已更新",
          },
        ],
        resolvedScene: "模板文本已更新",
        scenePreview: "模板文本已更新",
      }),
    }),
    { params: Promise.resolve({ templateId, sectionId }) },
  );
  const sectionPatchPayload = await sectionPatchResponse.json();

  assert.equal(sectionPatchResponse.status, 200);
  assert.equal(sectionPatchPayload.ok, true);
  assert.equal(sectionPatchPayload.data.sections[0].title, "模板小节已更新");

  const createBlockResponse = await templateBlockCollectionRoute.POST(
    new Request(`http://localhost/api/training/templates/${templateId}/sections/${sectionId}/blocks`, {
      method: "POST",
      body: JSON.stringify({
        source: "本地",
        title: "新增模板块",
        text: "新增模板块内容",
      }),
    }),
    { params: Promise.resolve({ templateId, sectionId }) },
  );
  const createBlockPayload = await createBlockResponse.json();

  assert.equal(createBlockResponse.status, 201);
  assert.equal(createBlockPayload.ok, true);
  assert.equal(createBlockPayload.data.title, "新增模板块");

  const createdBlockId = createBlockPayload.data.id as string;
  const updateBlockResponse = await templateBlockRoute.PATCH(
    new Request(`http://localhost/api/training/templates/${templateId}/blocks/${createdBlockId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "新增模板块已更新",
        text: "新增模板块内容已更新",
      }),
    }),
    { params: Promise.resolve({ templateId, blockId: createdBlockId }) },
  );
  const updateBlockPayload = await updateBlockResponse.json();

  assert.equal(updateBlockResponse.status, 200);
  assert.equal(updateBlockPayload.ok, true);
  assert.equal(updateBlockPayload.data.title, "新增模板块已更新");

  const reorderBlockResponse = await templateBlockReorderRoute.POST(
    new Request(`http://localhost/api/training/templates/${templateId}/sections/${sectionId}/blocks/reorder`, {
      method: "POST",
      body: JSON.stringify({
        ids: [createdBlockId, "template-block-1"],
      }),
    }),
    { params: Promise.resolve({ templateId, sectionId }) },
  );
  const reorderBlockPayload = await reorderBlockResponse.json();

  assert.equal(reorderBlockResponse.status, 200);
  assert.equal(reorderBlockPayload.ok, true);
  assert.deepEqual(
    reorderBlockPayload.data.map((block: { id: string }) => block.id),
    [createdBlockId, "template-block-1"],
  );

  const deleteBlockResponse = await templateBlockRoute.DELETE(
    new Request(`http://localhost/api/training/templates/${templateId}/blocks/${createdBlockId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ templateId, blockId: createdBlockId }) },
  );
  const deleteBlockPayload = await deleteBlockResponse.json();

  assert.equal(deleteBlockResponse.status, 200);
  assert.equal(deleteBlockPayload.ok, true);
  assert.equal(deleteBlockPayload.data.success, true);

  const addSectionResponse = await templateSectionsRoute.POST(
    new Request(`http://localhost/api/training/templates/${templateId}/sections`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ templateId }) },
  );
  const addSectionPayload = await addSectionResponse.json();

  assert.equal(addSectionResponse.status, 201);
  assert.equal(addSectionPayload.ok, true);
  assert.equal(addSectionPayload.data.sections.length, 2);

  const addedSectionId = addSectionPayload.data.sections[1].id as string;

  const copySectionResponse = await templateSectionsRoute.POST(
    new Request(`http://localhost/api/training/templates/${templateId}/sections`, {
      method: "POST",
      body: JSON.stringify({
        sourceSectionId: sectionId,
      }),
    }),
    { params: Promise.resolve({ templateId }) },
  );
  const copySectionPayload = await copySectionResponse.json();

  assert.equal(copySectionResponse.status, 201);
  assert.equal(copySectionPayload.ok, true);
  assert.equal(copySectionPayload.data.sections.length, 3);

  const copySectionId = (copySectionPayload.data.sections as Array<{ id: string }>)
    .map((section) => section.id)
    .find((id) => id !== sectionId && id !== addedSectionId);
  assert.ok(copySectionId, "template section copy should create a distinct copied section id");

  const reorderedTemplateSectionIds = [
    copySectionId,
    sectionId,
    addedSectionId,
  ];
  const reorderSectionResponse = await templateSectionReorderRoute.POST(
    new Request(`http://localhost/api/training/templates/${templateId}/sections/reorder`, {
      method: "POST",
      body: JSON.stringify({
        orderedSectionIds: reorderedTemplateSectionIds,
      }),
    }),
    { params: Promise.resolve({ templateId }) },
  );
  const reorderSectionPayload = await reorderSectionResponse.json();

  assert.equal(reorderSectionResponse.status, 200);
  assert.equal(reorderSectionPayload.ok, true);
  assert.deepEqual(
    reorderSectionPayload.data.sections.map((section: { id: string }) => section.id),
    reorderedTemplateSectionIds,
  );

  const deleteSectionResponse = await sectionRoute.DELETE(
    new Request(`http://localhost/api/training/templates/${templateId}/sections/${addedSectionId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ templateId, sectionId: addedSectionId }) },
  );
  const deleteSectionPayload = await deleteSectionResponse.json();

  assert.equal(deleteSectionResponse.status, 200);
  assert.equal(deleteSectionPayload.ok, true);
  assert.equal(deleteSectionPayload.data.sections.length, 2);

  const getResponse = await templateDetailRoute.GET(
    new Request(`http://localhost/api/training/templates/${templateId}`),
    detailParams,
  );
  const getPayload = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.ok, true);
  assert.equal(getPayload.data.id, templateId);

  const deleteResponse = await templateDetailRoute.DELETE(
    new Request(`http://localhost/api/training/templates/${templateId}`, { method: "DELETE" }),
    detailParams,
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
});

test("training template route can create a project from an existing template through /api/training", async () => {
  const templatesRoute = await import("../src/app/api/training/templates/route");
  const templateDetailRoute = await import("../src/app/api/training/templates/[templateId]/route");
  const templateProjectsRoute = await import("../src/app/api/training/templates/[templateId]/projects/route");
  const templatesResponse = await templatesRoute.GET();
  const templatesPayload = await templatesResponse.json();

  assert.equal(templatesResponse.status, 200);
  assert.equal(templatesPayload.ok, true);

  const template = (templatesPayload.data as Array<{ id: string; sectionCount: number; title: string }>).find((item) => item.sectionCount > 0)
    ?? templatesPayload.data[0];
  const templateDetailResponse = await templateDetailRoute.GET(
    new Request(`http://localhost/api/training/templates/${template.id}`),
    { params: Promise.resolve({ templateId: template.id }) },
  );
  const templateDetailPayload = await templateDetailResponse.json();

  assert.equal(templateDetailResponse.status, 200);
  assert.equal(templateDetailPayload.ok, true);

  const projectTitle = `模板建项目 ${Date.now()}`;
  const createResponse = await templateProjectsRoute.POST(
    new Request(`http://localhost/api/training/templates/${template.id}/projects`, {
      method: "POST",
      body: JSON.stringify({
        title: projectTitle,
        characterName: projectTitle,
        triggerToken: `template_to_project_${Date.now()}`,
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        usagePrompt: "模板建项目测试",
        detailPrompt: "模板建项目详情",
      }),
    }),
    { params: Promise.resolve({ templateId: template.id }) },
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.data.title, projectTitle);
  assert.equal(createPayload.data.sections.length, templateDetailPayload.data.sections.length);
});

test("training template reorder route persists managed template order through /api/training", async () => {
  const templatesRoute = await import("../src/app/api/training/templates/route");
  const templateReorderRoute = await import("../src/app/api/training/templates/reorder/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const initialResponse = await templatesRoute.GET();
    const initialPayload = await initialResponse.json();

    assert.equal(initialResponse.status, 200);
    assert.equal(initialPayload.ok, true);

    const initialTemplates = initialPayload.data as Array<{ id: string }>;
    assert.ok(initialTemplates.length >= 2, "template reorder test needs at least two templates");

    const reorderedIds = [...initialTemplates.map((template) => template.id)].reverse();
    const reorderResponse = await templateReorderRoute.POST(
      new Request("http://localhost/api/training/templates/reorder", {
        method: "POST",
        body: JSON.stringify({
          orderedTemplateIds: reorderedIds,
        }),
      }),
    );
    const reorderPayload = await reorderResponse.json();

    assert.equal(reorderResponse.status, 200);
    assert.equal(reorderPayload.ok, true);
    assert.deepEqual(reorderPayload.data.orderedTemplateIds, reorderedIds);

    const afterResponse = await templatesRoute.GET();
    const afterPayload = await afterResponse.json();

    assert.equal(afterResponse.status, 200);
    assert.equal(afterPayload.ok, true);
    assert.deepEqual(
      (afterPayload.data as Array<{ id: string }>).map((template) => template.id).slice(0, reorderedIds.length),
      reorderedIds,
    );
  });
});

test("newly created managed training template can immediately create a project through /api/training", async () => {
  const templatesRoute = await import("../src/app/api/training/templates/route");
  const templateProjectsRoute = await import("../src/app/api/training/templates/[templateId]/projects/route");

  await withTrainingManagedStoreSnapshot(async () => {
    const templateTitle = `即时建项目模板 ${Date.now()}`;
    const createTemplateResponse = await templatesRoute.POST(
      new Request("http://localhost/api/training/templates", {
        method: "POST",
        body: JSON.stringify({
          title: templateTitle,
          description: "即时建项目模板描述",
          imageGuidance: "即时建项目图片要求",
          captionGuidance: "即时建项目说明文本要求",
          sections: [
            {
              id: "instant-project-template-section",
              title: "即时模板小节",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "instant-project-template-block",
                  source: "本地",
                  title: "即时模板场景块",
                  text: "即时模板场景描述",
                },
              ],
              resolvedScene: "即时模板场景描述",
              scenePreview: "即时模板场景描述",
            },
          ],
        }),
      }),
    );
    const createTemplatePayload = await createTemplateResponse.json();
    assert.equal(createTemplateResponse.status, 201);
    assert.equal(createTemplatePayload.ok, true);

    const templateId = createTemplatePayload.data.id as string;
    const projectTitle = `即时模板建项目 ${Date.now()}`;
    const createProjectResponse = await templateProjectsRoute.POST(
      new Request(`http://localhost/api/training/templates/${templateId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          title: projectTitle,
          characterName: projectTitle,
          triggerToken: `instant_template_project_${Date.now()}`,
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "即时模板建项目使用提示词",
          detailPrompt: "即时模板建项目细节描述",
          sections: [
            {
              id: "instant-project-template-section",
              title: "前端调整后的小节种子",
              enabled: false,
              blockCount: 1,
              blocks: [
                {
                  id: "instant-project-template-block",
                  source: "本地",
                  title: "前端调整后的场景块",
                  text: "前端调整后的场景描述",
                },
              ],
              resolvedScene: "前端调整后的场景描述",
              scenePreview: "前端调整后的场景描述",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ templateId }) },
    );
    const createProjectPayload = await createProjectResponse.json();
    assert.equal(createProjectResponse.status, 201);
    assert.equal(createProjectPayload.ok, true);
    assert.equal(createProjectPayload.data.title, projectTitle);
    assert.equal(createProjectPayload.data.sections.length, 1);
    assert.equal(createProjectPayload.data.sections[0].title, "前端调整后的小节种子");
    assert.equal(createProjectPayload.data.sections[0].enabled, false);
  });
});

test("training project route creates a project from the product payload through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const beforeResponse = await projectsRoute.GET(new Request("http://localhost/api/training/projects"));
  const beforePayload = await beforeResponse.json();
  const beforeIds = new Set((beforePayload.data as Array<{ id: string }>).map((project) => project.id));
  const title = `测试训练项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_training_project_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        baseModel: "继承训练默认模型",
        captionStrategy: "先触发词后描述",
        usagePrompt: "测试角色触发词",
        detailPrompt: "测试角色细节描述",
        perSectionImageCount: "4",
        trainingSteps: "2400",
        selectedReferenceIds: [],
        sections: [
          {
            id: "seed-1",
            title: "新小节 1",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "block-1",
                source: "本地",
                title: "本地场景描述",
                text: "测试场景描述",
              },
            ],
            resolvedScene: "测试场景描述",
            scenePreview: "测试场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: true,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.equal(createPayload.data.title, title);
  assert.equal(createPayload.data.sections.length, 1);
  assert.equal(createPayload.data.sections[0].title, "新小节 1");

  const afterResponse = await projectsRoute.GET(new Request("http://localhost/api/training/projects"));
  const afterPayload = await afterResponse.json();
  const afterProjects = afterPayload.data as Array<{ id: string; title: string }>;

  assert.equal(afterResponse.status, 200);
  assert.equal(afterPayload.ok, true);
  assert.ok(afterProjects.some((project) => project.id === createPayload.data.id && project.title === title));
  assert.ok(!beforeIds.has(createPayload.data.id));
});

test("production training project creation uses the real project path when the training database is available", async () => {
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  try {
    await listCharacterLoraTrainingJobs({ page: 1, pageSize: 1 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }

  const projectsRoute = await import("../src/app/api/training/projects/route");
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const title = `真实创建链项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_real_project_create_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [],
        sections: [
          {
            id: "real-create-section",
            title: "真实创建小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "real-create-block",
                source: "本地",
                title: "真实创建 block",
                text: "真实创建场景描述",
              },
            ],
            resolvedScene: "真实创建场景描述",
            scenePreview: "真实创建场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  assert.equal(createPayload.data.sections[0].id, "real-create-section");

  const sectionsResponse = await sectionsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/sections`),
    { params: Promise.resolve({ projectId }) },
  );
  const sectionsPayload = await sectionsResponse.json();
  assert.equal(sectionsResponse.status, 200);
  assert.equal(sectionsPayload.ok, true);
  assert.ok(sectionsPayload.data.some((section: { id: string }) => section.id === "real-create-section"));

  const uploadFormData = new FormData();
  uploadFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "real-create-source.png", { type: "image/png" }));
  uploadFormData.append("role", "source");
  const uploadResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadFormData,
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const uploadPayload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadPayload.ok, true);
  assert.equal(uploadPayload.data.jobId, projectId);
  assert.equal(typeof uploadPayload.data.artifactId, "string");

  const seedImageId = uploadPayload.data.id as string;
  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${seedImageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "keep",
        captionDraft: "真实创建链保留结果",
      }),
    }),
    { params: Promise.resolve({ imageId: seedImageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);

  const createWithManagedReferencesResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title: `${title} 参考复制`,
        characterName: `${title} 参考复制`,
        projectName: `${title} 参考复制`,
        triggerToken: `test_real_project_reference_copy_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [`project-${projectId}`, `result-${addToResultsPayload.data.id}`],
        sections: [
          {
            id: "real-create-reference-copy-section",
            title: "真实引用复制小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "real-create-reference-copy-block",
                source: "本地",
                title: "真实引用复制 block",
                text: "真实引用复制场景描述",
              },
            ],
            resolvedScene: "真实引用复制场景描述",
            scenePreview: "真实引用复制场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createWithManagedReferencesPayload = await createWithManagedReferencesResponse.json();
  assert.equal(createWithManagedReferencesResponse.status, 201);
  assert.equal(createWithManagedReferencesPayload.ok, true);
  const referenceCopyProjectId = createWithManagedReferencesPayload.data.id as string;

  const copiedReferenceResponse = await referenceRoute.GET(
    new Request(`http://localhost/api/training/projects/${referenceCopyProjectId}/reference-images`),
    { params: Promise.resolve({ projectId: referenceCopyProjectId }) },
  );
  const copiedReferencePayload = await copiedReferenceResponse.json();
  assert.equal(copiedReferenceResponse.status, 200);
  assert.equal(copiedReferencePayload.ok, true);
  assert.ok(Array.isArray(copiedReferencePayload.data));
  assert.ok((copiedReferencePayload.data as Array<{ label: string }>).some((image) => image.label === title));
  assert.ok((copiedReferencePayload.data as Array<{ note: string }>).some((image) => image.note === "真实创建链保留结果"));
});

test("production generation tasks can be cancelled through /api/training when the training database is available", async () => {
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  try {
    await listCharacterLoraTrainingJobs({ page: 1, pageSize: 1 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }

  const projectsRoute = await import("../src/app/api/training/projects/route");
  const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const cancelGenerationTaskRoute = await import("../src/app/api/training/generation-tasks/[taskId]/cancel/route");
  const title = `真实取消生成项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_real_generation_cancel_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        usagePrompt: "真实取消生成测试提示词",
        detailPrompt: "真实取消生成测试细节",
        selectedReferenceIds: [],
        sections: [
          {
            id: "real-cancel-generation-section",
            title: "真实取消生成小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "real-cancel-generation-block",
                source: "本地",
                title: "真实取消生成 block",
                text: "真实取消生成场景描述",
              },
            ],
            resolvedScene: "真实取消生成场景描述",
            scenePreview: "真实取消生成场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.ok(!String(createPayload.data.id).startsWith("training-project-"));

  const sectionId = createPayload.data.sections[0].id as string;
  const generationResponse = await sectionRunRoute.POST(
    new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
      method: "POST",
      body: JSON.stringify({
        userInstruction: "真实取消生成任务",
      }),
    }),
    { params: Promise.resolve({ sectionId }) },
  );
  const generationPayload = await generationResponse.json();
  assert.equal(generationResponse.status, 201);
  assert.equal(generationPayload.ok, true);

  const generationTaskId = generationPayload.data.id as string;
  const cancelResponse = await cancelGenerationTaskRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${generationTaskId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ requestedBy: "test" }),
    }),
    { params: Promise.resolve({ taskId: generationTaskId }) },
  );
  const cancelPayload = await cancelResponse.json();
  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelPayload.ok, true);
  assert.equal(cancelPayload.data.id, generationTaskId);

  const detailResponse = await generationTaskDetailRoute.GET(
    new Request(`http://localhost/api/training/generation-tasks/${generationTaskId}`),
    { params: Promise.resolve({ taskId: generationTaskId }) },
  );
  const detailPayload = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailPayload.ok, true);
  assert.equal(detailPayload.data.id, generationTaskId);
  assert.equal(detailPayload.data.status, "cancelled");
});

test("production training worker lease can target a specific queued generation run", async () => {
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  try {
    await listCharacterLoraTrainingJobs({ page: 1, pageSize: 1 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }

  const projectsRoute = await import("../src/app/api/training/projects/route");
  const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const workerTaskNextRoute = await import("../src/app/api/training/worker/tasks/next/route");
  const { db } = await import("../src/lib/db");
  const title = `真实定向租约项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_targeted_worker_lease_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        usagePrompt: "真实定向租约提示词",
        detailPrompt: "真实定向租约细节",
        selectedReferenceIds: [],
        sections: [
          {
            id: "targeted-lease-section-a",
            title: "定向租约小节 A",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "targeted-lease-block-a",
                source: "本地",
                title: "定向租约 block A",
                text: "定向租约场景 A",
              },
            ],
            resolvedScene: "定向租约场景 A",
            scenePreview: "定向租约场景 A",
          },
          {
            id: "targeted-lease-section-b",
            title: "定向租约小节 B",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "targeted-lease-block-b",
                source: "本地",
                title: "定向租约 block B",
                text: "定向租约场景 B",
              },
            ],
            resolvedScene: "定向租约场景 B",
            scenePreview: "定向租约场景 B",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);

  const firstSectionId = createPayload.data.sections[0].id as string;
  const secondSectionId = createPayload.data.sections[1].id as string;
  const firstGenerationResponse = await sectionRunRoute.POST(
    new Request(`http://localhost/api/training/sections/${firstSectionId}/runs`, {
      method: "POST",
      body: JSON.stringify({ userInstruction: "first queued generation" }),
    }),
    { params: Promise.resolve({ sectionId: firstSectionId }) },
  );
  const firstGenerationPayload = await firstGenerationResponse.json();
  assert.equal(firstGenerationResponse.status, 201);
  assert.equal(firstGenerationPayload.ok, true);

  const secondGenerationResponse = await sectionRunRoute.POST(
    new Request(`http://localhost/api/training/sections/${secondSectionId}/runs`, {
      method: "POST",
      body: JSON.stringify({ userInstruction: "second queued generation" }),
    }),
    { params: Promise.resolve({ sectionId: secondSectionId }) },
  );
  const secondGenerationPayload = await secondGenerationResponse.json();
  assert.equal(secondGenerationResponse.status, 201);
  assert.equal(secondGenerationPayload.ok, true);

  const firstGenerationRunId = firstGenerationPayload.data.id as string;
  const secondGenerationRunId = secondGenerationPayload.data.id as string;
  assert.notEqual(firstGenerationRunId, secondGenerationRunId);

  await db.characterLoraWorkerTask.updateMany({
    where: { targetType: "generationRun", targetId: firstGenerationRunId },
    data: {
      status: "queued",
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(Date.now() - 60_000),
    },
  });
  await db.characterLoraWorkerTask.updateMany({
    where: { targetType: "generationRun", targetId: secondGenerationRunId },
    data: {
      status: "queued",
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(),
    },
  });

  const leaseResponse = await workerTaskNextRoute.GET(
    new Request(
      `http://localhost/api/training/worker/tasks/next?workerType=image_generation&leaseOwner=targeted-test&targetType=generationRun&targetId=${secondGenerationRunId}`,
    ),
  );
  const leasePayload = await leaseResponse.json();
  assert.equal(leaseResponse.status, 200);
  assert.equal(leasePayload.ok, true);
  assert.equal(leasePayload.data.targetType, "generationRun");
  assert.equal(leasePayload.data.targetId, secondGenerationRunId);
  assert.notEqual(leasePayload.data.targetId, firstGenerationRunId);
});

test("managed scheduler tick can advance a target queued generation run", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
    const schedulerTickRoute = await import("../src/app/api/training/scheduler/tick/route");
    const workerTaskNextRoute = await import("../src/app/api/training/worker/tasks/next/route");
    const title = `测试 targeted scheduler tick ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `targeted_scheduler_tick_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "targeted scheduler usage",
          detailPrompt: "targeted scheduler detail",
          selectedReferenceIds: [seedProject.projectSelectionId],
          sections: [
            {
              id: "targeted-scheduler-section",
              title: "Targeted Scheduler Section",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "targeted-scheduler-block",
                  source: "本地",
                  title: "Targeted Scheduler Block",
                  text: "targeted scheduler scene",
                },
              ],
              resolvedScene: "targeted scheduler scene",
              scenePreview: "targeted scheduler scene",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);
    const sectionId = createPayload.data.sections[0].id as string;

    const firstGenerationResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({ userInstruction: "first queued generation" }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const firstGenerationPayload = await firstGenerationResponse.json();
    assert.equal(firstGenerationResponse.status, 201);
    assert.equal(firstGenerationPayload.ok, true);
    const firstGenerationRunId = firstGenerationPayload.data.id as string;

    const secondGenerationResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({ userInstruction: "second queued generation" }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const secondGenerationPayload = await secondGenerationResponse.json();
    assert.equal(secondGenerationResponse.status, 201);
    assert.equal(secondGenerationPayload.ok, true);
    const secondGenerationRunId = secondGenerationPayload.data.id as string;

    const targetedTickResponse = await schedulerTickRoute.POST(
      new Request(
        `http://localhost/api/training/scheduler/tick?targetType=generationRun&targetId=${secondGenerationRunId}`,
        { method: "POST" },
      ),
    );
    const targetedTickPayload = await targetedTickResponse.json();
    assert.equal(targetedTickResponse.status, 200);
    assert.equal(targetedTickPayload.ok, true);
    assert.equal(targetedTickPayload.data.id, secondGenerationRunId);
    assert.equal(targetedTickPayload.data.status, "running");

    const untargetedFirstLeaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=image_generation&leaseOwner=targeted-scheduler-test&targetType=generationRun&targetId=${firstGenerationRunId}`,
      ),
    );
    const untargetedFirstLeasePayload = await untargetedFirstLeaseResponse.json();
    assert.equal(untargetedFirstLeaseResponse.status, 200);
    assert.equal(untargetedFirstLeasePayload.ok, true);
    assert.equal(untargetedFirstLeasePayload.data, null);

    const targetedSecondLeaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=image_generation&leaseOwner=targeted-scheduler-test&targetType=generationRun&targetId=${secondGenerationRunId}`,
      ),
    );
    const targetedSecondLeasePayload = await targetedSecondLeaseResponse.json();
    assert.equal(targetedSecondLeaseResponse.status, 200);
    assert.equal(targetedSecondLeasePayload.ok, true);
    assert.equal(targetedSecondLeasePayload.data.targetId, secondGenerationRunId);
  });
});

test("production worker task lease route filters queued tasks by target query params", async () => {
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  try {
    await listCharacterLoraTrainingJobs({ page: 1, pageSize: 1 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }

  const { db } = await import("../src/lib/db");
  const workerTaskNextRoute = await import("../src/app/api/training/worker/tasks/next/route");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const firstTargetId = `first-target-${unique}`;
  const secondTargetId = `second-target-${unique}`;
  const job = await db.characterLoraTrainingJob.create({
    data: {
      slug: `targeted-lease-${unique}`,
      characterName: "Targeted Lease",
      triggerToken: `targeted_lease_${Date.now()}`,
      trainingScope: {},
      artifactRoot: `test-artifacts/targeted-lease-${unique}`,
    },
    select: { id: true },
  });

  try {
    await db.characterLoraWorkerTask.createMany({
      data: [
        {
          jobId: job.id,
          workerType: "dataset_freeze",
          targetType: "targetedLeaseTest",
          targetId: firstTargetId,
          status: "queued",
          payload: { taskType: "dataset_freeze", marker: "first" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          jobId: job.id,
          workerType: "dataset_freeze",
          targetType: "targetedLeaseTest",
          targetId: secondTargetId,
          status: "queued",
          payload: { taskType: "dataset_freeze", marker: "second" },
          createdAt: new Date("2026-01-01T00:00:01.000Z"),
        },
      ],
    });

    const leaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=dataset_freeze&leaseOwner=targeted-route-test&targetType=targetedLeaseTest&targetId=${secondTargetId}`,
      ),
    );
    const leasePayload = await leaseResponse.json();
    assert.equal(leaseResponse.status, 200);
    assert.equal(leasePayload.ok, true);
    assert.equal(leasePayload.data.targetType, "targetedLeaseTest");
    assert.equal(leasePayload.data.targetId, secondTargetId);
    assert.notEqual(leasePayload.data.targetId, firstTargetId);
  } finally {
    await db.characterLoraTrainingJob.deleteMany({ where: { id: job.id } });
  }
});

test("production generation task draft lifecycle works through /api/training when the training database is available", async () => {
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  try {
    await listCharacterLoraTrainingJobs({ page: 1, pageSize: 1 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }

  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const projectGenerationTasksRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");
  const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const generationTaskInputsRoute = await import("../src/app/api/training/generation-tasks/[taskId]/inputs/route");
  const generationTaskSupplementalImagesRoute = await import("../src/app/api/training/generation-tasks/[taskId]/supplemental-images/route");
  const generationTaskPreviewRoute = await import("../src/app/api/training/generation-tasks/[taskId]/preview/route");
  const generationTaskRunRoute = await import("../src/app/api/training/generation-tasks/[taskId]/run/route");
  const title = `真实生成草稿项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_real_generation_draft_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        usagePrompt: "真实生成草稿提示词",
        detailPrompt: "真实生成草稿细节",
        sections: [
          {
            id: "real-generation-draft-section",
            title: "真实生成草稿小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "real-generation-draft-block",
                source: "本地",
                title: "真实生成草稿 block",
                text: "真实生成草稿场景描述",
              },
            ],
            resolvedScene: "真实生成草稿场景描述",
            scenePreview: "真实生成草稿场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  assert.ok(!String(createPayload.data.id).startsWith("training-project-"));

  const projectId = createPayload.data.id as string;
  const sectionId = createPayload.data.sections[0].id as string;

  const uploadReferenceFormData = new FormData();
  uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "real-generation-draft-source.png", { type: "image/png" }));
  uploadReferenceFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadReferenceFormData,
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);
  const referenceId = uploadReferencePayload.data.id as string;

  const createTaskResponse = await projectGenerationTasksRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks`, {
      method: "POST",
      body: JSON.stringify({
        generationKind: "image_generation",
        sectionId,
        paramsJson: {
          referenceStrength: 0.55,
          seedPolicy: "fixed",
        },
        taskType: "trainingset_generation",
        supplementalPrompt: "真实初始补充提示词",
      }),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const createTaskPayload = await createTaskResponse.json();
  assert.equal(createTaskResponse.status, 201);
  assert.equal(createTaskPayload.ok, true);
  assert.deepEqual(createTaskPayload.data.paramsJson, {
    referenceStrength: 0.55,
    seedPolicy: "fixed",
  });
  const taskId = createTaskPayload.data.id as string;

  const patchTaskResponse = await generationTaskDetailRoute.PATCH(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({
        generationKind: "image_generation",
        paramsJson: {
          providerModel: "gpt-image-2",
          temperature: 0.25,
        },
        taskType: "角色描述生成",
        supplementalPrompt: "真实更新后的补充提示词",
      }),
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const patchTaskPayload = await patchTaskResponse.json();
  assert.equal(patchTaskResponse.status, 200);
  assert.equal(patchTaskPayload.ok, true);
  assert.equal(patchTaskPayload.data.generationKind, "image_generation");
  assert.deepEqual(patchTaskPayload.data.paramsJson, {
    providerModel: "gpt-image-2",
    temperature: 0.25,
  });
  assert.equal(patchTaskPayload.data.taskType, "profile_text_generation");
  assert.equal(patchTaskPayload.data.taskTypeLabel, "角色描述生成");

  const addInputResponse = await generationTaskInputsRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/inputs`, {
      method: "POST",
      body: JSON.stringify({
        referenceId,
      }),
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const addInputPayload = await addInputResponse.json();
  assert.equal(addInputResponse.status, 201);
  assert.equal(addInputPayload.ok, true);
  assert.equal(addInputPayload.data.referenceId, referenceId);

  const supplementalFormData = new FormData();
  supplementalFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "real-draft-extra.png", { type: "image/png" }));
  supplementalFormData.append("title", "真实补充图");
  supplementalFormData.append("detail", "真实补充附件说明");
  const supplementalImageResponse = await generationTaskSupplementalImagesRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/supplemental-images`, {
      method: "POST",
      body: supplementalFormData,
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const supplementalImagePayload = await supplementalImageResponse.json();
  assert.equal(supplementalImageResponse.status, 201);
  assert.equal(supplementalImagePayload.ok, true);

  const previewResponse = await generationTaskPreviewRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/preview`, {
      method: "POST",
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const previewPayload = await previewResponse.json();
  assert.equal(previewResponse.status, 200);
  assert.equal(previewPayload.ok, true);
  assert.match(previewPayload.data.finalInput, /真实更新后的补充提示词/);
  assert.match(previewPayload.data.finalInput, /真实补充附件说明/);

  const runResponse = await generationTaskRunRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/run`, {
      method: "POST",
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const runPayload = await runResponse.json();
  assert.equal(runResponse.status, 201);
  assert.equal(runPayload.ok, true);
  assert.equal(runPayload.data.kind, "generation");
  assert.equal(runPayload.data.projectId, projectId);

  const runId = runPayload.data.id as string;
  const runDetailResponse = await generationTaskDetailRoute.GET(
    new Request(`http://localhost/api/training/generation-tasks/${runId}`),
    { params: Promise.resolve({ taskId: runId }) },
  );
  const runDetailPayload = await runDetailResponse.json();
  assert.equal(runDetailResponse.status, 200);
  assert.equal(runDetailPayload.ok, true);
  assert.equal(runDetailPayload.data.id, runId);
  assert.equal(runDetailPayload.data.kind, "generation");
  assert.ok(Array.isArray(runDetailPayload.data.inputImages));
  assert.ok(runDetailPayload.data.inputImages.length >= 3);
});

test("training project detail route deletes a managed project through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const projectDetailRoute = await import("../src/app/api/training/projects/[projectId]/route");
  const title = `待删除训练项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `delete_training_project_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        baseModel: "继承训练默认模型",
        captionStrategy: "先触发词后描述",
        usagePrompt: "待删除训练项目触发词",
        detailPrompt: "待删除训练项目资料",
        perSectionImageCount: "4",
        trainingSteps: "2400",
        selectedReferenceIds: [],
        sections: [
          {
            id: "delete-project-section",
            title: "待删除小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "delete-project-block",
                source: "本地",
                title: "待删除场景块",
                text: "删除项目测试场景描述",
              },
            ],
            resolvedScene: "删除项目测试场景描述",
            scenePreview: "删除项目测试场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);

  const projectId = createPayload.data.id as string;
  const detailParams = { params: Promise.resolve({ projectId }) };

  const deleteResponse = await projectDetailRoute.DELETE(
    new Request(`http://localhost/api/training/projects/${projectId}`, { method: "DELETE" }),
    detailParams,
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
  assert.equal(deletePayload.data.id, projectId);

  const afterListResponse = await projectsRoute.GET(new Request("http://localhost/api/training/projects"));
  const afterListPayload = await afterListResponse.json();
  assert.equal(afterListResponse.status, 200);
  assert.equal(afterListPayload.ok, true);
  assert.ok(!(afterListPayload.data as Array<{ id: string }>).some((project) => project.id === projectId));

  const detailAfterDeleteResponse = await projectDetailRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}`),
    detailParams,
  );
  const detailAfterDeletePayload = await detailAfterDeleteResponse.json();
  assert.equal(detailAfterDeleteResponse.status, 404);
  assert.equal(detailAfterDeletePayload.ok, false);
});

test("training project route can save a project as a template through /api/training", async () => {
  const projectDetailRoute = await import("../src/app/api/training/projects/[projectId]/route");
  const saveAsTemplateRoute = await import("../src/app/api/training/projects/[projectId]/save-as-template/route");
  const templatesRoute = await import("../src/app/api/training/templates/route");
  const templateDetailRoute = await import("../src/app/api/training/templates/[templateId]/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const project = await createManagedProjectFixture({
      title: `存模板来源项目 ${Date.now()}`,
      sections: [
        {
          id: "save-as-template-source-section",
          title: "存模板来源小节",
          enabled: true,
          blockCount: 1,
          blocks: [
            {
              id: "save-as-template-source-block",
              source: "本地",
              title: "存模板来源场景块",
              text: "存模板来源场景描述。",
            },
          ],
          resolvedScene: "存模板来源场景描述。",
          scenePreview: "存模板来源场景描述。",
        },
      ],
    });
    const projectId = project.id;

    const projectDetailResponse = await projectDetailRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}`),
      { params: Promise.resolve({ projectId }) },
    );
    const projectDetailPayload = await projectDetailResponse.json();

    assert.equal(projectDetailResponse.status, 200);
    assert.equal(projectDetailPayload.ok, true);

    const templateTitle = `项目存模板 ${Date.now()}`;
    const saveResponse = await saveAsTemplateRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/save-as-template`, {
        method: "POST",
        body: JSON.stringify({
          title: templateTitle,
          description: "从项目保存为模板的测试描述。",
          imageGuidance: "从项目保存为模板的图片指引。",
          captionGuidance: "从项目保存为模板的说明文本指引。",
          sections: [
            {
              id: "saved-template-section",
              title: "保存模板小节",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "saved-template-block",
                  source: "本地",
                  title: "保存模板场景块",
                  text: "从项目模板保存时提交的场景描述。",
                },
              ],
              resolvedScene: "从项目模板保存时提交的场景描述。",
              scenePreview: "从项目模板保存时提交的场景描述。",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const savePayload = await saveResponse.json();

    assert.equal(saveResponse.status, 201);
    assert.equal(savePayload.ok, true);
    assert.equal(savePayload.data.title, templateTitle);
    assert.equal(savePayload.data.sections.length, 1);
    assert.equal(savePayload.data.sections[0].title, "保存模板小节");

    const templateId = savePayload.data.id as string;
    const templateDetailResponse = await templateDetailRoute.GET(
      new Request(`http://localhost/api/training/templates/${templateId}`),
      { params: Promise.resolve({ templateId }) },
    );
    const templateDetailPayload = await templateDetailResponse.json();
    assert.equal(templateDetailResponse.status, 200);
    assert.equal(templateDetailPayload.ok, true);
    assert.equal(templateDetailPayload.data.imageGuidance, "从项目保存为模板的图片指引。");
    assert.equal(templateDetailPayload.data.captionGuidance, "从项目保存为模板的说明文本指引。");
    assert.equal(templateDetailPayload.data.sections[0].title, "保存模板小节");

    const templatesResponse = await templatesRoute.GET();
    const templatesPayload = await templatesResponse.json();
    assert.equal(templatesResponse.status, 200);
    assert.equal(templatesPayload.ok, true);
    assert.ok((templatesPayload.data as Array<{ id: string; title: string }>).some((template) => template.id === savePayload.data.id && template.title === templateTitle));
  });
});

test("managed training project profile reads and updates through /api/training", async () => {
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const project = await createManagedProjectFixture({
      title: `managed profile 项目 ${Date.now()}`,
    });
    const projectId = project.id;

    const getResponse = await profileRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/profile`),
      { params: Promise.resolve({ projectId }) },
    );
    const getPayload = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(getPayload.ok, true);
    assert.equal(getPayload.data.projectId, projectId);

    const patchResponse = await profileRoute.PATCH(
      new Request(`http://localhost/api/training/projects/${projectId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loraUsagePrompt: "更新后的使用提示词",
          characterDetailPrompt: "更新后的角色细节描述",
          profileSummary: "更新后的资料备注",
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const patchPayload = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchPayload.ok, true);
    assert.equal(patchPayload.data.usagePrompt, "更新后的使用提示词");
    assert.equal(patchPayload.data.detailPrompt, "更新后的角色细节描述");
    assert.equal(patchPayload.data.profileSummary, "更新后的资料备注");
  });
});

test("managed training text revisions can checkpoint, list, and restore profile fields through /api/training", async () => {
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  const textRevisionsRoute = await import("../src/app/api/training/projects/[projectId]/text-revisions/route");
  const restoreTextRevisionRoute = await import("../src/app/api/training/text-revisions/[revisionId]/restore/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const project = await createManagedProjectFixture({
      title: `managed text revision 项目 ${Date.now()}`,
    });
    const projectId = project.id;
    const params = { params: Promise.resolve({ projectId }) };

    const initialProfileResponse = await profileRoute.PATCH(
      new Request(`http://localhost/api/training/projects/${projectId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loraUsagePrompt: "checkpoint 前的使用提示词",
          characterDetailPrompt: "checkpoint 前的角色细节",
          profileSummary: "checkpoint 前的资料备注",
        }),
      }),
      params,
    );
    const initialProfilePayload = await initialProfileResponse.json();
    assert.equal(initialProfileResponse.status, 200);
    assert.equal(initialProfilePayload.ok, true);

    const createRevisionResponse = await textRevisionsRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/text-revisions`, {
        method: "POST",
        body: JSON.stringify({
          entityType: "profile",
          entityId: projectId,
          fieldName: "loraUsagePrompt",
          textValue: "checkpoint 前的使用提示词",
          reason: "idle_checkpoint",
        }),
      }),
      params,
    );
    const createRevisionPayload = await createRevisionResponse.json();
    assert.equal(createRevisionResponse.status, 201);
    assert.equal(createRevisionPayload.ok, true);
    assert.equal(createRevisionPayload.data.fieldName, "loraUsagePrompt");
    const revisionId = createRevisionPayload.data.id as string;

    const listRevisionResponse = await textRevisionsRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/text-revisions?entityType=profile&entityId=${projectId}&fieldName=loraUsagePrompt`),
      params,
    );
    const listRevisionPayload = await listRevisionResponse.json();
    assert.equal(listRevisionResponse.status, 200);
    assert.equal(listRevisionPayload.ok, true);
    assert.ok(Array.isArray(listRevisionPayload.data));
    assert.ok(listRevisionPayload.data.some((revision: { id: string }) => revision.id === revisionId));

    const overwriteProfileResponse = await profileRoute.PATCH(
      new Request(`http://localhost/api/training/projects/${projectId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loraUsagePrompt: "覆盖后的使用提示词",
        }),
      }),
      params,
    );
    const overwriteProfilePayload = await overwriteProfileResponse.json();
    assert.equal(overwriteProfileResponse.status, 200);
    assert.equal(overwriteProfilePayload.ok, true);
    assert.equal(overwriteProfilePayload.data.usagePrompt, "覆盖后的使用提示词");

    const restoreResponse = await restoreTextRevisionRoute.POST(
      new Request(`http://localhost/api/training/text-revisions/${revisionId}/restore`, {
        method: "POST",
      }),
      { params: Promise.resolve({ revisionId }) },
    );
    const restorePayload = await restoreResponse.json();
    assert.equal(restoreResponse.status, 200);
    assert.equal(restorePayload.ok, true);
    assert.equal(restorePayload.data.restored, true);
    assert.equal(restorePayload.data.fieldName, "loraUsagePrompt");
    assert.equal(typeof restorePayload.data.beforeOverwriteRevisionId, "string");

    const restoredProfileResponse = await profileRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/profile`),
      params,
    );
    const restoredProfilePayload = await restoredProfileResponse.json();
    assert.equal(restoredProfileResponse.status, 200);
    assert.equal(restoredProfilePayload.ok, true);
    assert.equal(restoredProfilePayload.data.loraUsagePrompt, "checkpoint 前的使用提示词");
  });
});

test("production training text revisions can checkpoint and restore profile prompts through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  const textRevisionsRoute = await import("../src/app/api/training/projects/[projectId]/text-revisions/route");
  const restoreTextRevisionRoute = await import("../src/app/api/training/text-revisions/[revisionId]/restore/route");
  const title = `真实 profile revision 项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_profile_revision_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [],
        sections: [],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const params = { params: Promise.resolve({ projectId }) };

  const patchProfileResponse = await profileRoute.PATCH(
    new Request(`http://localhost/api/training/projects/${projectId}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        loraUsagePrompt: "真实 profile checkpoint 前提示词",
        characterDetailPrompt: JSON.stringify({
          identityTraits: { hair: "silver" },
          outfitTraits: { coat: "white" },
          negativeTraits: ["blur"],
        }),
      }),
    }),
    params,
  );
  const patchProfilePayload = await patchProfileResponse.json();
  assert.equal(patchProfileResponse.status, 200);
  assert.equal(patchProfilePayload.ok, true);

  const createRevisionResponse = await textRevisionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/text-revisions`, {
      method: "POST",
      body: JSON.stringify({
        entityType: "profile",
        entityId: projectId,
        fieldName: "loraUsagePrompt",
        textValue: "真实 profile checkpoint 前提示词",
        reason: "idle_checkpoint",
      }),
    }),
    params,
  );
  const createRevisionPayload = await createRevisionResponse.json();
  assert.equal(createRevisionResponse.status, 201);
  assert.equal(createRevisionPayload.ok, true);
  const revisionId = createRevisionPayload.data.id as string;

  const overwriteProfileResponse = await profileRoute.PATCH(
    new Request(`http://localhost/api/training/projects/${projectId}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        loraUsagePrompt: "真实 profile 覆盖后提示词",
      }),
    }),
    params,
  );
  const overwriteProfilePayload = await overwriteProfileResponse.json();
  assert.equal(overwriteProfileResponse.status, 200);
  assert.equal(overwriteProfilePayload.ok, true);

  const restoreResponse = await restoreTextRevisionRoute.POST(
    new Request(`http://localhost/api/training/text-revisions/${revisionId}/restore`, {
      method: "POST",
    }),
    { params: Promise.resolve({ revisionId }) },
  );
  const restorePayload = await restoreResponse.json();
  assert.equal(restoreResponse.status, 200);
  assert.equal(restorePayload.ok, true);
  assert.equal(restorePayload.data.restored, true);

  const restoredProfileResponse = await profileRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/profile`),
    params,
  );
  const restoredProfilePayload = await restoredProfileResponse.json();
  assert.equal(restoredProfileResponse.status, 200);
  assert.equal(restoredProfilePayload.ok, true);
  assert.equal(restoredProfilePayload.data.loraUsagePrompt, "真实 profile checkpoint 前提示词");
});

test("managed training project updates through /api/training/projects/:projectId", async () => {
  const projectRoute = await import("../src/app/api/training/projects/[projectId]/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const project = await createManagedProjectFixture({
      title: `managed update 项目 ${Date.now()}`,
    });
    const projectId = project.id;

    const patchResponse = await projectRoute.PATCH(
      new Request(`http://localhost/api/training/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "更新后的项目标题",
          usagePrompt: "更新后的使用提示词",
          detailPrompt: "更新后的角色细节描述",
          profileSummary: "更新后的项目备注",
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const patchPayload = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchPayload.ok, true);
    assert.equal(patchPayload.data.id, projectId);
    assert.equal(patchPayload.data.title, "更新后的项目标题");
    assert.equal(patchPayload.data.usagePrompt, "更新后的使用提示词");
    assert.equal(patchPayload.data.detailPrompt, "更新后的角色细节描述");
    assert.equal(patchPayload.data.profileSummary, "更新后的项目备注");
  });
});

test("managed training project references flow into result review through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const referenceDetailRoute = await import("../src/app/api/training/reference-images/[imageId]/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const reviewRoute = await import("../src/app/api/training/image-results/[imageResultId]/review/route");
  const patchResultRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const title = `测试参考图项目 ${Date.now()}`;
    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `test_reference_project_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          baseModel: "继承训练默认模型",
          captionStrategy: "先触发词后描述",
          usagePrompt: "测试角色触发词",
          detailPrompt: "测试角色细节描述",
          perSectionImageCount: "4",
          trainingSteps: "2400",
          selectedReferenceIds: [],
          sections: [
            {
              id: "seed-1",
              title: "新小节 1",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "block-1",
                  source: "本地",
                  title: "本地场景描述",
                  text: "测试场景描述",
                },
              ],
              resolvedScene: "测试场景描述",
              scenePreview: "测试场景描述",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: true,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);
    const projectId = createPayload.data.id as string;
    const params = { params: Promise.resolve({ projectId }) };

    const beforeResponse = await referenceRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
      params,
    );
    const beforePayload = await beforeResponse.json();
    assert.equal(beforeResponse.status, 200);
    assert.equal(beforePayload.ok, true);
    assert.ok(Array.isArray(beforePayload.data));
    assert.ok(beforePayload.data.length === 0);

    const uploadReferenceFormData = new FormData();
    uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "managed-reference-source.png", { type: "image/png" }));
    uploadReferenceFormData.append("role", "source");
    const uploadReferenceResponse = await referenceRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
        method: "POST",
        body: uploadReferenceFormData,
      }),
      params,
    );
    const uploadReferencePayload = await uploadReferenceResponse.json();
    assert.equal(uploadReferenceResponse.status, 201);
    assert.equal(uploadReferencePayload.ok, true);
    const imageId = uploadReferencePayload.data.id as string;

    const patchReferenceResponse = await referenceDetailRoute.PATCH(
      new Request(`http://localhost/api/training/reference-images/${imageId}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: "已更新参考图",
          note: "已更新参考图备注",
          kind: "generated",
        }),
      }),
      { params: Promise.resolve({ imageId }) },
    );
    const patchReferencePayload = await patchReferenceResponse.json();
    assert.equal(patchReferenceResponse.status, 200);
    assert.equal(patchReferencePayload.ok, true);
    assert.equal(patchReferencePayload.data.id, imageId);
    assert.equal(patchReferencePayload.data.label, "已更新参考图");
    assert.equal(patchReferencePayload.data.note, "已更新参考图备注");
    assert.equal(patchReferencePayload.data.kind, "generated");

    const addToResultsResponse = await addToResultsRoute.POST(
      new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
        method: "POST",
        body: JSON.stringify({ reviewStatus: "pending", captionDraft: "初始说明文本" }),
      }),
      { params: Promise.resolve({ imageId }) },
    );
    const addToResultsPayload = await addToResultsResponse.json();

    assert.equal(addToResultsResponse.status, 201);
    assert.equal(addToResultsPayload.ok, true);
    assert.equal(typeof addToResultsPayload.data.id, "string");
    assert.notEqual(addToResultsPayload.data.id, imageId);

    const imageResultId = addToResultsPayload.data.id as string;

    const reviewResponse = await reviewRoute.POST(
      new Request(`http://localhost/api/training/image-results/${imageResultId}/review`, {
        method: "POST",
        body: JSON.stringify({ reviewStatus: "keep" }),
      }),
      { params: Promise.resolve({ imageResultId }) },
    );
    const reviewPayload = await reviewResponse.json();
    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewPayload.ok, true);
    assert.equal(reviewPayload.data.reviewStatus, "kept");

    const patchResultResponse = await patchResultRoute.PATCH(
      new Request(`http://localhost/api/training/image-results/${imageResultId}`, {
        method: "PATCH",
        body: JSON.stringify({ captionDraft: "更新后的说明文本", reviewStatus: "pending" }),
      }),
      { params: Promise.resolve({ imageResultId }) },
    );
    const patchResultPayload = await patchResultResponse.json();
    assert.equal(patchResultResponse.status, 200);
    assert.equal(patchResultPayload.ok, true);
    assert.equal(patchResultPayload.data.caption, "更新后的说明文本");
    assert.equal(patchResultPayload.data.reviewStatus, "pending");

    const deleteResultResponse = await patchResultRoute.DELETE(
      new Request(`http://localhost/api/training/image-results/${imageResultId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ imageResultId }) },
    );
    const deleteResultPayload = await deleteResultResponse.json();
    assert.equal(deleteResultResponse.status, 200);
    assert.equal(deleteResultPayload.ok, true);
    assert.equal(deleteResultPayload.data.id, imageResultId);

    const deleteReferenceResponse = await referenceDetailRoute.DELETE(
      new Request(`http://localhost/api/training/reference-images/${imageId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ imageId }) },
    );
    const deleteReferencePayload = await deleteReferenceResponse.json();
    assert.equal(deleteReferenceResponse.status, 200);
    assert.equal(deleteReferencePayload.ok, true);
    assert.equal(deleteReferencePayload.data.id, imageId);
  });
});

test("production training reference images support patch, delete, and artifact registration through /api/training", async () => {
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const referenceDetailRoute = await import("../src/app/api/training/reference-images/[imageId]/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const { listCharacterLoraTrainingJobs } = await import("../src/server/services/character-lora-training/job-service");
  let productionProjects;
  try {
    productionProjects = await listCharacterLoraTrainingJobs({ page: 1, pageSize: 20 });
  } catch (error) {
    if (isProductionTrainingDatabaseUnavailable(error)) {
      return;
    }
    throw error;
  }
  const productionProject = productionProjects.jobs.find((project) => project.status !== "archived");
  assert.ok(productionProject);
  const projectId = productionProject!.id;
  const projectParams = { params: Promise.resolve({ projectId }) };

  const uploadFormData = new FormData();
  uploadFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "production-reference-source.png", { type: "image/png" }));
  uploadFormData.append("role", "source");
  const uploadResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadFormData,
    }),
    projectParams,
  );
  const uploadPayload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadPayload.ok, true);
  const imageId = uploadPayload.data.id as string;

  const patchReferenceResponse = await referenceDetailRoute.PATCH(
    new Request(`http://localhost/api/training/reference-images/${imageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        label: "已更新生产参考图",
        note: "已更新生产参考图备注",
        kind: "generated",
      }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const patchReferencePayload = await patchReferenceResponse.json();
  assert.equal(patchReferenceResponse.status, 200);
  assert.equal(patchReferencePayload.ok, true);
  assert.equal(patchReferencePayload.data.id, imageId);
  assert.equal(patchReferencePayload.data.provenance.label, "已更新生产参考图");
  assert.equal(patchReferencePayload.data.provenance.note, "已更新生产参考图备注");
  assert.equal(patchReferencePayload.data.provenance.kind, "generated");

  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({ reviewStatus: "pending", captionDraft: "候选图用于注册参考图" }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);
  const candidateArtifactId = addToResultsPayload.data.artifactId as string;
  assert.equal(typeof candidateArtifactId, "string");

  const registerResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artifactId: candidateArtifactId,
        imageType: "generated",
        label: "候选转参考图",
        note: "从候选输出注册为资料图",
      }),
    }),
    projectParams,
  );
  const registerPayload = await registerResponse.json();
  assert.equal(registerResponse.status, 201);
  assert.equal(registerPayload.ok, true);
  assert.equal(registerPayload.data.artifactId, candidateArtifactId);
  assert.equal(registerPayload.data.provenance.label, "候选转参考图");
  assert.equal(registerPayload.data.provenance.note, "从候选输出注册为资料图");
  const registeredImageId = registerPayload.data.id as string;

  const referencesListResponse = await referenceRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`),
    projectParams,
  );
  const referencesListPayload = await referencesListResponse.json();
  assert.equal(referencesListResponse.status, 200);
  assert.equal(referencesListPayload.ok, true);
  assert.ok(Array.isArray(referencesListPayload.data));
  assert.ok(referencesListPayload.data.some((image: { id: string }) => image.id === registeredImageId));

  const deleteReferenceResponse = await referenceDetailRoute.DELETE(
    new Request(`http://localhost/api/training/reference-images/${registeredImageId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ imageId: registeredImageId }) },
  );
  const deleteReferencePayload = await deleteReferenceResponse.json();
  assert.equal(deleteReferenceResponse.status, 200);
  assert.equal(deleteReferencePayload.ok, true);
  assert.equal(deleteReferencePayload.data.id, registeredImageId);
});

test("managed training project can upload result images through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const resultsUploadRoute = await import("../src/app/api/training/projects/[projectId]/image-results/upload/route");
  const resultsRoute = await import("../src/app/api/training/projects/[projectId]/image-results/route");
  await withTrainingManagedStoreSnapshot(async () => {
    const title = `测试结果上传项目 ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `test_result_upload_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "测试结果上传提示词",
          detailPrompt: "测试结果上传细节",
          sections: [
            {
              id: "upload-section",
              title: "上传结果小节",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "upload-block",
                  source: "本地",
                  title: "上传场景块",
                  text: "上传结果场景描述",
                },
              ],
              resolvedScene: "上传结果场景描述",
              scenePreview: "上传结果场景描述",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const projectId = createPayload.data.id as string;
    const sectionId = createPayload.data.sections[0].id as string;
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "upload-result.png", { type: "image/png" }));
    formData.append("sectionId", sectionId);
    formData.append("captionDraft", "上传结果说明文本");
    formData.append("reviewStatus", "pending");

    const uploadResponse = await resultsUploadRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/image-results/upload`, {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const uploadPayload = await uploadResponse.json();

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadPayload.ok, true);
    assert.equal(uploadPayload.data.sectionId, sectionId);
    assert.equal(uploadPayload.data.caption, "上传结果说明文本");

    const listResponse = await resultsRoute.GET(
      new Request(`http://localhost/api/training/projects/${projectId}/image-results`),
      { params: Promise.resolve({ projectId }) },
    );
    const listPayload = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listPayload.ok, true);
    assert.ok((listPayload.data as Array<{ id: string }>).some((result) => result.id === uploadPayload.data.id));
  });
});

test("training text revisions can checkpoint and restore production image-result captions through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const imageResultRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  const resultsRoute = await import("../src/app/api/training/projects/[projectId]/image-results/route");
  const textRevisionsRoute = await import("../src/app/api/training/projects/[projectId]/text-revisions/route");
  const restoreTextRevisionRoute = await import("../src/app/api/training/text-revisions/[revisionId]/restore/route");
  const title = `真实结果 revision 项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_result_revision_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [],
        sections: [],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const params = { params: Promise.resolve({ projectId }) };

  const uploadReferenceFormData = new FormData();
  uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "text-revision-source.png", { type: "image/png" }));
  uploadReferenceFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadReferenceFormData,
    }),
    params,
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);
  const imageId = uploadReferencePayload.data.id as string;

  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "pending",
        captionDraft: "checkpoint 前 caption",
      }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);
  const imageResultId = addToResultsPayload.data.id as string;

  const createRevisionResponse = await textRevisionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/text-revisions`, {
      method: "POST",
      body: JSON.stringify({
        entityType: "image_result",
        entityId: imageResultId,
        fieldName: "captionDraft",
        textValue: "checkpoint 前 caption",
        reason: "idle_checkpoint",
      }),
    }),
    params,
  );
  const createRevisionPayload = await createRevisionResponse.json();
  assert.equal(createRevisionResponse.status, 201);
  assert.equal(createRevisionPayload.ok, true);
  const revisionId = createRevisionPayload.data.id as string;

  const overwriteCaptionResponse = await imageResultRoute.PATCH(
    new Request(`http://localhost/api/training/image-results/${imageResultId}`, {
      method: "PATCH",
      body: JSON.stringify({ captionDraft: "覆盖后的 caption" }),
    }),
    { params: Promise.resolve({ imageResultId }) },
  );
  const overwriteCaptionPayload = await overwriteCaptionResponse.json();
  assert.equal(overwriteCaptionResponse.status, 200);
  assert.equal(overwriteCaptionPayload.ok, true);

  const restoreResponse = await restoreTextRevisionRoute.POST(
    new Request(`http://localhost/api/training/text-revisions/${revisionId}/restore`, {
      method: "POST",
    }),
    { params: Promise.resolve({ revisionId }) },
  );
  const restorePayload = await restoreResponse.json();
  assert.equal(restoreResponse.status, 200);
  assert.equal(restorePayload.ok, true);
  assert.equal(restorePayload.data.restored, true);

  const resultsResponse = await resultsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/image-results`),
    params,
  );
  const resultsPayload = await resultsResponse.json();
  assert.equal(resultsResponse.status, 200);
  assert.equal(resultsPayload.ok, true);
  const restoredResult = resultsPayload.data.find((result: { id: string }) => result.id === imageResultId);
  assert.equal(restoredResult.caption, "checkpoint 前 caption");
});

test("training image caption route can generate a managed caption task result through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const patchImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  const imageCaptionRoute = await import("../src/app/api/training/image-results/[imageResultId]/caption/route");
  const title = `managed caption task 项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_caption_task_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [],
        sections: [],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const projectParams = { params: Promise.resolve({ projectId }) };

  const uploadReferenceFormData = new FormData();
  uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "caption-task-source.png", { type: "image/png" }));
  uploadReferenceFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadReferenceFormData,
    }),
    projectParams,
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);
  const imageId = uploadReferencePayload.data.id as string;

  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "pending",
        captionDraft: "旧 caption",
      }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);
  const imageResultId = addToResultsPayload.data.id as string;

  const clearCaptionResponse = await patchImageRoute.PATCH(
    new Request(`http://localhost/api/training/image-results/${imageResultId}`, {
      method: "PATCH",
      body: JSON.stringify({
        captionDraft: "",
      }),
    }),
    { params: Promise.resolve({ imageResultId }) },
  );
  const clearCaptionPayload = await clearCaptionResponse.json();
  assert.equal(clearCaptionResponse.status, 200);
  assert.equal(clearCaptionPayload.ok, true);

  const captionResponse = await imageCaptionRoute.POST(
    new Request(`http://localhost/api/training/image-results/${imageResultId}/caption`, {
      method: "POST",
      body: JSON.stringify({
        taskInput: {
          captionDraft: "重新生成的 caption 文本",
        },
      }),
    }),
    { params: Promise.resolve({ imageResultId }) },
  );
  const captionPayload = await captionResponse.json();
  assert.equal(captionResponse.status, 200);
  assert.equal(captionPayload.ok, true);
  assert.equal(captionPayload.data.imageResult.id, imageResultId);
  assert.equal(captionPayload.data.imageResult.caption, "重新生成的 caption 文本");
  assert.equal(captionPayload.data.task.imageResultId, imageResultId);
  assert.equal(captionPayload.data.task.status, "completed");
  assert.equal(captionPayload.data.task.taskType, "caption_generation");
  assert.equal(captionPayload.data.task.outputText, "重新生成的 caption 文本");
});

test("training bulk caption route supports kept_without_captions mode through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const patchImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  const resultsRoute = await import("../src/app/api/training/projects/[projectId]/image-results/route");
  const bulkCaptionsRoute = await import("../src/app/api/training/projects/[projectId]/captions/generate/route");
  const title = `managed bulk caption 项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_bulk_caption_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        selectedReferenceIds: [],
        sections: [],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const projectParams = { params: Promise.resolve({ projectId }) };

  const uploadReferenceFormData = new FormData();
  uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "bulk-caption-source.png", { type: "image/png" }));
  uploadReferenceFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadReferenceFormData,
    }),
    projectParams,
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);
  const imageId = uploadReferencePayload.data.id as string;

  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "keep",
        captionDraft: "旧 caption",
      }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);
  const imageResultId = addToResultsPayload.data.id as string;

  const clearCaptionResponse = await patchImageRoute.PATCH(
    new Request(`http://localhost/api/training/image-results/${imageResultId}`, {
      method: "PATCH",
      body: JSON.stringify({
        captionDraft: "",
        reviewStatus: "keep",
      }),
    }),
    { params: Promise.resolve({ imageResultId }) },
  );
  const clearCaptionPayload = await clearCaptionResponse.json();
  assert.equal(clearCaptionResponse.status, 200);
  assert.equal(clearCaptionPayload.ok, true);

  const bulkCaptionResponse = await bulkCaptionsRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/captions/generate`, {
      method: "POST",
      body: JSON.stringify({
        mode: "kept_without_captions",
      }),
    }),
    projectParams,
  );
  const bulkCaptionPayload = await bulkCaptionResponse.json();
  assert.equal(bulkCaptionResponse.status, 200);
  assert.equal(bulkCaptionPayload.ok, true);
  assert.equal(bulkCaptionPayload.data.projectId, projectId);
  assert.equal(bulkCaptionPayload.data.mode, "kept_without_captions");
  assert.equal(bulkCaptionPayload.data.taskCount, 1);
  assert.equal(bulkCaptionPayload.data.tasks[0].imageResultId, imageResultId);
  assert.equal(bulkCaptionPayload.data.tasks[0].status, "completed");
  assert.equal(bulkCaptionPayload.data.tasks[0].taskType, "caption_generation");

  const resultsResponse = await resultsRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/image-results`),
    projectParams,
  );
  const resultsPayload = await resultsResponse.json();
  assert.equal(resultsResponse.status, 200);
  assert.equal(resultsPayload.ok, true);
  const updatedResult = resultsPayload.data.find((result: { id: string }) => result.id === imageResultId);
  assert.equal(typeof updatedResult.caption, "string");
  assert.ok(updatedResult.caption.length > 0);
});

test("managed training project generation task draft lifecycle works through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const projectGenerationTasksRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");
  const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const generationTaskInputsRoute = await import("../src/app/api/training/generation-tasks/[taskId]/inputs/route");
  const generationInputDetailRoute = await import("../src/app/api/training/generation-inputs/[inputId]/route");
  const generationTaskSupplementalImagesRoute = await import("../src/app/api/training/generation-tasks/[taskId]/supplemental-images/route");
  const generationTaskPreviewRoute = await import("../src/app/api/training/generation-tasks/[taskId]/preview/route");
  const generationTaskRunRoute = await import("../src/app/api/training/generation-tasks/[taskId]/run/route");
  const title = `测试生成草稿项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_generation_task_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        usagePrompt: "测试生成草稿提示词",
        detailPrompt: "测试生成草稿细节",
        sections: [
          {
            id: "generation-draft-section",
            title: "生成草稿小节",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "generation-draft-block",
                source: "本地",
                title: "生成草稿场景块",
                text: "生成草稿场景描述",
              },
            ],
            resolvedScene: "生成草稿场景描述",
            scenePreview: "生成草稿场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: false,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);

  const projectId = createPayload.data.id as string;
  const sectionId = createPayload.data.sections[0].id as string;
  const createTaskResponse = await projectGenerationTasksRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks`, {
      method: "POST",
      body: JSON.stringify({
        generationKind: "image_generation",
        sectionId,
        paramsJson: {
          referenceStrength: 0.7,
          seedPolicy: "reuse_project_seed",
        },
        taskType: "reference_image_generation",
        supplementalPrompt: "初始补充提示词",
      }),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const createTaskPayload = await createTaskResponse.json();
  assert.equal(createTaskResponse.status, 201);
  assert.equal(createTaskPayload.ok, true);
  assert.equal(createTaskPayload.data.generationKind, "image_generation");
  assert.deepEqual(createTaskPayload.data.paramsJson, {
    referenceStrength: 0.7,
    seedPolicy: "reuse_project_seed",
  });
  assert.equal(createTaskPayload.data.taskType, "reference_image_generation");
  assert.equal(createTaskPayload.data.taskTypeLabel, "参考图生成");
  const taskId = createTaskPayload.data.id as string;

  const patchTaskResponse = await generationTaskDetailRoute.PATCH(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({
        generationKind: "image_generation",
        paramsJson: {
          providerModel: "gpt-image-2",
          temperature: 0.35,
        },
        taskType: "trainingset_generation",
        supplementalPrompt: "更新后的补充提示词",
      }),
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const patchTaskPayload = await patchTaskResponse.json();
  assert.equal(patchTaskResponse.status, 200);
  assert.equal(patchTaskPayload.ok, true);
  assert.equal(patchTaskPayload.data.generationKind, "image_generation");
  assert.deepEqual(patchTaskPayload.data.paramsJson, {
    providerModel: "gpt-image-2",
    temperature: 0.35,
  });
  assert.equal(patchTaskPayload.data.taskType, "trainingset_generation");
  assert.equal(patchTaskPayload.data.taskTypeLabel, "训练集图片生成");

  const listDraftsResponse = await projectGenerationTasksRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks?status=draft&taskType=trainingset_generation`),
    { params: Promise.resolve({ projectId }) },
  );
  const listDraftsPayload = await listDraftsResponse.json();
  assert.equal(listDraftsResponse.status, 200);
  assert.equal(listDraftsPayload.ok, true);
  const listedDraft = listDraftsPayload.data.find((task: { id: string }) => task.id === taskId);
  assert.ok(listedDraft, "Project generation task lists should expose draft tasks for agent handoff recovery.");
  assert.equal(listedDraft.status, "draft");
  assert.equal(listedDraft.generationKind, "image_generation");
  assert.equal(listedDraft.taskType, "trainingset_generation");
  assert.deepEqual(listedDraft.paramsJson, {
    providerModel: "gpt-image-2",
    temperature: 0.35,
  });

  const addInputResponse = await generationTaskInputsRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/inputs`, {
      method: "POST",
      body: JSON.stringify({
        referenceId: "profile-usage",
      }),
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const addInputPayload = await addInputResponse.json();
  assert.equal(addInputResponse.status, 201);
  assert.equal(addInputPayload.ok, true);
  const inputId = addInputPayload.data.id as string;

  const supplementalFormData = new FormData();
  supplementalFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "draft-extra.png", { type: "image/png" }));
  supplementalFormData.append("title", "补充图");
  supplementalFormData.append("detail", "补充附件说明");
  const supplementalImageResponse = await generationTaskSupplementalImagesRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/supplemental-images`, {
      method: "POST",
      body: supplementalFormData,
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const supplementalImagePayload = await supplementalImageResponse.json();
  assert.equal(supplementalImageResponse.status, 201);
  assert.equal(supplementalImagePayload.ok, true);

  const previewResponse = await generationTaskPreviewRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/preview`, {
      method: "POST",
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const previewPayload = await previewResponse.json();
  assert.equal(previewResponse.status, 200);
  assert.equal(previewPayload.ok, true);
  assert.equal(previewPayload.data.generationKind, "image_generation");
  assert.deepEqual(previewPayload.data.paramsJson, {
    providerModel: "gpt-image-2",
    temperature: 0.35,
  });
  assert.equal(previewPayload.data.taskType, "trainingset_generation");
  assert.equal(previewPayload.data.taskTypeLabel, "训练集图片生成");
  assert.match(previewPayload.data.finalInput, /更新后的补充提示词/);

  const removeInputResponse = await generationInputDetailRoute.DELETE(
    new Request(`http://localhost/api/training/generation-inputs/${inputId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ inputId }) },
  );
  const removeInputPayload = await removeInputResponse.json();
  assert.equal(removeInputResponse.status, 200);
  assert.equal(removeInputPayload.ok, true);

  const runResponse = await generationTaskRunRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}/run`, {
      method: "POST",
    }),
    { params: Promise.resolve({ taskId }) },
  );
  const runPayload = await runResponse.json();
  assert.equal(runResponse.status, 201);
  assert.equal(runPayload.ok, true);
  assert.equal(runPayload.data.kind, "generation");
  assert.equal(runPayload.data.projectId, projectId);
  assert.equal(runPayload.data.generationKind, "image_generation");
  assert.equal(runPayload.data.taskType, "trainingset_generation");
  assert.equal(runPayload.data.taskTypeLabel, "训练集图片生成");
  assert.ok(Array.isArray(runPayload.data.inputImages));
  assert.ok(runPayload.data.inputImages.length >= 1);

  const queuedTasksResponse = await projectGenerationTasksRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks?status=queued&taskType=trainingset_generation`),
    { params: Promise.resolve({ projectId }) },
  );
  const queuedTasksPayload = await queuedTasksResponse.json();
  assert.equal(queuedTasksResponse.status, 200);
  assert.equal(queuedTasksPayload.ok, true);
  const listedQueuedTask = queuedTasksPayload.data.find((task: { id: string }) => task.id === runPayload.data.id);
  assert.ok(listedQueuedTask, "Project generation task lists should expose queued typed tasks after a draft is run.");
  assert.equal(listedQueuedTask.generationKind, "image_generation");
  assert.equal(listedQueuedTask.taskType, "trainingset_generation");
  assert.equal(listedQueuedTask.taskTypeLabel, "训练集图片生成");

  const mismatchedTypeResponse = await projectGenerationTasksRoute.GET(
    new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks?status=queued&taskType=profile_text_generation`),
    { params: Promise.resolve({ projectId }) },
  );
  const mismatchedTypePayload = await mismatchedTypeResponse.json();
  assert.equal(mismatchedTypeResponse.status, 200);
  assert.equal(mismatchedTypePayload.ok, true);
  assert.equal(
    mismatchedTypePayload.data.some((task: { id: string }) => task.id === runPayload.data.id),
    false,
    "Project generation task taskType filters must not return a different generation task kind.",
  );

  const getAfterRunResponse = await generationTaskDetailRoute.GET(
    new Request(`http://localhost/api/training/generation-tasks/${taskId}`),
    { params: Promise.resolve({ taskId }) },
  );
  const getAfterRunPayload = await getAfterRunResponse.json();
  assert.equal(getAfterRunResponse.status, 404);
  assert.equal(getAfterRunPayload.ok, false);
});

test("managed section run route honors project scope when section ids overlap", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");

    const createProject = async (title: string) => {
      const response = await projectsRoute.POST(
        new Request("http://localhost/api/training/projects", {
          method: "POST",
          body: JSON.stringify({
            title,
            characterName: title,
            projectName: title,
            triggerToken: `duplicate_section_scope_${Date.now()}_${title}`,
            templateId: "character_identity_default",
            trainingTemplateId: "character_identity_default",
            checkpointRelativePath: "models/checkpoints/mock.safetensors",
            usagePrompt: `${title} usage`,
            detailPrompt: `${title} detail`,
            sections: [
              {
                id: "seed-1",
                title: `${title} 小节`,
                enabled: true,
                blockCount: 1,
                blocks: [
                  {
                    id: `${title}-block`,
                    source: "本地",
                    title: `${title} block`,
                    text: `${title} scene`,
                  },
                ],
                resolvedScene: `${title} scene`,
                scenePreview: `${title} scene`,
              },
            ],
            trainingDefaults: {
              autoGenerateSamples: false,
              autoFreezeDataset: false,
            },
          }),
        }),
      );
      const payload = await response.json();
      assert.equal(response.status, 201);
      assert.equal(payload.ok, true);
      return payload.data as { id: string; title: string };
    };

    const firstProject = await createProject(`重复小节项目 A ${Date.now()}`);
    const secondProject = await createProject(`重复小节项目 B ${Date.now()}`);

    const runResponse = await sectionRunRoute.POST(
      new Request("http://localhost/api/training/sections/seed-1/runs", {
        method: "POST",
        body: JSON.stringify({
          projectId: secondProject.id,
          userInstruction: "重复小节作用域测试",
        }),
      }),
      { params: Promise.resolve({ sectionId: "seed-1" }) },
    );
    const runPayload = await runResponse.json();
    assert.equal(runResponse.status, 201);
    assert.equal(runPayload.ok, true);
    assert.equal(runPayload.data.projectId, secondProject.id);
    assert.equal(runPayload.data.projectTitle, secondProject.title);
    assert.notEqual(runPayload.data.projectId, firstProject.id);
  });
});

test("managed scheduler exposes running generation runs through target-scoped worker leases", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
    const schedulerTickRoute = await import("../src/app/api/training/scheduler/tick/route");
    const workerTaskNextRoute = await import("../src/app/api/training/worker/tasks/next/route");
    const title = `测试 managed worker lease ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `managed_worker_lease_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "managed worker lease usage",
          detailPrompt: "managed worker lease detail",
          selectedReferenceIds: [seedProject.projectSelectionId],
          sections: [
            {
              id: "managed-worker-lease-section",
              title: "Managed Worker Lease Section",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "managed-worker-lease-block",
                  source: "本地",
                  title: "Managed Worker Lease Block",
                  text: "managed worker lease scene",
                },
              ],
              resolvedScene: "managed worker lease scene",
              scenePreview: "managed worker lease scene",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const sectionId = createPayload.data.sections[0].id as string;
    const generationResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          userInstruction: "managed target lease generation",
        }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const generationPayload = await generationResponse.json();
    assert.equal(generationResponse.status, 201);
    assert.equal(generationPayload.ok, true);
    const generationRunId = generationPayload.data.id as string;

    const tickResponse = await schedulerTickRoute.POST();
    const tickPayload = await tickResponse.json();
    assert.equal(tickResponse.status, 200);
    assert.equal(tickPayload.ok, true);
    assert.equal(tickPayload.data.id, generationRunId);

    const leaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=image_generation&leaseOwner=managed-agent&targetType=generationRun&targetId=${generationRunId}`,
      ),
    );
    const leasePayload = await leaseResponse.json();
    assert.equal(leaseResponse.status, 200);
    assert.equal(leasePayload.ok, true);
    assert.equal(leasePayload.data.workerType, "image_generation");
    assert.equal(leasePayload.data.targetType, "generationRun");
    assert.equal(leasePayload.data.targetId, generationRunId);
    assert.equal(leasePayload.data.status, "running");
    assert.equal(leasePayload.data.leaseOwner, "managed-agent");
  });
});

test("managed scheduler and worker endpoints can advance generation and training runs through completion", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
    const schedulerTickRoute = await import("../src/app/api/training/scheduler/tick/route");
    const workerTaskNextRoute = await import("../src/app/api/training/worker/tasks/next/route");
    const workerTaskHeartbeatRoute = await import("../src/app/api/training/worker/tasks/[taskId]/heartbeat/route");
    const workerTaskCompleteRoute = await import("../src/app/api/training/worker/tasks/[taskId]/complete/route");
    const workerGenerationCompleteRoute = await import("../src/app/api/training/worker/generation-tasks/[taskId]/complete/route");
    const datasetRevisionRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
    const trainingRunRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
    const workerTrainingProgressRoute = await import("../src/app/api/training/worker/training-runs/[trainingRunId]/progress/route");
    const workerTrainingCompleteRoute = await import("../src/app/api/training/worker/training-runs/[trainingRunId]/complete/route");
    const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
    const trainingRunDetailRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
    const title = `测试 worker 链项目 ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `test_worker_flow_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "测试 worker 链提示词",
          detailPrompt: "测试 worker 链细节",
          selectedReferenceIds: [seedProject.projectSelectionId],
          sections: [
            {
              id: "worker-section",
              title: "Worker Section",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "worker-block",
                  source: "本地",
                  title: "Worker Block",
                  text: "worker 测试场景描述",
                },
              ],
              resolvedScene: "worker 测试场景描述",
              scenePreview: "worker 测试场景描述",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const projectId = createPayload.data.id as string;
    const sectionId = createPayload.data.sections[0].id as string;

    const queuedGenerationResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          userInstruction: "worker flow generation",
        }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const queuedGenerationPayload = await queuedGenerationResponse.json();
    assert.equal(queuedGenerationResponse.status, 201);
    assert.equal(queuedGenerationPayload.ok, true);
    const generationTaskId = queuedGenerationPayload.data.id as string;

    const tickGenerationResponse = await schedulerTickRoute.POST();
    const tickGenerationPayload = await tickGenerationResponse.json();
    assert.equal(tickGenerationResponse.status, 200);
    assert.equal(tickGenerationPayload.ok, true);
    assert.equal(tickGenerationPayload.data.id, generationTaskId);
    assert.equal(tickGenerationPayload.data.status, "running");

    const generationLeaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=image_generation&leaseOwner=managed-worker-flow&targetType=generationRun&targetId=${generationTaskId}`,
      ),
    );
    const generationLeasePayload = await generationLeaseResponse.json();
    assert.equal(generationLeaseResponse.status, 200);
    assert.equal(generationLeasePayload.ok, true);
    assert.equal(generationLeasePayload.data.targetId, generationTaskId);
    const generationWorkerTaskId = generationLeasePayload.data.id as string;

    const generationHeartbeatResponse = await workerTaskHeartbeatRoute.POST(
      new Request(`http://localhost/api/training/worker/tasks/${generationWorkerTaskId}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({
          leaseOwner: "managed-worker-flow",
          progressJson: { phase: "generating" },
        }),
      }),
      { params: Promise.resolve({ taskId: generationWorkerTaskId }) },
    );
    const generationHeartbeatPayload = await generationHeartbeatResponse.json();
    assert.equal(generationHeartbeatResponse.status, 200);
    assert.equal(generationHeartbeatPayload.ok, true);
    assert.deepEqual(generationHeartbeatPayload.data.progressJson, { phase: "generating" });

    const completeGenerationResponse = await workerGenerationCompleteRoute.POST(
      new Request(`http://localhost/api/training/worker/generation-tasks/${generationTaskId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          captionDraft: "worker 生成结果",
          reviewStatus: "keep",
        }),
      }),
      { params: Promise.resolve({ taskId: generationTaskId }) },
    );
    const completeGenerationPayload = await completeGenerationResponse.json();
    assert.equal(completeGenerationResponse.status, 200);
    assert.equal(completeGenerationPayload.ok, true);
    assert.equal(completeGenerationPayload.data.id, generationTaskId);
    assert.equal(completeGenerationPayload.data.status, "completed");

    const completeGenerationWorkerResponse = await workerTaskCompleteRoute.POST(
      new Request(`http://localhost/api/training/worker/tasks/${generationWorkerTaskId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          leaseOwner: "managed-worker-flow",
        }),
      }),
      { params: Promise.resolve({ taskId: generationWorkerTaskId }) },
    );
    const completeGenerationWorkerPayload = await completeGenerationWorkerResponse.json();
    assert.equal(completeGenerationWorkerResponse.status, 200);
    assert.equal(completeGenerationWorkerPayload.ok, true);
    assert.equal(completeGenerationWorkerPayload.data.status, "succeeded");

    const generationDetailResponse = await generationTaskDetailRoute.GET(
      new Request(`http://localhost/api/training/generation-tasks/${generationTaskId}`),
      { params: Promise.resolve({ taskId: generationTaskId }) },
    );
    const generationDetailPayload = await generationDetailResponse.json();
    assert.equal(generationDetailResponse.status, 200);
    assert.equal(generationDetailPayload.ok, true);
    assert.ok(Array.isArray(generationDetailPayload.data.outputResultIds));
    assert.equal(generationDetailPayload.data.outputResultIds.length, 1);
    assert.equal(typeof generationDetailPayload.data.outputResultIds[0], "string");

    const freezeResponse = await datasetRevisionRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/dataset-revisions`, {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const freezePayload = await freezeResponse.json();
    assert.equal(freezeResponse.status, 201);
    assert.equal(freezePayload.ok, true);
    const revisionId = freezePayload.data.revision.id as string;

    const queuedTrainingResponse = await trainingRunRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/training-runs`, {
        method: "POST",
        body: JSON.stringify({
          revisionId,
          config: {
            overrides: {
              ordinary: {
                targetSteps: 1200,
              },
            },
          },
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const queuedTrainingPayload = await queuedTrainingResponse.json();
    assert.equal(queuedTrainingResponse.status, 201);
    assert.equal(queuedTrainingPayload.ok, true);
    const trainingRunId = queuedTrainingPayload.data.id as string;

    const tickTrainingResponse = await schedulerTickRoute.POST();
    const tickTrainingPayload = await tickTrainingResponse.json();
    assert.equal(tickTrainingResponse.status, 200);
    assert.equal(tickTrainingPayload.ok, true);
    assert.equal(tickTrainingPayload.data.id, trainingRunId);
    assert.equal(tickTrainingPayload.data.status, "running");

    const trainingLeaseResponse = await workerTaskNextRoute.GET(
      new Request(
        `http://localhost/api/training/worker/tasks/next?workerType=training&leaseOwner=managed-worker-flow&targetType=trainingRun&targetId=${trainingRunId}`,
      ),
    );
    const trainingLeasePayload = await trainingLeaseResponse.json();
    assert.equal(trainingLeaseResponse.status, 200);
    assert.equal(trainingLeasePayload.ok, true);
    assert.equal(trainingLeasePayload.data.targetId, trainingRunId);
    const trainingWorkerTaskId = trainingLeasePayload.data.id as string;

    const trainingHeartbeatResponse = await workerTaskHeartbeatRoute.POST(
      new Request(`http://localhost/api/training/worker/tasks/${trainingWorkerTaskId}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({
          leaseOwner: "managed-worker-flow",
          progressJson: { phase: "training", currentStep: 600, targetSteps: 1200 },
        }),
      }),
      { params: Promise.resolve({ taskId: trainingWorkerTaskId }) },
    );
    const trainingHeartbeatPayload = await trainingHeartbeatResponse.json();
    assert.equal(trainingHeartbeatResponse.status, 200);
    assert.equal(trainingHeartbeatPayload.ok, true);
    assert.deepEqual(trainingHeartbeatPayload.data.progressJson, { phase: "training", currentStep: 600, targetSteps: 1200 });

    const progressResponse = await workerTrainingProgressRoute.POST(
      new Request(`http://localhost/api/training/worker/training-runs/${trainingRunId}/progress`, {
        method: "POST",
        body: JSON.stringify({
          currentStep: 600,
          targetSteps: 1200,
          schedulerMessage: "进行中 600 / 1200",
        }),
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const progressPayload = await progressResponse.json();
    assert.equal(progressResponse.status, 200);
    assert.equal(progressPayload.ok, true);
    assert.equal(progressPayload.data.currentStep, 600);
    assert.equal(progressPayload.data.status, "running");

    const completeTrainingResponse = await workerTrainingCompleteRoute.POST(
      new Request(`http://localhost/api/training/worker/training-runs/${trainingRunId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          artifactName: "worker_complete.safetensors",
        }),
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const completeTrainingPayload = await completeTrainingResponse.json();
    assert.equal(completeTrainingResponse.status, 200);
    assert.equal(completeTrainingPayload.ok, true);
    assert.equal(completeTrainingPayload.data.status, "completed");
    assert.equal(completeTrainingPayload.data.artifactName, "worker_complete.safetensors");

    const completeTrainingWorkerResponse = await workerTaskCompleteRoute.POST(
      new Request(`http://localhost/api/training/worker/tasks/${trainingWorkerTaskId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          leaseOwner: "managed-worker-flow",
        }),
      }),
      { params: Promise.resolve({ taskId: trainingWorkerTaskId }) },
    );
    const completeTrainingWorkerPayload = await completeTrainingWorkerResponse.json();
    assert.equal(completeTrainingWorkerResponse.status, 200);
    assert.equal(completeTrainingWorkerPayload.ok, true);
    assert.equal(completeTrainingWorkerPayload.data.status, "succeeded");

    const trainingDetailResponse = await trainingRunDetailRoute.GET(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const trainingDetailPayload = await trainingDetailResponse.json();
    assert.equal(trainingDetailResponse.status, 200);
    assert.equal(trainingDetailPayload.ok, true);
    assert.equal(trainingDetailPayload.data.status, "completed");
    assert.equal(trainingDetailPayload.data.artifactName, "worker_complete.safetensors");
    assert.equal(typeof trainingDetailPayload.data.finalLoraArtifactId, "string");
  });
});

test("managed worker endpoints can mark generation and training runs as failed through /api/training", async () => {
  await withTrainingManagedStoreSnapshot(async () => {
    const seedProject = await createManagedReferenceSeedProject();
    const projectsRoute = await import("../src/app/api/training/projects/route");
    const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
    const schedulerTickRoute = await import("../src/app/api/training/scheduler/tick/route");
    const workerGenerationFailRoute = await import("../src/app/api/training/worker/generation-tasks/[taskId]/fail/route");
    const datasetRevisionRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
    const trainingRunRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
    const workerTrainingFailRoute = await import("../src/app/api/training/worker/training-runs/[trainingRunId]/fail/route");
    const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
    const trainingRunDetailRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
    const title = `测试 worker fail 项目 ${Date.now()}`;

    const createResponse = await projectsRoute.POST(
      new Request("http://localhost/api/training/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          characterName: title,
          projectName: title,
          triggerToken: `test_worker_fail_${Date.now()}`,
          templateId: "character_identity_default",
          trainingTemplateId: "character_identity_default",
          checkpointRelativePath: "models/checkpoints/mock.safetensors",
          usagePrompt: "测试 worker fail 提示词",
          detailPrompt: "测试 worker fail 细节",
          selectedReferenceIds: [seedProject.projectSelectionId],
          sections: [
            {
              id: "worker-fail-section",
              title: "Worker Fail Section",
              enabled: true,
              blockCount: 1,
              blocks: [
                {
                  id: "worker-fail-block",
                  source: "本地",
                  title: "Worker Fail Block",
                  text: "worker fail 场景描述",
                },
              ],
              resolvedScene: "worker fail 场景描述",
              scenePreview: "worker fail 场景描述",
            },
          ],
          trainingDefaults: {
            autoGenerateSamples: false,
            autoFreezeDataset: false,
          },
        }),
      }),
    );
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.ok, true);

    const projectId = createPayload.data.id as string;
    const sectionId = createPayload.data.sections[0].id as string;
    const generationResponse = await sectionRunRoute.POST(
      new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          userInstruction: "worker fail generation",
        }),
      }),
      { params: Promise.resolve({ sectionId }) },
    );
    const generationPayload = await generationResponse.json();
    const generationTaskId = generationPayload.data.id as string;
    await schedulerTickRoute.POST();

    const failGenerationResponse = await workerGenerationFailRoute.POST(
      new Request(`http://localhost/api/training/worker/generation-tasks/${generationTaskId}/fail`, {
        method: "POST",
        body: JSON.stringify({
          errorSummary: "生成任务失败",
        }),
      }),
      { params: Promise.resolve({ taskId: generationTaskId }) },
    );
    const failGenerationPayload = await failGenerationResponse.json();
    assert.equal(failGenerationResponse.status, 200);
    assert.equal(failGenerationPayload.ok, true);
    assert.equal(failGenerationPayload.data.status, "failed");

    const generationDetailResponse = await generationTaskDetailRoute.GET(
      new Request(`http://localhost/api/training/generation-tasks/${generationTaskId}`),
      { params: Promise.resolve({ taskId: generationTaskId }) },
    );
    const generationDetailPayload = await generationDetailResponse.json();
    assert.equal(generationDetailPayload.data.status, "failed");

    const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
    const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
    const reviewRoute = await import("../src/app/api/training/image-results/[imageResultId]/review/route");
    const uploadReferenceFormData = new FormData();
    uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "worker-fail-reference.png", { type: "image/png" }));
    uploadReferenceFormData.append("role", "source");
    const uploadReferenceResponse = await referenceRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
        method: "POST",
        body: uploadReferenceFormData,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const uploadReferencePayload = await uploadReferenceResponse.json();
    assert.equal(uploadReferenceResponse.status, 201);
    assert.equal(uploadReferencePayload.ok, true);
    const imageId = uploadReferencePayload.data.id as string;
    const addToResultsResponse = await addToResultsRoute.POST(
      new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
        method: "POST",
        body: JSON.stringify({ reviewStatus: "pending", captionDraft: "可训练参考图" }),
      }),
      { params: Promise.resolve({ imageId }) },
    );
    const addToResultsPayload = await addToResultsResponse.json();
    const imageResultId = addToResultsPayload.data.id as string;
    await reviewRoute.POST(
      new Request(`http://localhost/api/training/image-results/${imageResultId}/review`, {
        method: "POST",
        body: JSON.stringify({ reviewStatus: "keep" }),
      }),
      { params: Promise.resolve({ imageResultId }) },
    );

    const freezeResponse = await datasetRevisionRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/dataset-revisions`, {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const freezePayload = await freezeResponse.json();
    const revisionId = freezePayload.data.revision.id as string;

    const trainingResponse = await trainingRunRoute.POST(
      new Request(`http://localhost/api/training/projects/${projectId}/training-runs`, {
        method: "POST",
        body: JSON.stringify({
          revisionId,
        }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const trainingPayload = await trainingResponse.json();
    const trainingRunId = trainingPayload.data.id as string;
    await schedulerTickRoute.POST();

    const failTrainingResponse = await workerTrainingFailRoute.POST(
      new Request(`http://localhost/api/training/worker/training-runs/${trainingRunId}/fail`, {
        method: "POST",
        body: JSON.stringify({
          errorSummary: "训练任务失败",
        }),
      }),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const failTrainingPayload = await failTrainingResponse.json();
    assert.equal(failTrainingResponse.status, 200);
    assert.equal(failTrainingPayload.ok, true);
    assert.equal(failTrainingPayload.data.status, "failed");

    const trainingDetailResponse = await trainingRunDetailRoute.GET(
      new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
      { params: Promise.resolve({ trainingRunId }) },
    );
    const trainingDetailPayload = await trainingDetailResponse.json();
    assert.equal(trainingDetailPayload.data.status, "failed");
  });
});

test("managed training project can enqueue generation, freeze dataset, and start training through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const referenceRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const reviewRoute = await import("../src/app/api/training/image-results/[imageResultId]/review/route");
  const sectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const datasetRevisionRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const trainingRunRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const generationTaskDetailRoute = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const cancelGenerationTaskRoute = await import("../src/app/api/training/generation-tasks/[taskId]/cancel/route");
  const cancelTrainingRunRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/cancel/route");
  const trainingRunDetailRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
  const title = `测试运行链项目 ${Date.now()}`;
  const seedProject = await createManagedReferenceSeedProject();

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_run_project_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        baseModel: "继承训练默认模型",
        captionStrategy: "先触发词后描述",
        usagePrompt: "测试角色触发词",
        detailPrompt: "测试角色细节描述",
        perSectionImageCount: "4",
        trainingSteps: "2400",
        selectedReferenceIds: [seedProject.projectSelectionId],
        sections: [
          {
            id: "seed-1",
            title: "新小节 1",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "block-1",
                source: "本地",
                title: "本地场景描述",
                text: "测试场景描述",
              },
            ],
            resolvedScene: "测试场景描述",
            scenePreview: "测试场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: true,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const sectionId = createPayload.data.sections[0].id as string;
  const uploadReferenceFormData = new FormData();
  uploadReferenceFormData.append("file", new File([new Uint8Array([137, 80, 78, 71])], "run-chain-reference.png", { type: "image/png" }));
  uploadReferenceFormData.append("role", "source");
  const uploadReferenceResponse = await referenceRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/reference-images`, {
      method: "POST",
      body: uploadReferenceFormData,
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const uploadReferencePayload = await uploadReferenceResponse.json();
  assert.equal(uploadReferenceResponse.status, 201);
  assert.equal(uploadReferencePayload.ok, true);
  const imageId = uploadReferencePayload.data.id as string;

  const addToResultsResponse = await addToResultsRoute.POST(
    new Request(`http://localhost/api/training/reference-images/${imageId}/add-to-results`, {
      method: "POST",
      body: JSON.stringify({ reviewStatus: "pending", captionDraft: "可训练参考图" }),
    }),
    { params: Promise.resolve({ imageId }) },
  );
  const addToResultsPayload = await addToResultsResponse.json();
  assert.equal(addToResultsResponse.status, 201);
  assert.equal(addToResultsPayload.ok, true);
  const imageResultId = addToResultsPayload.data.id as string;

  const keepResponse = await reviewRoute.POST(
    new Request(`http://localhost/api/training/image-results/${imageResultId}/review`, {
      method: "POST",
      body: JSON.stringify({ reviewStatus: "keep" }),
    }),
    { params: Promise.resolve({ imageResultId }) },
  );
  const keepPayload = await keepResponse.json();
  assert.equal(keepResponse.status, 200);
  assert.equal(keepPayload.ok, true);
  assert.equal(keepPayload.data.reviewStatus, "kept");

  const generationResponse = await sectionRunRoute.POST(
    new Request(`http://localhost/api/training/sections/${sectionId}/runs`, {
      method: "POST",
      body: JSON.stringify({
        userInstruction: "训练集图片生成\n\n测试场景描述",
        sourceImageIds: [imageId],
      }),
    }),
    { params: Promise.resolve({ sectionId }) },
  );
  const generationPayload = await generationResponse.json();
  assert.equal(generationResponse.status, 201);
  assert.equal(generationPayload.ok, true);
  assert.equal(generationPayload.data.kind, "generation");

  const generationRunId = generationPayload.data.id as string;
  const generationDetailResponse = await generationTaskDetailRoute.GET(
    new Request(`http://localhost/api/training/generation-tasks/${generationRunId}`),
    { params: Promise.resolve({ taskId: generationRunId }) },
  );
  const generationDetailPayload = await generationDetailResponse.json();
  assert.equal(generationDetailResponse.status, 200);
  assert.equal(generationDetailPayload.ok, true);
  assert.equal(generationDetailPayload.data.id, generationRunId);

  const cancelGenerationResponse = await cancelGenerationTaskRoute.POST(
    new Request(`http://localhost/api/training/generation-tasks/${generationRunId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ requestedBy: "test" }),
    }),
    { params: Promise.resolve({ taskId: generationRunId }) },
  );
  const cancelGenerationPayload = await cancelGenerationResponse.json();
  assert.equal(cancelGenerationResponse.status, 200);
  assert.equal(cancelGenerationPayload.ok, true);
  assert.equal(cancelGenerationPayload.data.id, generationRunId);

  const revisionResponse = await datasetRevisionRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/dataset-revisions`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const revisionPayload = await revisionResponse.json();
  assert.equal(revisionResponse.status, 201);
  assert.equal(revisionPayload.ok, true);
  assert.equal(typeof revisionPayload.data.revision.id, "string");

  const revisionId = revisionPayload.data.revision.id as string;

  const trainingResponse = await trainingRunRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/training-runs`, {
      method: "POST",
      body: JSON.stringify({
        revisionId,
        config: {
          overrides: {
            ordinary: {
              targetSteps: 2400,
            },
          },
        },
      }),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const trainingPayload = await trainingResponse.json();
  assert.equal(trainingResponse.status, 201);
  assert.equal(trainingPayload.ok, true);
  assert.equal(trainingPayload.data.kind, "training");
  assert.equal(trainingPayload.data.datasetRevisionId, revisionId);

  const duplicateTrainingResponse = await trainingRunRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/training-runs`, {
      method: "POST",
      body: JSON.stringify({
        revisionId,
        config: {
          overrides: {
            ordinary: {
              targetSteps: 2400,
            },
          },
        },
      }),
    }),
    { params: Promise.resolve({ projectId }) },
  );
  const duplicateTrainingPayload = await duplicateTrainingResponse.json();
  assert.equal(duplicateTrainingResponse.status, 409);
  assert.equal(duplicateTrainingPayload.ok, false);
  assert.match(String(duplicateTrainingPayload.error?.message ?? ""), /active training run/i);

  const trainingRunId = trainingPayload.data.id as string;
  const trainingDetailResponse = await trainingRunDetailRoute.GET(
    new Request(`http://localhost/api/training/training-runs/${trainingRunId}`),
    { params: Promise.resolve({ trainingRunId }) },
  );
  const trainingDetailPayload = await trainingDetailResponse.json();
  assert.equal(trainingDetailResponse.status, 200);
  assert.equal(trainingDetailPayload.ok, true);
  assert.equal(trainingDetailPayload.data.id, trainingRunId);

  const cancelTrainingResponse = await cancelTrainingRunRoute.POST(
    new Request(`http://localhost/api/training/training-runs/${trainingRunId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ requestedBy: "test" }),
    }),
    { params: Promise.resolve({ trainingRunId }) },
  );
  const cancelTrainingPayload = await cancelTrainingResponse.json();
  assert.equal(cancelTrainingResponse.status, 200);
  assert.equal(cancelTrainingPayload.ok, true);
  assert.equal(cancelTrainingPayload.data.id, trainingRunId);
});

test("managed training project archives and restores through /api/training", async () => {
  const projectsRoute = await import("../src/app/api/training/projects/route");
  const archiveRoute = await import("../src/app/api/training/projects/[projectId]/archive/route");
  const restoreRoute = await import("../src/app/api/training/projects/[projectId]/restore/route");
  const title = `测试归档项目 ${Date.now()}`;

  const createResponse = await projectsRoute.POST(
    new Request("http://localhost/api/training/projects", {
      method: "POST",
      body: JSON.stringify({
        title,
        characterName: title,
        projectName: title,
        triggerToken: `test_archive_project_${Date.now()}`,
        templateId: "character_identity_default",
        trainingTemplateId: "character_identity_default",
        checkpointRelativePath: "models/checkpoints/mock.safetensors",
        baseModel: "继承训练默认模型",
        captionStrategy: "先触发词后描述",
        usagePrompt: "测试角色触发词",
        detailPrompt: "测试角色细节描述",
        perSectionImageCount: "4",
        trainingSteps: "2400",
        selectedReferenceIds: [],
        sections: [
          {
            id: "seed-1",
            title: "新小节 1",
            enabled: true,
            blockCount: 1,
            blocks: [
              {
                id: "block-1",
                source: "本地",
                title: "本地场景描述",
                text: "测试场景描述",
              },
            ],
            resolvedScene: "测试场景描述",
            scenePreview: "测试场景描述",
          },
        ],
        trainingDefaults: {
          autoGenerateSamples: true,
          autoFreezeDataset: false,
        },
      }),
    }),
  );
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.ok, true);
  const projectId = createPayload.data.id as string;
  const params = { params: Promise.resolve({ projectId }) };

  const archiveResponse = await archiveRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/archive`, { method: "POST" }),
    params,
  );
  const archivePayload = await archiveResponse.json();
  assert.equal(archiveResponse.status, 200);
  assert.equal(archivePayload.ok, true);
  assert.equal(archivePayload.data.status, "archived");

  const restoreResponse = await restoreRoute.POST(
    new Request(`http://localhost/api/training/projects/${projectId}/restore`, { method: "POST" }),
    params,
  );
  const restorePayload = await restoreResponse.json();
  assert.equal(restoreResponse.status, 200);
  assert.equal(restorePayload.ok, true);
  assert.notEqual(restorePayload.data.status, "archived");
});

test("GET /api/training/scheduler/status exposes a training scheduler snapshot", async () => {
  const { GET } = await import("../src/app/api/training/scheduler/status/route");

  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.data.workerQueueStatus, "object");
  assert.equal(typeof payload.data.summary.projectCount, "number");
  assert.equal(typeof payload.data.summary.runCount, "number");
});

test("training write routes exist under /api/training and fail through HTTP contracts instead of missing handlers", async () => {
  const createProjectRoute = await import("../src/app/api/training/projects/route");
  const updateProjectRoute = await import("../src/app/api/training/projects/[projectId]/route");
  const archiveProjectRoute = await import("../src/app/api/training/projects/[projectId]/archive/route");
  const restoreProjectRoute = await import("../src/app/api/training/projects/[projectId]/restore/route");
  const updateProjectSectionRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");
  const updateSectionAliasRoute = await import("../src/app/api/training/sections/[sectionId]/route");
  const textRevisionsRoute = await import("../src/app/api/training/projects/[projectId]/text-revisions/route");
  const restoreTextRevisionRoute = await import("../src/app/api/training/text-revisions/[revisionId]/restore/route");
  const applyGenerationOutputRoute = await import("../src/app/api/training/generation-outputs/[outputId]/apply/route");
  const createSceneCategoryRoute = await import("../src/app/api/training/scene-description/categories/route");
  const updateSceneCategoryRoute = await import("../src/app/api/training/scene-description/categories/[categoryId]/route");
  const createSceneFolderRoute = await import("../src/app/api/training/scene-description/folders/route");
  const updateSceneFolderRoute = await import("../src/app/api/training/scene-description/folders/[folderId]/route");
  const createTrainingPresetRoute = await import("../src/app/api/training/presets/route");
  const saveTrainingPresetSortRulesRoute = await import("../src/app/api/training/presets/sort-rules/route");
  const updateTrainingPresetRoute = await import("../src/app/api/training/presets/[presetId]/route");
  const createScenePresetAliasRoute = await import("../src/app/api/training/scene-description/presets/route");
  const updateScenePresetAliasRoute = await import("../src/app/api/training/scene-description/presets/[presetId]/route");
  const createTrainingTemplateRoute = await import("../src/app/api/training/templates/route");
  const updateTrainingTemplateRoute = await import("../src/app/api/training/templates/[templateId]/route");
  const updateTrainingTemplateSectionRoute = await import("../src/app/api/training/templates/[templateId]/sections/[sectionId]/route");
  const freezeDatasetRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const enqueueTrainingRunRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const enqueueSectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const cancelTrainingRunRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/cancel/route");

  const missingProjectParams = { params: Promise.resolve({ projectId: "missing-project" }) };
  const missingSectionParams = { params: Promise.resolve({ sectionId: "missing-section" }) };
  const missingProjectSectionParams = { params: Promise.resolve({ projectId: "missing-project", sectionId: "missing-section" }) };
  const missingRunParams = { params: Promise.resolve({ trainingRunId: "missing-run" }) };
  const missingPresetParams = { params: Promise.resolve({ presetId: "missing-preset" }) };
  const missingCategoryParams = { params: Promise.resolve({ categoryId: "missing-category" }) };
  const missingFolderParams = { params: Promise.resolve({ folderId: "missing-folder" }) };
  const missingOutputParams = { params: Promise.resolve({ outputId: "missing-output" }) };
  const missingRevisionParams = { params: Promise.resolve({ revisionId: "missing-revision" }) };
  const missingTemplateParams = { params: Promise.resolve({ templateId: "missing-template" }) };
  const missingTemplateSectionParams = { params: Promise.resolve({ templateId: "missing-template", sectionId: "missing-section" }) };

  const [createResponse, updateResponse, archiveResponse, restoreResponse, updateProjectSectionResponse, updateSectionAliasResponse, listTextRevisionsResponse, createTextRevisionResponse, restoreTextRevisionResponse, applyGenerationOutputResponse, createSceneCategoryResponse, updateSceneCategoryResponse, createSceneFolderResponse, updateSceneFolderResponse, createPresetResponse, savePresetSortRulesResponse, updatePresetResponse, createScenePresetAliasResponse, updateScenePresetAliasResponse, createTemplateResponse, updateTemplateResponse, updateTemplateSectionResponse, freezeResponse, enqueueTrainingResponse, enqueueSectionResponse, cancelResponse] = await Promise.all([
    createProjectRoute.POST(new Request("http://localhost/api/training/projects", { method: "POST", body: "{}" })),
    updateProjectRoute.PATCH(new Request("http://localhost/api/training/projects/missing-project", { method: "PATCH", body: "{}" }), missingProjectParams),
    archiveProjectRoute.POST(new Request("http://localhost/api/training/projects/missing-project/archive", { method: "POST" }), missingProjectParams),
    restoreProjectRoute.POST(new Request("http://localhost/api/training/projects/missing-project/restore", { method: "POST" }), missingProjectParams),
    updateProjectSectionRoute.PATCH(new Request("http://localhost/api/training/projects/missing-project/sections/missing-section", { method: "PATCH", body: "{}" }), missingProjectSectionParams),
    updateSectionAliasRoute.PATCH(new Request("http://localhost/api/training/sections/missing-section", { method: "PATCH", body: "{}" }), missingSectionParams),
    textRevisionsRoute.GET(new Request("http://localhost/api/training/projects/missing-project/text-revisions?entityType=profile&entityId=missing-project&fieldName=loraUsagePrompt"), missingProjectParams),
    textRevisionsRoute.POST(new Request("http://localhost/api/training/projects/missing-project/text-revisions", { method: "POST", body: "{}" }), missingProjectParams),
    restoreTextRevisionRoute.POST(new Request("http://localhost/api/training/text-revisions/missing-revision/restore", { method: "POST" }), missingRevisionParams),
    applyGenerationOutputRoute.POST(new Request("http://localhost/api/training/generation-outputs/missing-output/apply", { method: "POST", body: JSON.stringify({ targetEntityType: "reference_image" }) }), missingOutputParams),
    createSceneCategoryRoute.POST(new Request("http://localhost/api/training/scene-description/categories", { method: "POST", body: "{}" })),
    updateSceneCategoryRoute.PATCH(new Request("http://localhost/api/training/scene-description/categories/missing-category", { method: "PATCH", body: "{}" }), missingCategoryParams),
    createSceneFolderRoute.POST(new Request("http://localhost/api/training/scene-description/folders", { method: "POST", body: "{}" })),
    updateSceneFolderRoute.PATCH(new Request("http://localhost/api/training/scene-description/folders/missing-folder", { method: "PATCH", body: "{}" }), missingFolderParams),
    createTrainingPresetRoute.POST(new Request("http://localhost/api/training/presets", { method: "POST", body: "{}" })),
    saveTrainingPresetSortRulesRoute.POST(new Request("http://localhost/api/training/presets/sort-rules", { method: "POST", body: "{}" })),
    updateTrainingPresetRoute.PATCH(new Request("http://localhost/api/training/presets/missing-preset", { method: "PATCH", body: "{}" }), missingPresetParams),
    createScenePresetAliasRoute.POST(new Request("http://localhost/api/training/scene-description/presets", { method: "POST", body: "{}" })),
    updateScenePresetAliasRoute.PATCH(new Request("http://localhost/api/training/scene-description/presets/missing-preset", { method: "PATCH", body: "{}" }), missingPresetParams),
    createTrainingTemplateRoute.POST(new Request("http://localhost/api/training/templates", { method: "POST", body: "{}" })),
    updateTrainingTemplateRoute.PATCH(new Request("http://localhost/api/training/templates/missing-template", { method: "PATCH", body: "{}" }), missingTemplateParams),
    updateTrainingTemplateSectionRoute.PATCH(new Request("http://localhost/api/training/templates/missing-template/sections/missing-section", { method: "PATCH", body: "{}" }), missingTemplateSectionParams),
    freezeDatasetRoute.POST(new Request("http://localhost/api/training/projects/missing-project/dataset-revisions", { method: "POST", body: "{}" }), missingProjectParams),
    enqueueTrainingRunRoute.POST(new Request("http://localhost/api/training/projects/missing-project/training-runs", { method: "POST", body: "{}" }), missingProjectParams),
    enqueueSectionRunRoute.POST(new Request("http://localhost/api/training/sections/missing-section/runs", { method: "POST", body: "{}" }), missingSectionParams),
    cancelTrainingRunRoute.POST(new Request("http://localhost/api/training/training-runs/missing-run/cancel", { method: "POST", body: "{}" }), missingRunParams),
  ]);

  const payloads = await Promise.all([
    createResponse.json(),
    updateResponse.json(),
    archiveResponse.json(),
    restoreResponse.json(),
    updateProjectSectionResponse.json(),
    updateSectionAliasResponse.json(),
    listTextRevisionsResponse.json(),
    createTextRevisionResponse.json(),
    restoreTextRevisionResponse.json(),
    applyGenerationOutputResponse.json(),
    createSceneCategoryResponse.json(),
    updateSceneCategoryResponse.json(),
    createSceneFolderResponse.json(),
    updateSceneFolderResponse.json(),
    createPresetResponse.json(),
    savePresetSortRulesResponse.json(),
    updatePresetResponse.json(),
    createScenePresetAliasResponse.json(),
    updateScenePresetAliasResponse.json(),
    createTemplateResponse.json(),
    updateTemplateResponse.json(),
    updateTemplateSectionResponse.json(),
    freezeResponse.json(),
    enqueueTrainingResponse.json(),
    enqueueSectionResponse.json(),
    cancelResponse.json(),
  ]);

  assert.equal(createResponse.status, 400);
  assert.equal(payloads[0].ok, false);
  assert.ok(updateResponse.status >= 400);
  assert.equal(payloads[1].ok, false);
  assert.ok(archiveResponse.status >= 400);
  assert.equal(payloads[2].ok, false);
  assert.ok(restoreResponse.status >= 400);
  assert.equal(payloads[3].ok, false);
  assert.ok(updateProjectSectionResponse.status >= 400);
  assert.equal(payloads[4].ok, false);
  assert.ok(updateSectionAliasResponse.status >= 400);
  assert.equal(payloads[5].ok, false);
  assert.ok(listTextRevisionsResponse.status >= 400);
  assert.equal(payloads[6].ok, false);
  assert.ok(createTextRevisionResponse.status >= 400);
  assert.equal(payloads[7].ok, false);
  assert.ok(restoreTextRevisionResponse.status >= 400);
  assert.equal(payloads[8].ok, false);
  assert.ok(applyGenerationOutputResponse.status >= 400);
  assert.equal(payloads[9].ok, false);
  assert.ok(createSceneCategoryResponse.status >= 400);
  assert.equal(payloads[10].ok, false);
  assert.ok(updateSceneCategoryResponse.status >= 400);
  assert.equal(payloads[11].ok, false);
  assert.ok(createSceneFolderResponse.status >= 400);
  assert.equal(payloads[12].ok, false);
  assert.ok(updateSceneFolderResponse.status >= 400);
  assert.equal(payloads[13].ok, false);
  assert.ok(createPresetResponse.status >= 400);
  assert.equal(payloads[14].ok, false);
  assert.ok(savePresetSortRulesResponse.status >= 400);
  assert.equal(payloads[15].ok, false);
  assert.ok(updatePresetResponse.status >= 400);
  assert.equal(payloads[16].ok, false);
  assert.ok(createScenePresetAliasResponse.status >= 400);
  assert.equal(payloads[17].ok, false);
  assert.ok(updateScenePresetAliasResponse.status >= 400);
  assert.equal(payloads[18].ok, false);
  assert.ok(createTemplateResponse.status >= 400);
  assert.equal(payloads[19].ok, false);
  assert.ok(updateTemplateResponse.status >= 400);
  assert.equal(payloads[20].ok, false);
  assert.ok(updateTemplateSectionResponse.status >= 400);
  assert.equal(payloads[21].ok, false);
  assert.ok(freezeResponse.status >= 400);
  assert.equal(payloads[22].ok, false);
  assert.ok(enqueueTrainingResponse.status >= 400);
  assert.equal(payloads[23].ok, false);
  assert.ok(enqueueSectionResponse.status >= 400);
  assert.equal(payloads[24].ok, false);
  assert.ok(cancelResponse.status >= 400);
  assert.equal(payloads[25].ok, false);
});

test("training asset and review routes exist under /api/training and return JSON error contracts", async () => {
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  const referenceImagesRoute = await import("../src/app/api/training/projects/[projectId]/reference-images/route");
  const addToResultsRoute = await import("../src/app/api/training/reference-images/[imageId]/add-to-results/route");
  const reviewImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/review/route");
  const patchImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  const imageCaptionRoute = await import("../src/app/api/training/image-results/[imageResultId]/caption/route");
  const bulkCaptionsRoute = await import("../src/app/api/training/projects/[projectId]/captions/generate/route");

  const missingProjectParams = { params: Promise.resolve({ projectId: "missing-project" }) };
  const missingImageParams = { params: Promise.resolve({ imageId: "missing-image" }) };
  const missingResultParams = { params: Promise.resolve({ imageResultId: "missing-result" }) };

  const [profileResponse, listResponse, uploadResponse, addToResultsResponse, reviewResponse, patchResponse, imageCaptionResponse, bulkCaptionsResponse] = await Promise.all([
    profileRoute.GET(new Request("http://localhost/api/training/projects/missing-project/profile"), missingProjectParams),
    referenceImagesRoute.GET(new Request("http://localhost/api/training/projects/missing-project/reference-images"), missingProjectParams),
    referenceImagesRoute.POST(new Request("http://localhost/api/training/projects/missing-project/reference-images", { method: "POST" }), missingProjectParams),
    addToResultsRoute.POST(new Request("http://localhost/api/training/reference-images/missing-image/add-to-results", { method: "POST", body: "{}" }), missingImageParams),
    reviewImageRoute.POST(new Request("http://localhost/api/training/image-results/missing-result/review", { method: "POST", body: JSON.stringify({ reviewStatus: "kept" }) }), missingResultParams),
    patchImageRoute.PATCH(new Request("http://localhost/api/training/image-results/missing-result", { method: "PATCH", body: JSON.stringify({ captionDraft: "updated caption" }) }), missingResultParams),
    imageCaptionRoute.POST(new Request("http://localhost/api/training/image-results/missing-result/caption", { method: "POST", body: JSON.stringify({ captionDraft: "updated caption" }) }), missingResultParams),
    bulkCaptionsRoute.POST(new Request("http://localhost/api/training/projects/missing-project/captions/generate", { method: "POST", body: JSON.stringify({ captions: [{ imageId: "missing-result", captionDraft: "updated caption" }] }) }), missingProjectParams),
  ]);

  const payloads = await Promise.all([
    profileResponse.json(),
    listResponse.json(),
    uploadResponse.json(),
    addToResultsResponse.json(),
    reviewResponse.json(),
    patchResponse.json(),
    imageCaptionResponse.json(),
    bulkCaptionsResponse.json(),
  ]);

  for (const [response, payload] of [
    [profileResponse, payloads[0]],
    [listResponse, payloads[1]],
    [uploadResponse, payloads[2]],
    [addToResultsResponse, payloads[3]],
    [reviewResponse, payloads[4]],
    [patchResponse, payloads[5]],
    [imageCaptionResponse, payloads[6]],
    [bulkCaptionsResponse, payloads[7]],
  ] as const) {
    assert.ok(response.status >= 400);
    assert.equal(payload.ok, false);
    assert.equal(typeof payload.error.message, "string");
  }
});

test("training profile update route exists under /api/training and returns JSON error contracts", async () => {
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  const missingProjectParams = { params: Promise.resolve({ projectId: "missing-project" }) };

  const invalidBodyResponse = await profileRoute.PATCH(
    new Request("http://localhost/api/training/projects/missing-project/profile", {
      method: "PATCH",
      body: JSON.stringify({ characterDetailPrompt: "plain text", loraUsagePrompt: "new prompt" }),
    }),
    missingProjectParams,
  );
  const invalidBodyPayload = await invalidBodyResponse.json();

  assert.ok(invalidBodyResponse.status >= 400);
  assert.equal(invalidBodyPayload.ok, false);
  assert.equal(typeof invalidBodyPayload.error.message, "string");
});
