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

test("training write routes exist under /api/training and fail through HTTP contracts instead of missing handlers", async () => {
  const createProjectRoute = await import("../src/app/api/training/projects/route");
  const updateProjectRoute = await import("../src/app/api/training/projects/[projectId]/route");
  const archiveProjectRoute = await import("../src/app/api/training/projects/[projectId]/archive/route");
  const freezeDatasetRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const enqueueTrainingRunRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const enqueueSectionRunRoute = await import("../src/app/api/training/sections/[sectionId]/runs/route");
  const cancelTrainingRunRoute = await import("../src/app/api/training/training-runs/[trainingRunId]/cancel/route");

  const missingProjectParams = { params: Promise.resolve({ projectId: "missing-project" }) };
  const missingSectionParams = { params: Promise.resolve({ sectionId: "missing-section" }) };
  const missingRunParams = { params: Promise.resolve({ trainingRunId: "missing-run" }) };

  const [createResponse, updateResponse, archiveResponse, freezeResponse, enqueueTrainingResponse, enqueueSectionResponse, cancelResponse] = await Promise.all([
    createProjectRoute.POST(new Request("http://localhost/api/training/projects", { method: "POST", body: "{}" })),
    updateProjectRoute.PATCH(new Request("http://localhost/api/training/projects/missing-project", { method: "PATCH", body: "{}" }), missingProjectParams),
    archiveProjectRoute.POST(new Request("http://localhost/api/training/projects/missing-project/archive", { method: "POST" }), missingProjectParams),
    freezeDatasetRoute.POST(new Request("http://localhost/api/training/projects/missing-project/dataset-revisions", { method: "POST", body: "{}" }), missingProjectParams),
    enqueueTrainingRunRoute.POST(new Request("http://localhost/api/training/projects/missing-project/training-runs", { method: "POST", body: "{}" }), missingProjectParams),
    enqueueSectionRunRoute.POST(new Request("http://localhost/api/training/sections/missing-section/runs", { method: "POST", body: "{}" }), missingSectionParams),
    cancelTrainingRunRoute.POST(new Request("http://localhost/api/training/training-runs/missing-run/cancel", { method: "POST", body: "{}" }), missingRunParams),
  ]);

  const payloads = await Promise.all([
    createResponse.json(),
    updateResponse.json(),
    archiveResponse.json(),
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
  assert.ok(freezeResponse.status >= 400);
  assert.equal(payloads[3].ok, false);
  assert.ok(enqueueTrainingResponse.status >= 400);
  assert.equal(payloads[4].ok, false);
  assert.ok(enqueueSectionResponse.status >= 400);
  assert.equal(payloads[5].ok, false);
  assert.ok(cancelResponse.status >= 400);
  assert.equal(payloads[6].ok, false);
});

test("training asset and review routes exist under /api/training and return JSON error contracts", async () => {
  const profileRoute = await import("../src/app/api/training/projects/[projectId]/profile/route");
  const characterImagesRoute = await import("../src/app/api/training/projects/[projectId]/character-images/route");
  const addToResultsRoute = await import("../src/app/api/training/character-images/[imageId]/add-to-results/route");
  const reviewImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/review/route");
  const patchImageRoute = await import("../src/app/api/training/image-results/[imageResultId]/route");
  const imageCaptionRoute = await import("../src/app/api/training/image-results/[imageResultId]/caption/route");
  const bulkCaptionsRoute = await import("../src/app/api/training/projects/[projectId]/captions/generate/route");

  const missingProjectParams = { params: Promise.resolve({ projectId: "missing-project" }) };
  const missingImageParams = { params: Promise.resolve({ imageId: "missing-image" }) };
  const missingResultParams = { params: Promise.resolve({ imageResultId: "missing-result" }) };

  const [profileResponse, listResponse, uploadResponse, addToResultsResponse, reviewResponse, patchResponse, imageCaptionResponse, bulkCaptionsResponse] = await Promise.all([
    profileRoute.GET(new Request("http://localhost/api/training/projects/missing-project/profile"), missingProjectParams),
    characterImagesRoute.GET(new Request("http://localhost/api/training/projects/missing-project/character-images"), missingProjectParams),
    characterImagesRoute.POST(new Request("http://localhost/api/training/projects/missing-project/character-images", { method: "POST" }), missingProjectParams),
    addToResultsRoute.POST(new Request("http://localhost/api/training/character-images/missing-image/add-to-results", { method: "POST", body: "{}" }), missingImageParams),
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
