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

function presetLinkBlocks(source: string) {
  const blocks = source.match(/<Link\b[\s\S]*?<\/Link>/g) ?? [];
  return blocks.filter((item) => item.includes("detailHref"));
}

test("section preset cards expose same-tab detail links from the card body", () => {
  for (const file of sectionPresetLinkFiles) {
    const source = readSource(file);
    const hrefFunction = functionSource(source, "getPresetManagerHref");
    const links = presetLinkBlocks(source);

    assert.match(
      hrefFunction,
      /getSectionPresetManagerHref\([\s\S]*,\s*(?:libraryV2|library),?\s*\)/,
      `${file} should delegate preset binding links to the shared preset/group route helper`,
    );
    assert.match(source, /const detailHref = [^;]*getPresetManagerHref\((?:row|binding)\)/, `${file} should compute a per-card detail href`);
    assert.match(
      source,
      /(?:row|binding)\.sourceId\s*\|\|\s*binding\.presetGroupId/,
      `${file} should show the detail link for preset group bindings as well as preset bindings`,
    );
    assert.ok(links.length >= 1, `${file} should render a card-body detail Link`);
    assert.ok(links.some((link) => /href=\{detailHref\}/.test(link)), `${file} should link the card body to the detail href`);
    assert.ok(links.some((link) => /ExternalLink/.test(link)), `${file} should keep a visible detail icon link`);
    for (const link of links) {
      assert.doesNotMatch(link, /target=["']_blank["']/, `${file} should navigate in the same tab`);
      assert.doesNotMatch(link, /<button\b/, `${file} detail Links must not wrap action buttons`);
      assert.doesNotMatch(link, /<select\b/, `${file} detail Links must not wrap variant selectors`);
    }
  }
});
