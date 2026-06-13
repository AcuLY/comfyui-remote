import assert from "node:assert/strict";
import test from "node:test";

test("GET /api/training/projects lists training projects", async () => {
  const { GET } = await import("../src/app/api/training/projects/route");

  const response = await GET(new Request("http://localhost/api/training/projects"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data));
  assert.ok(payload.data.length > 0);
  assert.equal(payload.data[0]?.id, "vela-neon");
});

test("GET /api/training/projects/:projectId returns one project detail", async () => {
  const { GET } = await import("../src/app/api/training/projects/[projectId]/route");

  const response = await GET(
    new Request("http://localhost/api/training/projects/vela-neon"),
    { params: Promise.resolve({ projectId: "vela-neon" }) },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, "vela-neon");
  assert.ok(Array.isArray(payload.data.sections));
  assert.ok(payload.data.sections.length > 0);
});

test("GET project-scoped training resources expose sections, results, dataset revisions, and scoped run lists", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const resultsRoute = await import("../src/app/api/training/projects/[projectId]/image-results/route");
  const revisionsRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const trainingRunsRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const generationTasksRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");

  const params = { params: Promise.resolve({ projectId: "vela-neon" }) };
  const [sectionsResponse, resultsResponse, revisionsResponse, trainingRunsResponse, generationTasksResponse] = await Promise.all([
    sectionsRoute.GET(new Request("http://localhost/api/training/projects/vela-neon/sections"), params),
    resultsRoute.GET(new Request("http://localhost/api/training/projects/vela-neon/image-results"), params),
    revisionsRoute.GET(new Request("http://localhost/api/training/projects/vela-neon/dataset-revisions"), params),
    trainingRunsRoute.GET(new Request("http://localhost/api/training/projects/vela-neon/training-runs"), params),
    generationTasksRoute.GET(new Request("http://localhost/api/training/projects/vela-neon/generation-tasks"), params),
  ]);

  const [sectionsPayload, resultsPayload, revisionsPayload, trainingRunsPayload, generationTasksPayload] = await Promise.all([
    sectionsResponse.json(),
    resultsResponse.json(),
    revisionsResponse.json(),
    trainingRunsResponse.json(),
    generationTasksResponse.json(),
  ]);

  assert.equal(sectionsResponse.status, 200);
  assert.equal(resultsResponse.status, 200);
  assert.equal(revisionsResponse.status, 200);
  assert.equal(trainingRunsResponse.status, 200);
  assert.equal(generationTasksResponse.status, 200);

  assert.ok(Array.isArray(sectionsPayload.data));
  assert.ok(sectionsPayload.data.length > 0);
  assert.ok(Array.isArray(resultsPayload.data));
  assert.ok(resultsPayload.data.length > 0);
  assert.ok(Array.isArray(revisionsPayload.data));
  assert.ok(revisionsPayload.data.length > 0);
  assert.ok(trainingRunsPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "training" && run.projectId === "vela-neon"));
  assert.ok(generationTasksPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "generation" && run.projectId === "vela-neon"));
});

test("GET /api/training/runs filters the global training workspace by kind and status", async () => {
  const { GET } = await import("../src/app/api/training/runs/route");

  const response = await GET(new Request("http://localhost/api/training/runs?kind=generation&status=completed"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data));
  assert.ok(payload.data.length > 0);
  assert.ok(payload.data.every((run: { kind: string; status: string }) => run.kind === "generation" && run.status === "completed"));
});

test("GET /api/training/training-runs/:trainingRunId returns training run detail", async () => {
  const { GET } = await import("../src/app/api/training/training-runs/[trainingRunId]/route");

  const response = await GET(
    new Request("http://localhost/api/training/training-runs/train-vela-v5"),
    { params: Promise.resolve({ trainingRunId: "train-vela-v5" }) },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, "train-vela-v5");
  assert.equal(payload.data.kind, "training");
});

test("GET /api/training/generation-tasks/:taskId returns generation task detail", async () => {
  const { GET } = await import("../src/app/api/training/generation-tasks/[taskId]/route");

  const response = await GET(
    new Request("http://localhost/api/training/generation-tasks/gen-vela-dataset"),
    { params: Promise.resolve({ taskId: "gen-vela-dataset" }) },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, "gen-vela-dataset");
  assert.equal(payload.data.kind, "generation");
});

test("GET /api/training/presets and /api/training/templates expose training resource libraries", async () => {
  const presetsRoute = await import("../src/app/api/training/presets/route");
  const templatesRoute = await import("../src/app/api/training/templates/route");

  const [presetsResponse, templatesResponse] = await Promise.all([
    presetsRoute.GET(new Request("http://localhost/api/training/presets")),
    templatesRoute.GET(new Request("http://localhost/api/training/templates")),
  ]);
  const [presetsPayload, templatesPayload] = await Promise.all([
    presetsResponse.json(),
    templatesResponse.json(),
  ]);

  assert.equal(presetsResponse.status, 200);
  assert.equal(presetsPayload.ok, true);
  assert.ok(Array.isArray(presetsPayload.data));
  assert.ok(presetsPayload.data.some((preset: { id: string }) => preset.id === "rainy-street"));

  assert.equal(templatesResponse.status, 200);
  assert.equal(templatesPayload.ok, true);
  assert.ok(Array.isArray(templatesPayload.data));
  assert.ok(templatesPayload.data.some((template: { id: string }) => template.id === "portrait-soft"));
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
