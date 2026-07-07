import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sharedPath = "src/app/projects/project-section-card-components.tsx";
const routePath = "src/app/projects/[projectId]/section-cards.tsx";
const routeSource = readFileSync(routePath, "utf8");

test("project section card rendering lives in shared typed project components", () => {
  assert.ok(existsSync(sharedPath), `${sharedPath} should own shared project section card rendering`);

  const sharedSource = readFileSync(sharedPath, "utf8");
  assert.match(sharedSource, /export type ProjectSectionCardData = \{/);
  assert.match(sharedSource, /export function ProjectSectionCompactCard/);
  assert.match(sharedSource, /export function ProjectSectionExpandedCard/);
  assert.doesNotMatch(sharedSource, /@\/lib\/actions|\.\/project-detail-actions|\.\/section-actions/);

  assert.match(routeSource, /from "\.\.\/project-section-card-components"/);
  assert.doesNotMatch(routeSource, /function SortableCompactCard/);
  assert.doesNotMatch(routeSource, /function SortableSectionCard/);
});
