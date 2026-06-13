import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function functionSource(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf("{", source.indexOf("}) {", start));
  assert.notEqual(bodyStart, -1, `${name} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} body should close`);
}

function assertLinkBlocksExcludeControls(path: string, functionName: string) {
  const body = functionSource(readSource(path), functionName);
  const links = body.match(/<Link\b[\s\S]*?<\/Link>/g) ?? [];
  assert.ok(links.length > 0, `${functionName} should keep a detail Link`);

  for (const link of links) {
    assert.doesNotMatch(link, /<button\b/, `${functionName} detail Link must not wrap buttons`);
    assert.doesNotMatch(link, /GripVertical/, `${functionName} detail Link must not wrap the drag handle`);
  }
}

test("sortable preset and group cards keep drag buttons outside detail links", () => {
  assertLinkBlocksExcludeControls("src/app/assets/presets/preset-manager.tsx", "SortablePresetCard");
  assertLinkBlocksExcludeControls("src/app/assets/presets/sortable-group-card.tsx", "SortableGroupCard");
});

test("sortable group cards expose an edit action for existing groups", () => {
  const groupCardSource = readSource("src/app/assets/presets/sortable-group-card.tsx");
  const groupCardBody = functionSource(groupCardSource, "SortableGroupCard");
  const groupListSource = readSource("src/app/assets/presets/group-list.tsx");

  assert.match(groupCardSource, /Pencil/, "group card should import the edit icon");
  assert.match(groupCardBody, /onEdit/, "group card should accept an edit callback");
  assert.match(
    groupCardBody,
    /title="编辑预制组"[\s\S]*<Pencil/,
    "existing group cards should render a clear edit button before the inline editor",
  );
  assert.match(
    groupListSource,
    /onEdit=\{\(\) => setEditingGroupId\(editingGroupId === group\.id \? null : group\.id\)\}/,
    "group list should toggle the inline editor for the clicked group",
  );
});

test("creating a preset navigates to the new preset detail route", () => {
  const body = functionSource(readSource("src/app/assets/presets/preset-manager.tsx"), "PresetList");

  assert.match(
    body,
    /const newPreset = await createPreset\(data\);[\s\S]*for \(const v of variantDrafts\)[\s\S]*await createPresetVariant\([\s\S]*router\.push\(`\/assets\/presets\/\$\{newPreset\.id\}`\)/,
    "new preset creation should open the created preset detail page instead of refreshing back to the list",
  );
});
