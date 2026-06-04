import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("/api/images serves stored files without request-time compression", () => {
  const source = readSource("src/app/api/images/[...path]/route.ts");

  assert.doesNotMatch(source, /from\s+["']sharp["']/, "image route must not import sharp");
  assert.doesNotMatch(source, /\bsharp\s*\(/, "image route must not create a sharp pipeline");
  assert.doesNotMatch(source, /\.jpeg\s*\(/, "image route must not transcode to JPEG per request");
  assert.doesNotMatch(source, /searchParams\.get\(["']q["']\)/, "image route must not parse q");
  assert.doesNotMatch(source, /searchParams\.get\(["']w["']\)/, "image route must not parse w");
});

test("display repositories do not append resize or quality params to /api/images URLs", () => {
  const displayRepositories = [
    "src/server/repositories/trash-repository.ts",
    "src/server/repositories/project-view-repository/list-view.ts",
    "src/server/repositories/project-view-repository/detail-view.ts",
    "src/server/repositories/queue-data-repository.ts",
  ];

  for (const path of displayRepositories) {
    const source = readSource(path);

    assert.doesNotMatch(source, /[?&]w=\d+/, `${path} must not request image resizing`);
    assert.doesNotMatch(source, /[?&]q=\d+/, `${path} must not request image compression`);
    assert.doesNotMatch(source, /toImageUrl\([^)]*\)\s*\?\?\s*""\)\s*\+\s*["'][?&]/, `${path} must not append query params to image URLs`);
  }
});
