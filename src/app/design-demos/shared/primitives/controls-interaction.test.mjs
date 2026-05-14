import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const designDemosDir = resolve(testDir, "../..");
const familySamplesSource = readDemoSource("showcase/pages/family-samples.tsx");
const fieldSource = readDemoSource("shared/primitives/field/index.tsx");
const textAreaFieldSource = readDemoSource("shared/primitives/text-area-field/index.tsx");
const buttonCssSource = readDemoSource("shared/primitives/button/button.module.css");

function readDemoSource(relativePath) {
  return readFileSync(resolve(designDemosDir, relativePath), "utf8");
}

function functionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${functionName} body should close`);
}

function jsxTagSource(source, componentName, label) {
  const pattern = new RegExp(`<${componentName}\\b[\\s\\S]*?label="${label}"[\\s\\S]*?\\/>`);
  const match = source.match(pattern);
  assert.ok(match, `${componentName} with label "${label}" should exist`);
  return match[0];
}

test("ControlsSample uses real state for representative controls", () => {
  const controlsSampleSource = functionSource(familySamplesSource, "ControlsSample");

  assert.match(
    controlsSampleSource,
    /const\s+\[\s*selectedProject\s*,\s*setSelectedProject\s*\]\s*=\s*useState\(true\)/,
    "checkbox sample should keep local checked state",
  );
  assert.match(
    controlsSampleSource,
    /const\s+\[\s*projectName\s*,\s*setProjectName\s*\]\s*=\s*useState\("夏日人像合集"\)/,
    "Field sample should keep local text state",
  );
  assert.match(
    controlsSampleSource,
    /const\s+\[\s*promptText\s*,\s*setPromptText\s*\]\s*=\s*useState\("masterpiece, best quality, portrait, detailed light"\)/,
    "TextAreaField sample should keep local text state",
  );

  assert.match(jsxTagSource(controlsSampleSource, "Checkbox", "选择项目"), /checked=\{selectedProject\}/);
  assert.match(jsxTagSource(controlsSampleSource, "Checkbox", "选择项目"), /onCheckedChange=\{setSelectedProject\}/);
  assert.match(jsxTagSource(controlsSampleSource, "Field", "项目名称"), /value=\{projectName\}/);
  assert.match(jsxTagSource(controlsSampleSource, "Field", "项目名称"), /onChange=\{setProjectName\}/);
  assert.match(jsxTagSource(controlsSampleSource, "TextAreaField", "正向 Prompt"), /value=\{promptText\}/);
  assert.match(jsxTagSource(controlsSampleSource, "TextAreaField", "正向 Prompt"), /onChange=\{setPromptText\}/);
  assert.doesNotMatch(controlsSampleSource, /onCheckedChange=\{\(\)\s*=>\s*undefined\}/);
});

test("Field stays read-only by default and becomes controlled when onChange is supplied", () => {
  assert.match(fieldSource, /onChange\?:\s*\(value:\s*string\)\s*=>\s*void/);
  assert.match(fieldSource, /const\s+isInteractive\s*=\s*Boolean\(onChange\)/);
  assert.match(fieldSource, /value=\{value\}/);
  assert.match(fieldSource, /readOnly=\{!isInteractive\}/);
  assert.match(fieldSource, /aria-readonly=\{isInteractive\s*\?\s*undefined\s*:\s*"true"\}/);
  assert.match(fieldSource, /onBeforeInput=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(fieldSource, /onDrop=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(fieldSource, /onPaste=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(fieldSource, /onChange=\{\(event\)\s*=>\s*onChange\?\.\(event\.currentTarget\.value\)\}/);
  assert.doesNotMatch(fieldSource, /onChange=\{\(\)\s*=>\s*undefined\}/);
});

test("TextAreaField keeps controlled edits separate from read-only draft replacement", () => {
  assert.match(textAreaFieldSource, /onChange\?:\s*\(value:\s*string\)\s*=>\s*void/);
  assert.match(textAreaFieldSource, /const\s+isInteractive\s*=\s*Boolean\(onChange\)/);
  assert.match(textAreaFieldSource, /const\s+fieldValue\s*=\s*fieldValueState\.sourceValue\s*===\s*value\s*\?\s*fieldValueState\.draftValue\s*:\s*value/);
  assert.match(textAreaFieldSource, /const\s+displayValue\s*=\s*isInteractive\s*\?\s*value\s*:\s*fieldValue/);
  assert.match(textAreaFieldSource, /if\s*\(fieldValueState\.sourceValue\s*!==\s*value\)\s*\{\s*setFieldValue\(\{ sourceValue: value, draftValue: value \}\);\s*\}/);

  const updateValueSource = functionSource(textAreaFieldSource, "updateValue");
  assert.match(updateValueSource, /onChange\?\.\(nextValue\)/);
  assert.match(updateValueSource, /if\s*\(onChange\)\s*return/);
  assert.match(updateValueSource, /setFieldValue\(\{ sourceValue: value, draftValue: nextValue \}\)/);

  assert.match(textAreaFieldSource, /copyToClipboard\(displayValue\)/);
  assert.match(textAreaFieldSource, /updateValue\(clipboardValue\)/);
  assert.match(textAreaFieldSource, /value=\{displayValue\}/);
  assert.match(textAreaFieldSource, /readOnly=\{!isInteractive\}/);
  assert.match(textAreaFieldSource, /onBeforeInput=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(textAreaFieldSource, /onDrop=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(textAreaFieldSource, /onPaste=\{isInteractive\s*\?\s*undefined\s*:\s*preventReadonlyEdit\}/);
  assert.match(textAreaFieldSource, /onChange=\{\(event\)\s*=>\s*updateValue\(event\.currentTarget\.value\)\}/);
});

test("shared buttons have enabled tactile active feedback", () => {
  assert.match(
    buttonCssSource,
    /\.root\.root:not\(:disabled\):not\(\.pending\):active\s*\{[\s\S]*?transform:\s*translateY\(1px\)[^;]*;/,
    "enabled shared buttons and links should move down while active",
  );
  assert.match(
    buttonCssSource,
    /\.root\.root:not\(:disabled\):not\(\.pending\):active\s*\{[\s\S]*?box-shadow:\s*[\s\S]*?inset/,
    "enabled active feedback should include an inset pressed shadow",
  );
  assert.match(
    buttonCssSource,
    /\.root\.root\.iconOnly:not\(:disabled\):not\(\.pending\):active\s*\{/,
    "icon-only buttons should have explicit active feedback",
  );
});
