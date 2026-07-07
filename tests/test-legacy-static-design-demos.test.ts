import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const legacyDocPath = "docs/ui/legacy-static-design-demos.md";

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("legacy static design demos have documented archival or superseded status", () => {
  assert.ok(existsSync(join(repoRoot, legacyDocPath)), `${legacyDocPath} should classify legacy static demo files`);

  const doc = readSource(legacyDocPath);
  const docsIndex = readSource("docs/index.md");
  const legacyFiles = [
    "design-demos/README.md",
    "design-demos/app.html",
    "design-demos/full-demo.html",
    "design-demos/index.html",
    "design-demos/router.js",
    "design-demos/design-system.css",
    "design-demos/components/components.css",
    "design-demos/v2-projects-page.html",
    "design-demos/v2-queue-page.html",
    "design-demos/v2-review-page.html",
    "design-demos/pages-checklist.md",
    "design-demos/style-audit-report.md",
  ];

  assert.match(doc, /\| file \| status \| replacement or current source \| production page informed \| next action \|/);
  assert.match(doc, /future archive directory[\s\S]*docs\/archive\/design-demos\//);
  assert.match(docsIndex, /docs\/ui\/legacy-static-design-demos\.md/);

  for (const file of legacyFiles) {
    assert.match(
      doc,
      new RegExp(`\\| \`${escapeRegExp(file)}\` \\| (archival|superseded by Next design-demo|retained active reference) \\|`),
      `${file} should have a legacy static demo status row`,
    );
  }

  const activeRows = doc
    .split("\n")
    .filter((line) => line.includes("| retained active reference |"));
  for (const row of activeRows) {
    assert.doesNotMatch(row, /\| none \|/, "active references must name the exact production page they inform");
  }
});

test("legacy todo tasks are carried forward before deleting todo.txt", () => {
  assert.equal(existsSync(join(repoRoot, "design-demos/todo.txt")), false, "stale design-demos/todo.txt should be removed after migration");

  const doc = readSource(legacyDocPath);
  for (const carriedTask of [
    "loading state page",
    "ImageThumbMedium",
    "ImagePreviewFrame",
    "ImagePreviewLarge",
    "DimensionsReadout",
    "SegmentControl",
    "/projects/:id/sections/:id",
  ]) {
    assert.match(doc, new RegExp(escapeRegExp(carriedTask)), `${carriedTask} should be carried into the maintained notes`);
  }
});
