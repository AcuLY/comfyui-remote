import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const roadmap = readFileSync(
  "docs/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md",
  "utf8",
);
const projectPagesSection = roadmap.match(
  /\*\*Project pages:\*\*[\s\S]*?\*\*Asset pages:\*\*/,
)?.[0] ?? "";

test("Phase 7 defines project page boundaries before splitting project UI modules", () => {
  assert.match(projectPagesSection, /### Project Page Boundary Map/);

  for (const [surface, requiredPaths] of [
    ["Project list", ["src/app/projects/page.tsx", "src/app/projects/projects-client.tsx"]],
    ["Create project", ["src/app/projects/new/page.tsx", "src/app/projects/new/from-existing/page.tsx"]],
    ["Project detail", ["src/app/projects/[projectId]/page.tsx", "src/app/projects/[projectId]/project-detail-client.tsx"]],
    ["Edit project", ["src/app/projects/[projectId]/edit/page.tsx", "src/app/projects/[projectId]/edit/project-edit-form.tsx"]],
    ["Batch create", ["src/app/projects/[projectId]/batch-create/page.tsx", "src/app/projects/[projectId]/batch-create/batch-create-client.tsx"]],
    ["Section edit", ["src/app/projects/[projectId]/sections/[sectionId]/page.tsx", "src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx"]],
    ["Section results", ["src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx", "src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx"]],
    ["Project results", ["src/app/projects/[projectId]/results/page.tsx", "src/app/projects/[projectId]/results/project-results-client.tsx"]],
  ] as const) {
    assert.match(projectPagesSection, new RegExp(`\\| ${surface} \\|`), `${surface} should have a boundary row`);
    for (const path of requiredPaths) {
      assert.match(projectPagesSection, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${surface} should name ${path}`);
    }
  }
});
