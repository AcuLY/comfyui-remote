import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("queue review detail card title includes the section name", () => {
  const source = readSource("src/app/queue/[runId]/page.tsx");

  assert.match(
    source,
    /<SectionCard title=\{`\$\{group\.title\}：\$\{group\.sectionName\}`\}/,
    "queue detail page should show the section name in the main review card title",
  );
});
