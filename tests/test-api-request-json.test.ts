import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";

import { failFromError, flatFail } from "../src/lib/api-response";
import { HttpRequestError, readJsonBody, readJsonObject, readOptionalJsonObject } from "../src/server/http/request-json";

function makeRequest(body?: string) {
  return new Request("http://localhost/api/test", {
    body,
    method: "POST",
  });
}

test("readOptionalJsonObject returns an empty object for empty request bodies", async () => {
  assert.deepEqual(await readOptionalJsonObject(makeRequest("")), {});
});

test("readOptionalJsonObject parses JSON objects and rejects invalid route bodies", async () => {
  assert.deepEqual(await readOptionalJsonObject(makeRequest('{"runIds":["run-1"],"batchId":"batch-1"}')), {
    batchId: "batch-1",
    runIds: ["run-1"],
  });

  await assert.rejects(
    () => readOptionalJsonObject(makeRequest("not-json")),
    (error) =>
      error instanceof HttpRequestError &&
      error.message === "Invalid JSON body" &&
      error.status === 400,
  );

  await assert.rejects(
    () => readOptionalJsonObject(makeRequest("[]")),
    (error) =>
      error instanceof HttpRequestError &&
      error.message === "Request body must be an object" &&
      error.status === 400,
  );
});

test("readJsonObject requires a valid JSON object body", async () => {
  assert.deepEqual(await readJsonObject(makeRequest('{"name":"folder"}')), {
    name: "folder",
  });

  await assert.rejects(
    () => readJsonObject(makeRequest("")),
    (error) =>
      error instanceof HttpRequestError &&
      error.message === "Invalid JSON body" &&
      error.status === 400,
  );

  await assert.rejects(
    () => readJsonObject(makeRequest("[1,2]")),
    (error) =>
      error instanceof HttpRequestError &&
      error.message === "Request body must be an object" &&
      error.status === 400,
  );
});

test("readJsonBody preserves non-object JSON while still normalizing invalid JSON errors", async () => {
  assert.deepEqual(await readJsonBody(makeRequest("[1,2]")), [1, 2]);

  await assert.rejects(
    () => readJsonBody(makeRequest("not-json")),
    (error) =>
      error instanceof HttpRequestError &&
      error.message === "Invalid JSON body" &&
      error.status === 400,
  );
});

test("failFromError preserves route parser status and details in the shared envelope", async () => {
  const response = failFromError(new HttpRequestError("Invalid JSON body", 422, { source: "request" }));

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: {
      details: { source: "request" },
      message: "Invalid JSON body",
    },
    ok: false,
  });
});

test("flatFail preserves legacy flat error responses for compatibility routes", async () => {
  const response = flatFail("Invalid token", 401);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid token",
  });
});

