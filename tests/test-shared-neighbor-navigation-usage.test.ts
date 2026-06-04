import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

const pageFiles = [
  "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx",
  "src/app/projects/[projectId]/app-sidebar.tsx",
  "src/app/projects/[projectId]/results/project-results-client.tsx",
  "src/app/projects/[projectId]/sections/[sectionId]/page.tsx",
  "src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx",
];

test("compact neighbor controls use the shared NeighborNavigation component", () => {
  for (const file of pageFiles) {
    const source = readFileSync(join(rootDir, file), "utf8");

    assert.match(
      source,
      /from ["']@\/components\/neighbor-navigation["']/,
      `${file} should import from the shared neighbor navigation module`,
    );
    assert.match(
      source,
      /<NeighborNavigation\b/,
      `${file} should render NeighborNavigation for compact previous/next controls`,
    );
  }
});
