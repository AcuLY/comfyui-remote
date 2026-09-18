import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WORK_MODE_RESOURCE_TARGETS } from "../src/lib/work-mode-resources";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("asset pages are split by resource type with explicit route boundaries", () => {
  const modelsPageSource = readSource("src/app/assets/models/page.tsx");
  const lorasPageSource = readSource("src/app/assets/loras/page.tsx");
  const presetsPageSource = readSource("src/app/assets/presets/page.tsx");
  const presetGroupPageSource = readSource("src/app/assets/preset-groups/[groupId]/page.tsx");
  const templatesPageSource = readSource("src/app/assets/templates/page.tsx");

  assert.deepEqual(WORK_MODE_RESOURCE_TARGETS.generation.models, {
    key: "models",
    href: "/assets/models",
    label: "模型",
    owner: "shared",
    activePrefix: ["/assets/models", "/assets/loras"],
  });
  assert.deepEqual(WORK_MODE_RESOURCE_TARGETS.generation.presets.activePrefix, [
    "/assets/presets",
    "/assets/preset-groups",
  ]);
  assert.equal(WORK_MODE_RESOURCE_TARGETS.generation.templates.href, "/assets/templates");

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