test("auth verify route keeps flat error compatibility and does not log tokens", async () => {
  const source = readFileSync("src/app/api/auth/verify/route.ts", "utf8");

  assert.match(source, /from ["']@\/server\/http\/request-json["']/, "auth route should import request JSON helpers");
  assert.match(source, /readJsonBody\(request\)/, "auth route should parse JSON through readJsonBody");
  assert.match(source, /\bflatFail\(/, "auth route should use flatFail for legacy flat errors");
  assert.doesNotMatch(source, /NextResponse\.json\(\{\s*error:/, "auth route should not format flat errors locally");
  assert.doesNotMatch(source, /console\./, "auth route should not log token values");

  const previousAuthToken = process.env.AUTH_TOKEN;
  process.env.AUTH_TOKEN = "test-auth-token";

  try {
    const route = await import("../src/app/api/auth/verify/route");

    const invalidJson = await route.POST(new NextRequest("http://localhost/api/auth/verify", {
      body: "not-json",
      method: "POST",
    }));
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), { error: "Invalid JSON body" });

    const arrayBody = await route.POST(new NextRequest("http://localhost/api/auth/verify", {
      body: "[]",
      method: "POST",
    }));
    assert.equal(arrayBody.status, 400);
    assert.deepEqual(await arrayBody.json(), { error: "token field is required" });

    const invalidToken = await route.POST(new NextRequest("http://localhost/api/auth/verify", {
      body: JSON.stringify({ token: "wrong-token" }),
      method: "POST",
    }));
    assert.equal(invalidToken.status, 401);
    assert.deepEqual(await invalidToken.json(), { error: "Invalid token" });

    const success = await route.POST(new NextRequest("http://localhost/api/auth/verify", {
      body: JSON.stringify({ token: process.env.AUTH_TOKEN }),
      method: "POST",
    }));
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { ok: true });
    assert.match(success.headers.get("set-cookie") ?? "", /auth_token=/);
  } finally {
    if (previousAuthToken === undefined) {
      delete process.env.AUTH_TOKEN;
    } else {
      process.env.AUTH_TOKEN = previousAuthToken;
    }
  }
});

test("resume-paused route uses the shared optional JSON parser", () => {
  const source = readFileSync("src/app/api/queue/resume-paused/route.ts", "utf8");

  assert.match(source, /from ["']@\/server\/http\/request-json["']/);
  assert.doesNotMatch(source, /function readOptionalJsonBody/);
  assert.doesNotMatch(source, /JSON\.parse\(text\)/);
});

test("low-risk required-body routes use the shared JSON parser", () => {
  for (const routePath of [
    "src/app/api/templates/route.ts",
    "src/app/api/templates/[templateId]/route.ts",
    "src/app/api/preset-library/folders/route.ts",
    "src/app/api/preset-library/folders/[folderId]/move/route.ts",
    "src/app/api/projects/[projectId]/save-as-template/route.ts",
    "src/app/api/image-review/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /from ["']@\/server\/http\/request-json["']/, `${routePath} should import request JSON helpers`);
    assert.match(source, /readJsonObject\(request\)/, `${routePath} should parse through readJsonObject`);
    assert.doesNotMatch(source, /await request\.json\(\)/, `${routePath} should not parse JSON directly`);
  }
});

test("route-handler template adopters use shared caught-error mapping", () => {
  for (const routePath of [
    "src/app/api/templates/route.ts",
    "src/app/api/templates/[templateId]/route.ts",
    "src/app/api/preset-library/folders/route.ts",
    "src/app/api/preset-library/folders/[folderId]/move/route.ts",
    "src/app/api/projects/[projectId]/save-as-template/route.ts",
    "src/app/api/queue/resume-paused/route.ts",
    "src/app/api/image-review/route.ts",
    "src/app/api/projects/[projectId]/run/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/run/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route.ts",
    "src/app/api/projects/[projectId]/apply-param/route.ts",
    "src/app/api/projects/[projectId]/preset-replacements/route.ts",
    "src/app/api/projects/[projectId]/sections/batch-delete/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /from ["']@\/lib\/api-response["']/, `${routePath} should import response helpers`);
    assert.match(source, /\bfailFromError\(/, `${routePath} should use failFromError for caught errors`);
    assert.doesNotMatch(source, /instanceof HttpRequestError/, `${routePath} should not map parser errors locally`);
  }
});

test("generation project run routes use shared optional JSON parsing", () => {
  for (const routePath of [
    "src/app/api/projects/[projectId]/run/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/run/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /from ["']@\/server\/http\/request-json["']/, `${routePath} should import request JSON helpers`);
    assert.match(source, /readOptionalJsonObject\(request\)/, `${routePath} should parse through readOptionalJsonObject`);
    assert.match(source, /\bfailFromError\(/, `${routePath} should map parser errors through failFromError`);
    assert.doesNotMatch(source, /await request\.json\(\)/, `${routePath} should not parse JSON directly`);
  }
});

test("generation project mutations use shared raw JSON parsing", () => {
  for (const routePath of [
    "src/app/api/projects/route.ts",
    "src/app/api/projects/[projectId]/route.ts",
    "src/app/api/project-folders/route.ts",
    "src/app/api/project-folders/[folderId]/route.ts",
    "src/app/api/project-folders/move/route.ts",
    "src/app/api/project-folders/reorder/route.ts",
    "src/app/api/projects/[projectId]/sections/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/route.ts",
    "src/app/api/projects/[projectId]/sections/reorder/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route.ts",
    "src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route.ts",
    "src/app/api/projects/[projectId]/apply-param/route.ts",
    "src/app/api/projects/[projectId]/preset-replacements/route.ts",
    "src/app/api/projects/[projectId]/sections/batch-delete/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /from ["']@\/server\/http\/request-json["']/, `${routePath} should import request JSON helpers`);
    assert.match(source, /readJsonBody\(request\)/, `${routePath} should parse through readJsonBody`);
    assert.match(source, /\bfailFromError\(/, `${routePath} should map parser errors through failFromError`);
    assert.doesNotMatch(source, /await request\.json\(\)/, `${routePath} should not parse JSON directly`);
  }
});

test("generation section batch delete route delegates destructive checks to project service", () => {
  const source = readFileSync("src/app/api/projects/[projectId]/sections/batch-delete/route.ts", "utf8");

  assert.match(source, /from ["']@\/server\/services\/project-service["']/, "batch delete route should import project-service");
  assert.match(source, /\bdeleteProjectSections\(/, "batch delete route should delegate deletion through project-service");
  assert.doesNotMatch(source, /from ["']@\/lib\/prisma["']/, "batch delete route should not import prisma directly");
  assert.doesNotMatch(source, /projectSection\.findMany/, "batch delete route should not build section ownership queries");
});

test("image-review route maps invalid JSON through the shared error envelope", async () => {
  const route = await import("../src/app/api/image-review/route");

  const response = await route.POST(makeRequest("not-json"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      message: "Invalid JSON body",
    },
    ok: false,
  });
});

test("generation project mutations preserve invalid JSON response envelope", async () => {
  const projectsRoute = await import("../src/app/api/projects/route");
  const projectDetailRoute = await import("../src/app/api/projects/[projectId]/route");
  const projectFoldersRoute = await import("../src/app/api/project-folders/route");
  const projectFolderDetailRoute = await import("../src/app/api/project-folders/[folderId]/route");
  const projectFolderMoveRoute = await import("../src/app/api/project-folders/move/route");
  const projectFolderReorderRoute = await import("../src/app/api/project-folders/reorder/route");
  const projectSectionsRoute = await import("../src/app/api/projects/[projectId]/sections/route");
  const projectSectionDetailRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/route");
  const projectSectionsReorderRoute = await import("../src/app/api/projects/[projectId]/sections/reorder/route");
  const projectRunRoute = await import("../src/app/api/projects/[projectId]/run/route");
  const projectSectionRunRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/run/route");
  const projectSectionBlocksRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route");
  const projectSectionBlockDetailRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route");
  const projectSectionImportPresetRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route");
  const projectSectionSwitchVariantRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route");
  const projectSectionCreateFromTemplateRoute = await import("../src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route");
  const projectApplyParamRoute = await import("../src/app/api/projects/[projectId]/apply-param/route");
  const projectPresetReplacementsRoute = await import("../src/app/api/projects/[projectId]/preset-replacements/route");
  const projectSectionsBatchDeleteRoute = await import("../src/app/api/projects/[projectId]/sections/batch-delete/route");

  for (const response of [
    await projectsRoute.POST(makeRequest("not-json")),
    await projectDetailRoute.PATCH(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectFoldersRoute.POST(makeRequest("not-json")),
    await projectFolderDetailRoute.PATCH(makeRequest("not-json"), {
      params: Promise.resolve({ folderId: "folder-1" }),
    }),
    await projectFolderMoveRoute.POST(makeRequest("not-json")),
    await projectFolderReorderRoute.POST(makeRequest("not-json")),
    await projectSectionsRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectSectionDetailRoute.PATCH(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionsReorderRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectRunRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectSectionRunRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionBlocksRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionBlockDetailRoute.PATCH(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1", blockId: "block-1" }),
    }),
    await projectSectionImportPresetRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionImportPresetRoute.DELETE(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionSwitchVariantRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectSectionCreateFromTemplateRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1", sectionId: "section-1" }),
    }),
    await projectApplyParamRoute.POST(makeRequest("not-json") as NextRequest, {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectPresetReplacementsRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
    await projectSectionsBatchDeleteRoute.POST(makeRequest("not-json"), {
      params: Promise.resolve({ projectId: "project-1" }),
    }),
  ]) {
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        message: "Invalid JSON body",
      },
      ok: false,
    });
  }
});

test("resume-paused route maps invalid JSON to the shared error envelope", async () => {
  const route = await import("../src/app/api/queue/resume-paused/route");

  const response = await route.POST(makeRequest("not-json"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      message: "Invalid JSON body",
    },
    ok: false,
  });
});
