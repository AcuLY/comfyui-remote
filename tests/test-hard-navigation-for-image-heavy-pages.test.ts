import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

function assertAllHrefsUseHardNavigation(path: string, hrefNeedle: string) {
  const source = readSource(path);
  let index = -1;
  let count = 0;

  while ((index = source.indexOf(hrefNeedle, index + 1)) !== -1) {
    count += 1;
    const tagStart = source.lastIndexOf("<", index);
    assert.notEqual(tagStart, -1, `${path} should have a tag before ${hrefNeedle}`);
    const openingTag = source.slice(tagStart, Math.min(source.length, tagStart + 80));
    assert.match(
      openingTag,
      /<HardNavigationLink\b/,
      `${path} should use HardNavigationLink for ${hrefNeedle}`,
    );
  }

  assert.ok(count > 0, `${path} should contain ${hrefNeedle}`);
}

test("image-heavy production pages use document navigation for primary route exits", () => {
  const hardLinkTargets = [
    ["src/app/projects/projects-client.tsx", "href={`/projects/${project.id}`}"],
    ["src/app/projects/[projectId]/project-detail-client.tsx", "href={`/projects/${projectId}/results`}"],
    ["src/app/projects/[projectId]/project-detail-client.tsx", "href={`/projects/${projectId}/batch-create`}"],
    ["src/app/projects/[projectId]/section-cards.tsx", "href={`/projects/${projectId}/sections/${section.id}`}"],
    ["src/app/projects/[projectId]/section-cards.tsx", "href={`/projects/${projectId}/sections/${section.id}/results`}"],
    ["src/app/projects/[projectId]/section-cards.tsx", "href={section.latestRunId ? `/queue/${section.latestRunId}` : \"#\"}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/page.tsx", "href={returnHref}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/page.tsx", "href={`/projects/${projectId}/sections/${sectionId}/results`}"],
    ["src/app/projects/[projectId]/results/project-results-client.tsx", "href={`/projects/${project.id}`}"],
    ["src/app/projects/[projectId]/results/project-results-client.tsx", "href={`/projects/${projectId}/sections/${section.id}/results`}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx", "href={returnHref}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx", "href={`/projects/${projectId}/sections/${sectionId}`}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx", "href={`/projects/${projectId}/results`}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx", "href={resolvedNextPendingSectionHref}"],
    ["src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx", "href={`/queue/${run.id}`}"],
    ["src/app/queue/queue-page-client.tsx", "href={`/queue/${run.id}`}"],
    ["src/app/queue/[runId]/page.tsx", "href={`/queue#run-${runId}`}"],
    ["src/app/queue/[runId]/page.tsx", "href={`/projects/${group.projectId}/sections/${group.projectSectionId}`}"],
    ["src/app/queue/[runId]/page.tsx", "href={`/projects/${group.projectId}/sections/${group.projectSectionId}/results`}"],
    ["src/app/queue/[runId]/page.tsx", "href={`/queue/${prevId}`}"],
    ["src/app/queue/[runId]/page.tsx", "href={`/queue/${nextId}`}"],
  ] as const;

  for (const [path, hrefNeedle] of hardLinkTargets) {
    assertAllHrefsUseHardNavigation(path, hrefNeedle);
  }
});

test("shared neighbor navigation can opt into document navigation", () => {
  const source = readSource("src/components/neighbor-navigation.tsx");

  assert.match(source, /hardNavigation\?: boolean/, "NeighborNavigation should expose a hardNavigation option");
  assert.match(source, /HardNavigationLink/, "NeighborNavigation should render hard navigation links when requested");
});

test("section results page exposes next pending section navigation as a visible button", () => {
  const source = readSource("src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx");

  assert.match(
    source,
    /resolvedNextPendingSectionHref && \([\s\S]*<HardNavigationLink[\s\S]*href=\{resolvedNextPendingSectionHref\}[\s\S]*data-nav-next-pending[\s\S]*下一待审/,
    "the G shortcut target should also be rendered as a visible next-pending button",
  );
  assert.doesNotMatch(
    source,
    /data-nav-next-pending[\s\S]{0,160}className="hidden"/,
    "next pending navigation should not be hidden",
  );
});

test("queue review keyboard and completion navigation leave the current document", () => {
  const source = readSource("src/app/queue/[runId]/review-grid.tsx");

  assert.doesNotMatch(
    source,
    /router\.push\(`\/queue/,
    "queue review page should not soft-push to another image-heavy queue route",
  );
  assert.doesNotMatch(
    source,
    /router\.push\("\/queue/,
    "queue review page should not soft-push back to the image-heavy queue list",
  );
  assert.match(
    source,
    /window\.location\.assign/,
    "queue review page should use document navigation for route exits",
  );
});
