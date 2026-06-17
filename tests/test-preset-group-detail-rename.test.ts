import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const nextFunction = source.indexOf("\nexport async function ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

test("preset group rename invalidates the group detail route before refresh", () => {
  const source = readSource("src/lib/actions/preset-group.ts");
  const body = functionBody(source, "updatePresetGroup");

  assert.match(body, /revalidatePath\("\/assets\/presets"\)/, "rename should refresh the preset library");
  assert.match(
    body,
    /revalidatePath\(`\/assets\/preset-groups\/\$\{id\}`\)/,
    "rename should refresh the current group detail route so router.refresh reads the new name",
  );
});

test("preset group detail rename does not resubmit the group category id", () => {
  const source = readSource("src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx");
  const saveStart = source.indexOf("function saveGroup()");
  assert.notEqual(saveStart, -1, "group detail client should define saveGroup");
  const saveEnd = source.indexOf("\n  function removeGroup()", saveStart);
  assert.notEqual(saveEnd, -1, "saveGroup body should end before removeGroup");
  const saveBody = source.slice(saveStart, saveEnd);

  assert.match(saveBody, /await updatePresetGroup\(currentGroup\.id,\s*\{[\s\S]*name: name\.trim\(\)/, "rename should save the edited name");
  assert.doesNotMatch(saveBody, /\bcategoryId\b/, "rename should not send the preset-group category id through the ordinary preset update payload");
});
