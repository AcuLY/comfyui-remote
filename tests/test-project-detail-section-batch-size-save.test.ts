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

test("project detail controls import server actions from focused modules", () => {
  const runButton = readSource("src/app/projects/[projectId]/project-detail-actions.tsx");
  const sectionNameEditor = readSource("src/app/projects/[projectId]/sections/[sectionId]/section-name-editor.tsx");
  const editForm = readSource("src/app/projects/[projectId]/edit/project-edit-form.tsx");
  const censorButton = readSource("src/app/projects/[projectId]/censor-button.tsx");

  assert.match(runButton, /from "@\/lib\/actions\/run-execution";/);
  assert.match(sectionNameEditor, /from "@\/lib\/actions\/section";/);
  assert.match(editForm, /from "@\/lib\/actions\/project";/);
  assert.match(censorButton, /from "@\/lib\/actions\/censoring";/);
  for (const [label, source] of [
    ["run button", runButton],
    ["section name editor", sectionNameEditor],
    ["edit form", editForm],
    ["censor button", censorButton],
  ] as const) {
    assert.doesNotMatch(source, /from "@\/lib\/actions";/, `${label} should not import the full server-action barrel`);
  }
});

test("project detail sidebar imports server actions from focused modules", () => {
  const sidebar = readSource("src/app/projects/[projectId]/app-sidebar.tsx");

  assert.match(sidebar, /from "@\/lib\/actions\/run-execution";/);
  assert.match(sidebar, /from "@\/lib\/actions\/template-save";/);
  assert.doesNotMatch(sidebar, /from "@\/lib\/actions";/);
});

test("project detail folder controls import section folder actions from focused module", () => {
  const detailClient = readSource("src/app/projects/[projectId]/project-detail-client.tsx");

  assert.match(detailClient, /from "@\/lib\/actions\/section-folder";/);
  assert.doesNotMatch(detailClient, /from "@\/lib\/actions";/);
});

test("project detail section cards import server actions from focused modules", () => {
  const sectionCards = readSource("src/app/projects/[projectId]/section-cards.tsx");

  assert.match(sectionCards, /from "@\/lib\/actions\/section-folder";/);
  assert.match(sectionCards, /from "@\/lib\/actions\/section";/);
  assert.match(sectionCards, /from "@\/lib\/actions\/run-execution";/);
  assert.doesNotMatch(sectionCards, /from "@\/lib\/actions";/);
});

test("project detail section action controls import server actions from focused modules", () => {
  const sectionActions = readSource("src/app/projects/[projectId]/section-actions.tsx");
  const clearSectionsButton = readSource("src/app/projects/[projectId]/clear-sections-button.tsx");

  assert.match(sectionActions, /from "@\/lib\/actions\/section";/);
  assert.match(sectionActions, /from "@\/lib\/actions\/template-crud";/);
  assert.match(sectionActions, /from "@\/lib\/actions\/template-import";/);
  assert.match(clearSectionsButton, /from "@\/lib\/actions\/section";/);
  assert.doesNotMatch(sectionActions, /from "@\/lib\/actions";/);
  assert.doesNotMatch(clearSectionsButton, /from "@\/lib\/actions";/);
});

test("project detail batch create client imports section actions from focused module", () => {
  const batchCreateClient = readSource("src/app/projects/[projectId]/batch-create/batch-create-client.tsx");

  assert.match(batchCreateClient, /from "@\/lib\/actions\/section";/);
  assert.doesNotMatch(batchCreateClient, /from "@\/lib\/actions";/);
});

test("project section edit page imports server action contracts from focused modules", () => {
  const sectionEditPage = readSource("src/app/projects/[projectId]/sections/[sectionId]/page.tsx");

  assert.match(sectionEditPage, /from "@\/lib\/actions\/prompt-block";/);
  assert.match(sectionEditPage, /import\("@\/lib\/actions\/section"\)/);
  assert.doesNotMatch(sectionEditPage, /from "@\/lib\/actions";/);
  assert.doesNotMatch(sectionEditPage, /import\("@\/lib\/actions"\)/);
});
