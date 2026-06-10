import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("queue review page displays the section number and name", () => {
  const typeSource = readSource("src/lib/types.ts");
  const repositorySource = readSource("src/server/repositories/queue-data-repository.ts");
  const pageSource = readSource("src/app/queue/[runId]/page.tsx");

  assert.match(
    typeSource,
    /sectionSortOrder: number;/,
    "ReviewGroup should carry the section sort order",
  );
  assert.match(
    repositorySource,
    /sectionSortOrder: run\.projectSection\.sortOrder/,
    "review group repository should expose the run section sort order",
  );
  assert.match(
    pageSource,
    /const sectionDisplayName = `第 \$\{group\.sectionSortOrder \+ 1\} 小节 · \$\{group\.sectionName\}`;/,
    "queue review page should format a 1-based section number with the section name",
  );
  assert.match(
    pageSource,
    /<SectionCard title=\{group\.title\} subtitle=\{`\$\{sectionDisplayName\} · \$\{group\.presetNames\.join\(" · "\) \|\| "无预制"\} · \$\{group\.createdAt\}`\}>/,
    "queue review page should show the formatted section display in the review card subtitle",
  );
});
