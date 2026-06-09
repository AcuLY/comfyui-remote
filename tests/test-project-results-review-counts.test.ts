import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("project results data exposes kept image counts", () => {
  const source = readSource("src/server/repositories/project-view-repository/detail-view.ts");

  assert.match(source, /keptCount: number/, "ProjectResultsData sections should include keptCount");
  assert.match(source, /let keptCount = 0/, "getProjectResults should aggregate kept images per section");
  assert.match(source, /if \(img\.reviewStatus === "kept"\) keptCount \+= 1/, "keptCount should come from kept review status");
  assert.match(source, /keptCount,\s*\n\s*pendingCount,/m, "serialized project results should return keptCount");
});

test("project results page shows kept and pending counts instead of total image counts", () => {
  const source = readSource("src/app/projects/[projectId]/results/project-results-client.tsx");

  assert.doesNotMatch(source, /<span>\{section\.imageCount\} 张图片<\/span>/, "section summary should not display total image count");
  assert.doesNotMatch(source, /<span>\{totalImages\} 张图片<\/span>/, "project header should not display total image count");
  assert.match(source, /const totalKept = sections\.reduce\(/, "project header should aggregate kept counts");
  assert.match(source, /const totalPending = sections\.reduce\(/, "project header should aggregate pending counts");
  assert.match(source, /\{totalKept\} 保留/, "project header should show kept count");
  assert.match(source, /\{totalPending\} 待审/, "project header should show pending count");
  assert.match(source, /\{section\.keptCount\} 保留/, "section summary should show kept count");
  assert.match(source, /\{section\.pendingCount\} 待审/, "section summary should show pending count");
});
