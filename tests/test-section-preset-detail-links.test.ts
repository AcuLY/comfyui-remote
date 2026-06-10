import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

const projectSectionEditorFile = "src/components/section-editor.tsx";
const templateSectionEditorFile = "src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx";

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

test("project section preset group member rows split card and member preset links in the same tab", () => {
  const source = readSource(projectSectionEditorFile);

  assert.match(
    source,
    /const cardHref = getSectionPresetRowCardHref\(row,\s*libraryV2\)/,
    "member row card clicks should use the row-level preset group target",
  );
  assert.match(
    source,
    /const memberPresetHref = getSectionPresetMemberPresetHref\(row,\s*libraryV2\)/,
    "member detail buttons should use the row-level member preset target",
  );
  assert.match(
    source,
    /\{cardHref \? \(\s*<Link[\s\S]*?href=\{cardHref\}/,
    "preset group member card content should link to the preset group detail page",
  );
  assert.match(
    source,
    /\{memberPresetHref && \(\s*<Link[\s\S]*?href=\{memberPresetHref\}/,
    "only preset group member rows should render a separate member preset detail button",
  );
  assert.doesNotMatch(
    source,
    /\(row\.sourceId \|\| binding\.presetGroupId\)\s*&&\s*\(\s*<Link/,
    "ordinary preset rows should not keep the old detail jump button condition",
  );
  assert.doesNotMatch(source, /target=["']_blank["']/, "project section links should navigate in the same tab");
});

test("template section preset binding detail links still use the shared manager target in the same tab", () => {
  const source = readSource(templateSectionEditorFile);
  const hrefFunction = functionSource(source, "getPresetManagerHref");
  const link = presetLinkBlock(source);

  assert.match(
    hrefFunction,
    /getSectionPresetManagerHref\(binding,\s*library\)/,
    `${templateSectionEditorFile} should delegate preset binding links to the shared preset/group route helper`,
  );
  assert.match(
    source,
    /binding\.sourceId\s*\|\|\s*binding\.presetGroupId/,
    `${templateSectionEditorFile} should show the detail link for preset group bindings as well as preset bindings`,
  );
  assert.doesNotMatch(link, /target=["']_blank["']/, `${templateSectionEditorFile} should navigate in the same tab`);
});
