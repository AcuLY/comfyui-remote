import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("asset pages are split by resource type with explicit route boundaries", () => {
  const roadmapSource = readSource("docs/superpowers/plans/2026-07-06-whole-repo-refactor-roadmap.md");
  const modelsPageSource = readSource("src/app/assets/models/page.tsx");
  const lorasPageSource = readSource("src/app/assets/loras/page.tsx");
  const presetsPageSource = readSource("src/app/assets/presets/page.tsx");
  const presetGroupPageSource = readSource("src/app/assets/preset-groups/[groupId]/page.tsx");
  const templatesPageSource = readSource("src/app/assets/templates/page.tsx");

  assert.match(roadmapSource, /### Asset Page Boundary Map/);
  for (const surface of [
    "Model files",
    "LoRA files",
    "Preset library",
    "Preset groups",
    "Templates",
  ]) {
    assert.match(roadmapSource, new RegExp(`\\| ${surface} \\|`), `${surface} should have a boundary row`);
  }

  assert.match(modelsPageSource, /modelKindFromSearchParam/);
  assert.match(modelsPageSource, /modelPathFromSearchParam/);
  assert.match(modelsPageSource, /<ModelFileManager initialKind=\{initialKind\} initialPath=\{initialPath\}/);

  assert.match(lorasPageSource, /redirect\("\/assets\/models"\)/);
  assert.doesNotMatch(lorasPageSource, /LoraFileManager/);

  assert.match(presetsPageSource, /getPresetCategoriesWithPresets/);
  assert.match(presetsPageSource, /<PresetManager initialCategories=\{categories\}/);

  assert.match(presetGroupPageSource, /getPresetGroupEditData/);
  assert.match(presetGroupPageSource, /<PresetGroupEditClient/);

  assert.match(templatesPageSource, /listProjectTemplates/);
  assert.match(templatesPageSource, /<TemplatesListClient templates=\{templates\}/);
});
