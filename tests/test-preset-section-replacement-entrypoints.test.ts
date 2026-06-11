import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("project detail page loads preset library and exposes replacement dialog", () => {
  const pageSource = readSource("src/app/projects/[projectId]/page.tsx");
  const clientSource = readSource("src/app/projects/[projectId]/project-detail-client.tsx");

  assert.match(pageSource, /getPresetLibraryV2/);
  assert.match(pageSource, /presetLibrary=\{presetLibrary\}/);
  assert.match(clientSource, /PresetSectionReplacementDialog/);
  assert.match(clientSource, /targetType="project"/);
  assert.match(clientSource, /library=\{presetLibrary\}/);
});

test("template edit page loads preset library and exposes replacement dialog in edit mode", () => {
  const pageSource = readSource("src/app/assets/templates/[templateId]/edit/page.tsx");
  const clientSource = readSource("src/app/assets/templates/template-form-client.tsx");

  assert.match(pageSource, /getPresetLibraryV2/);
  assert.match(pageSource, /presetLibrary=\{presetLibrary\}/);
  assert.match(clientSource, /PresetSectionReplacementDialog/);
  assert.match(clientSource, /targetType="template"/);
  assert.match(clientSource, /library=\{presetLibrary\}/);
});
