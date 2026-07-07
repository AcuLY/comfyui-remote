import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sharedSkeletonPath = "src/app/projects/project-loading-skeletons.tsx";
const projectLoadingRoutes = [
  "src/app/projects/[projectId]/loading.tsx",
  "src/app/projects/[projectId]/results/loading.tsx",
  "src/app/projects/[projectId]/sections/[sectionId]/loading.tsx",
  "src/app/projects/[projectId]/sections/[sectionId]/results/loading.tsx",
];

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("project route loading states stay colocated but share skeleton primitives", () => {
  assert.ok(existsSync(sharedSkeletonPath), `${sharedSkeletonPath} should own shared project loading skeletons`);

  const sharedSource = readSource(sharedSkeletonPath);

  assert.match(sharedSource, /from "@\/components\/ui\/skeleton";/);
  assert.match(sharedSource, /export function ProjectLoadingActionBar/);
  assert.match(sharedSource, /export function ProjectLoadingBlock/);
  assert.match(sharedSource, /export function ProjectLoadingGrid/);
  assert.match(sharedSource, /export function ProjectLoadingSidebar/);

  for (const routePath of projectLoadingRoutes) {
    assert.ok(existsSync(routePath), `${routePath} should remain colocated with its route segment`);

    const routeSource = readSource(routePath);
    assert.match(
      routeSource,
      /from ["'](?:\.\.\/){1,4}project-loading-skeletons["'];/,
      `${routePath} should import shared project skeleton primitives`,
    );
    assert.match(routeSource, /export default function/);
    assert.doesNotMatch(
      routeSource,
      /animate-pulse|from "@\/components\/ui\/skeleton";/,
      `${routePath} should delegate primitive skeleton styling to the shared module`,
    );
  }
});
