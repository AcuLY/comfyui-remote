import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

const sectionPresetLinkFiles = [
  "src/components/section-editor.tsx",
  "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx",
];

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

function functionSource(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
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

function presetLinkBlock(source: string) {
  const blocks = source.match(/<Link\b[\s\S]*?<\/Link>/g) ?? [];
  const block = blocks.find((item) => item.includes("getPresetManagerHref(binding)"));
  assert.ok(block, "preset binding detail Link should exist");
  return block;
}

test("section preset binding links navigate to preset detail in the same tab", () => {
  for (const file of sectionPresetLinkFiles) {
    const source = readSource(file);
    const hrefFunction = functionSource(source, "getPresetManagerHref");
    const link = presetLinkBlock(source);

    assert.match(
      hrefFunction,
      /\/assets\/presets\/\$\{binding\.sourceId\}/,
      `${file} should link preset bindings to the preset detail route`,
    );
    assert.doesNotMatch(link, /target=["']_blank["']/, `${file} should navigate in the same tab`);
  }
});
