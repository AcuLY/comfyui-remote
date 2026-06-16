import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(file: string) {
  return readFileSync(join(rootDir, file), "utf8");
}

test("project detail section cards pass projectId so batch size changes can save to section params", () => {
  const source = readSource("src/app/projects/[projectId]/section-cards.tsx");

  assert.match(
    source,
    /<SectionRunButton[\s\S]*projectId=\{projectId\}[\s\S]*sectionId=\{section\.id\}[\s\S]*defaultBatchSize=\{section\.batchSize\}/,
    "project detail section list run control should include projectId for PATCH section save",
  );
});

test("section run button persists batch size changes whenever a projectId is available", () => {
  const source = readSource("src/app/projects/[projectId]/project-detail-actions.tsx");
  const setter = source.match(/function setBatchSizeValue\(value: string\) \{[\s\S]*?\n  \}/);

  assert.notEqual(setter, null, "setBatchSizeValue exists");
  assert.match(
    setter![0],
    /if \(projectId\) scheduleBatchSizeSave\(value\);/,
    "batch size selection should debounce-save when the button is scoped to a project section",
  );
  assert.doesNotMatch(
    setter![0],
    /if \(!showBatchOverride\) scheduleBatchSizeSave\(value\);/,
    "saving should not be limited to section-detail mode",
  );
});
