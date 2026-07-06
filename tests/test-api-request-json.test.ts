import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HttpRequestError, readJsonObject, readOptionalJsonObject } from "../src/server/http/request-json";

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

test("resume-paused route uses the shared optional JSON parser", () => {
  const source = readFileSync("src/app/api/queue/resume-paused/route.ts", "utf8");

  assert.match(source, /from ["']@\/server\/http\/request-json["']/);
  assert.doesNotMatch(source, /function readOptionalJsonBody/);
  assert.doesNotMatch(source, /JSON\.parse\(text\)/);
});

test("low-risk required-body routes use the shared JSON parser", () => {
  for (const routePath of [
    "src/app/api/templates/route.ts",
    "src/app/api/preset-library/folders/route.ts",
    "src/app/api/projects/[projectId]/save-as-template/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");

    assert.match(source, /from ["']@\/server\/http\/request-json["']/, `${routePath} should import request JSON helpers`);
    assert.match(source, /readJsonObject\(request\)/, `${routePath} should parse through readJsonObject`);
    assert.doesNotMatch(source, /await request\.json\(\)/, `${routePath} should not parse JSON directly`);
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
