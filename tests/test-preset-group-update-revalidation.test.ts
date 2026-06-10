import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function exportedFunctionSource(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} should be exported`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${name} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${name} body should close`);
}

test("updatePresetGroup revalidates both the preset library and edited group detail page", () => {
  const source = readSource("src/lib/actions/preset-group.ts");
  const body = exportedFunctionSource(source, "updatePresetGroup");

  assert.match(
    body,
    /revalidatePath\("\/assets\/presets"\)/,
    "group metadata edits should refresh the preset library",
  );
  assert.match(
    body,
    /revalidatePath\(`\/assets\/preset-groups\/\$\{id\}`\)/,
    "group metadata edits should refresh the open group detail route",
  );
});
