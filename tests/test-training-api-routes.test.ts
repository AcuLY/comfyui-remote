import assert from "node:assert/strict";
import test from "node:test";

async function listProjects() {
  const { GET } = await import("../src/app/api/training/projects/route");
  const response = await GET(new Request("http://localhost/api/training/projects"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.data));
  assert.ok(payload.data.length > 0);

  return payload.data as Array<{ id: string }>;
}

test("GET /api/training/projects lists training projects", async () => {
  const projects = await listProjects();
  assert.equal(typeof projects[0]?.id, "string");
});

test("GET /api/training/projects/:projectId returns one project detail", async () => {
  const { GET } = await import("../src/app/api/training/projects/[projectId]/route");
  const projects = await listProjects();
  const projectId = projects[0].id;

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
  const revisionsRoute = await import("../src/app/api/training/projects/[projectId]/dataset-revisions/route");
  const trainingRunsRoute = await import("../src/app/api/training/projects/[projectId]/training-runs/route");
  const generationTasksRoute = await import("../src/app/api/training/projects/[projectId]/generation-tasks/route");
  const projects = await listProjects();
  const projectId = projects[0].id;

  const params = { params: Promise.resolve({ projectId }) };
  const [sectionsResponse, resultsResponse, revisionsResponse, trainingRunsResponse, generationTasksResponse] = await Promise.all([
    sectionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/sections`), params),
    resultsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/image-results`), params),
    revisionsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/dataset-revisions`), params),
    trainingRunsRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/training-runs`), params),
    generationTasksRoute.GET(new Request(`http://localhost/api/training/projects/${projectId}/generation-tasks`), params),
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
  assert.ok(trainingRunsPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "training" && run.projectId === projectId));
  assert.ok(generationTasksPayload.data.every((run: { kind: string; projectId: string }) => run.kind === "generation" && run.projectId === projectId));
});

test("training project section route reads and updates a saved section through /api/training", async () => {
  const sectionsRoute = await import("../src/app/api/training/projects/[projectId]/sections/route");
  const sectionDetailRoute = await import("../src/app/api/training/projects/[projectId]/sections/[sectionId]/route");
  const projects = await listProjects();
  const projectId = projects[0].id;
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
  const runsRoute = await import("../src/app/api/training/runs/route");
  const { GET } = await import("../src/app/api/training/training-runs/[trainingRunId]/route");
  const runsResponse = await runsRoute.GET(new Request("http://localhost/api/training/runs?kind=training"));
  const runsPayload = await runsResponse.json();
  const trainingRunId = runsPayload.data[0].id;

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

test("GET /api/training/generation-tasks/:taskId returns generation task detail", async () => {
  const runsRoute = await import("../src/app/api/training/runs/route");
  const { GET } = await import("../src/app/api/training/generation-tasks/[taskId]/route");
  const runsResponse = await runsRoute.GET(new Request("http://localhost/api/training/runs?kind=generation"));
  const runsPayload = await runsResponse.json();
  const taskId = runsPayload.data[0].id;

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

  const deleteResponse = await presetDetailRoute.DELETE(
    new Request(`http://localhost/api/training/presets/${presetId}`, { method: "DELETE" }),
    detailParams,
  );
  const deletePayload = await deleteResponse.json();

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletePayload.ok, true);
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
  const createTrainingPresetRoute = await import("../src/app/api/training/presets/route");
  const updateTrainingPresetRoute = await import("../src/app/api/training/presets/[presetId]/route");
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
  const missingTemplateParams = { params: Promise.resolve({ templateId: "missing-template" }) };
  const missingTemplateSectionParams = { params: Promise.resolve({ templateId: "missing-template", sectionId: "missing-section" }) };

  const [createResponse, updateResponse, archiveResponse, restoreResponse, updateProjectSectionResponse, createPresetResponse, updatePresetResponse, createTemplateResponse, updateTemplateResponse, updateTemplateSectionResponse, freezeResponse, enqueueTrainingResponse, enqueueSectionResponse, cancelResponse] = await Promise.all([
    createProjectRoute.POST(new Request("http://localhost/api/training/projects", { method: "POST", body: "{}" })),
    updateProjectRoute.PATCH(new Request("http://localhost/api/training/projects/missing-project", { method: "PATCH", body: "{}" }), missingProjectParams),
    archiveProjectRoute.POST(new Request("http://localhost/api/training/projects/missing-project/archive", { method: "POST" }), missingProjectParams),
    restoreProjectRoute.POST(new Request("http://localhost/api/training/projects/missing-project/restore", { method: "POST" }), missingProjectParams),
    updateProjectSectionRoute.PATCH(new Request("http://localhost/api/training/projects/missing-project/sections/missing-section", { method: "PATCH", body: "{}" }), missingProjectSectionParams),
    createTrainingPresetRoute.POST(new Request("http://localhost/api/training/presets", { method: "POST", body: "{}" })),
    updateTrainingPresetRoute.PATCH(new Request("http://localhost/api/training/presets/missing-preset", { method: "PATCH", body: "{}" }), missingPresetParams),
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
    createPresetResponse.json(),
    updatePresetResponse.json(),
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
  assert.ok(createPresetResponse.status >= 400);
  assert.equal(payloads[5].ok, false);
  assert.ok(updatePresetResponse.status >= 400);
  assert.equal(payloads[6].ok, false);
  assert.ok(createTemplateResponse.status >= 400);
  assert.equal(payloads[7].ok, false);
  assert.ok(updateTemplateResponse.status >= 400);
  assert.equal(payloads[8].ok, false);
  assert.ok(updateTemplateSectionResponse.status >= 400);
  assert.equal(payloads[9].ok, false);
  assert.ok(freezeResponse.status >= 400);
  assert.equal(payloads[10].ok, false);
  assert.ok(enqueueTrainingResponse.status >= 400);
  assert.equal(payloads[11].ok, false);
  assert.ok(enqueueSectionResponse.status >= 400);
  assert.equal(payloads[12].ok, false);
  assert.ok(cancelResponse.status >= 400);
  assert.equal(payloads[13].ok, false);
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
