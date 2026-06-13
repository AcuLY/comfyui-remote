import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("workflow download menu exposes original and debug workflow options", () => {
  const menu = readSource("src/components/workflow-download-menu.tsx");
  const sectionPage = readSource("src/app/projects/[projectId]/sections/[sectionId]/page.tsx");
  const runPage = readSource("src/app/queue/[runId]/page.tsx");

  assert.match(menu, /originalHref/);
  assert.match(menu, /debugHref/);
  assert.match(menu, /variant=debug/);
  assert.match(menu, /原始工作流/);
  assert.match(menu, /调试工作流/);
  assert.match(sectionPage, /WorkflowDownloadMenu/);
  assert.match(runPage, /WorkflowDownloadMenu/);
});

test("workflow download routes select debug variant from the request URL", () => {
  const sectionRoute = readSource("src/app/api/projects/[projectId]/section-workflow/[sectionId]/route.ts");
  const runRoute = readSource("src/app/api/runs/[runId]/workflow/route.ts");

  assert.match(sectionRoute, /getWorkflowDownloadVariant/);
  assert.match(sectionRoute, /buildWorkflowDownloadPayload/);
  assert.match(runRoute, /getWorkflowDownloadVariant/);
  assert.match(runRoute, /buildWorkflowDownloadPayload/);
});
