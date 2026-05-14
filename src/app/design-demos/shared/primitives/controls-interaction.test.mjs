import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const designDemosDir = resolve(testDir, "../..");
const fieldSource = readDemoSource("shared/primitives/field/index.tsx");
const textAreaFieldSource = readDemoSource("shared/primitives/text-area-field/index.tsx");
const floatingSelectSource = readDemoSource("shared/primitives/floating-select/index.tsx");
const selectLikeSource = readDemoSource("shared/primitives/select-like/index.tsx");
const checkboxSource = readDemoSource("shared/primitives/checkbox/index.tsx");
const buttonSource = readDemoSource("shared/primitives/button/index.tsx");

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

test("Field defaults editable and keeps local draft state without onChange", () => {
  assert.match(fieldSource, /^"use client";/);
  assert.match(fieldSource, /useState/);
  assert.match(fieldSource, /value\?:\s*string\s*\|\s*number/);
  assert.match(fieldSource, /defaultValue\?:\s*string\s*\|\s*number/);
  assert.match(fieldSource, /readOnly\?:\s*boolean/);
  assert.match(fieldSource, /disabled\?:\s*boolean/);
  assert.match(fieldSource, /const\s+isReadOnly\s*=\s*readOnly/);
  assert.match(fieldSource, /const\s+isControlled\s*=\s*value\s*!==\s*undefined\s*&&\s*onChange\s*!==\s*undefined/);
  assert.match(fieldSource, /if\s*\(fieldValue\.sourceValue\s*!==\s*resolvedValue\)\s*\{\s*setFieldValue\(\{ sourceValue: resolvedValue, draftValue: resolvedValue \}\);\s*\}/);
  assert.match(fieldSource, /draftValue/);
  assert.match(fieldSource, /setFieldValue\(\{ sourceValue: resolvedValue, draftValue: nextValue \}\)/);
  assert.match(fieldSource, /onChange\?\.\(nextValue\)/);
  assert.match(fieldSource, /value=\{displayValue\}/);
  assert.match(fieldSource, /readOnly=\{isReadOnly\}/);
  assert.match(fieldSource, /aria-readonly=\{isReadOnly\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(fieldSource, /disabled=\{disabled\}/);
  assert.match(fieldSource, /onBeforeInput=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(fieldSource, /onDrop=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(fieldSource, /onPaste=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.doesNotMatch(fieldSource, /const\s+isInteractive\s*=\s*Boolean\(onChange\)/);
  assert.doesNotMatch(fieldSource, /readOnly=\{!isInteractive\}/);
  assert.doesNotMatch(fieldSource, /aria-readonly=\{isInteractive\s*\?\s*undefined\s*:\s*"true"\}/);
});

test("TextAreaField defaults editable, supports readOnly, and keeps clipboard replace noninteractive when read-only", () => {
  assert.match(textAreaFieldSource, /^"use client";/);
  assert.match(textAreaFieldSource, /value\?:\s*string/);
  assert.match(textAreaFieldSource, /defaultValue\?:\s*string/);
  assert.match(textAreaFieldSource, /readOnly\?:\s*boolean/);
  assert.match(textAreaFieldSource, /disabled\?:\s*boolean/);
  assert.match(textAreaFieldSource, /const\s+isReadOnly\s*=\s*readOnly/);
  assert.match(textAreaFieldSource, /const\s+isControlled\s*=\s*value\s*!==\s*undefined\s*&&\s*onChange\s*!==\s*undefined/);
  assert.match(textAreaFieldSource, /if\s*\(fieldValueState\.sourceValue\s*!==\s*resolvedValue\)\s*\{\s*setFieldValue\(\{ sourceValue: resolvedValue, draftValue: resolvedValue \}\);\s*\}/);
  assert.match(textAreaFieldSource, /draftValue/);

  const updateValueSource = functionSource(textAreaFieldSource, "updateValue");
  assert.match(updateValueSource, /if\s*\(isReadOnly\s*\|\|\s*disabled\)\s*return/);
  assert.match(updateValueSource, /onChange\?\.\(nextValue\)/);
  assert.match(updateValueSource, /if\s*\(isControlled\)\s*return/);
  assert.match(updateValueSource, /setFieldValue\(\{ sourceValue: resolvedValue, draftValue: nextValue \}\)/);

  assert.match(textAreaFieldSource, /copyToClipboard\(displayValue\)/);
  assert.match(textAreaFieldSource, /disabled=\{isReadOnly\s*\|\|\s*disabled\}/);
  assert.match(textAreaFieldSource, /readOnly=\{isReadOnly\}/);
  assert.match(textAreaFieldSource, /aria-readonly=\{isReadOnly\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(textAreaFieldSource, /onBeforeInput=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(textAreaFieldSource, /onDrop=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(textAreaFieldSource, /onPaste=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.doesNotMatch(textAreaFieldSource, /const\s+isInteractive\s*=\s*Boolean\(onChange\)/);
  assert.doesNotMatch(textAreaFieldSource, /readOnly=\{!isInteractive\}/);
  assert.doesNotMatch(textAreaFieldSource, /aria-readonly=\{isInteractive\s*\?\s*undefined\s*:\s*"true"\}/);
});

test("SelectLike forwards controlled and uncontrolled selection props to FloatingSelect", () => {
  assert.match(selectLikeSource, /^"use client";/);
  assert.match(selectLikeSource, /value\?:\s*string/);
  assert.match(selectLikeSource, /defaultValue\?:\s*string/);
  assert.match(selectLikeSource, /readOnly\?:\s*boolean/);
  assert.match(selectLikeSource, /disabled\?:\s*boolean/);
  assert.match(selectLikeSource, /value=\{value\}/);
  assert.match(selectLikeSource, /defaultValue=\{defaultValue\}/);
  assert.match(selectLikeSource, /readOnly=\{readOnly\}/);
  assert.match(selectLikeSource, /disabled=\{disabled\}/);
  assert.match(selectLikeSource, /onChange=\{onChange\}/);
});

test("FloatingSelect supports local selection state, explicit readOnly, and keyboard listbox ARIA", () => {
  assert.match(floatingSelectSource, /^"use client";/);
  assert.match(floatingSelectSource, /value\?:\s*string/);
  assert.match(floatingSelectSource, /defaultValue\?:\s*string/);
  assert.match(floatingSelectSource, /readOnly\?:\s*boolean/);
  assert.match(floatingSelectSource, /const\s+isReadOnly\s*=\s*readOnly/);
  assert.match(floatingSelectSource, /const\s+isControlled\s*=\s*value\s*!==\s*undefined\s*&&\s*onChange\s*!==\s*undefined/);
  assert.match(floatingSelectSource, /selectedValue/);
  assert.match(floatingSelectSource, /setSelectedValue\(nextValue\)/);
  assert.match(floatingSelectSource, /aria-controls=\{listboxId\}/);
  assert.match(floatingSelectSource, /aria-activedescendant=\{open\s*\?\s*activeOptionId\s*:\s*undefined\}/);
  assert.match(floatingSelectSource, /aria-expanded=\{open\}/);
  assert.match(floatingSelectSource, /aria-readonly=\{isReadOnly\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(floatingSelectSource, /aria-disabled=\{disabled\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(floatingSelectSource, /id=\{listboxId\}/);
  assert.match(floatingSelectSource, /id=\{optionId\(option\.value\)\}/);
  assert.match(floatingSelectSource, /aria-selected=\{option\.value\s*===\s*selectedValue\}/);
  assert.match(floatingSelectSource, /role="listbox"/);
  assert.match(floatingSelectSource, /role="option"/);
  assert.match(floatingSelectSource, /case\s+"Enter"/);
  assert.match(floatingSelectSource, /case\s+" "/);
  assert.match(floatingSelectSource, /case\s+"ArrowDown"/);
  assert.match(floatingSelectSource, /case\s+"ArrowUp"/);
  assert.match(floatingSelectSource, /case\s+"Escape"/);
  assert.match(floatingSelectSource, /case\s+"Home"/);
  assert.match(floatingSelectSource, /case\s+"End"/);
  assert.doesNotMatch(floatingSelectSource, /onChange\?\.\(option\.value\);\s*setOpen\(false\)/);
});

test("Checkbox declares an explicit client boundary", () => {
  assert.match(checkboxSource, /^"use client";/);
});

test("ButtonLink preserves explicit aria labels even when visible text is present", () => {
  assert.match(buttonSource, /const\s+label\s*=\s*controlLabel\(children,\s*ariaLabel\)/);
  assert.match(buttonSource, /aria-label=\{ariaLabel\s*\?\?\s*\(iconOnly\s*\?\s*label\s*:\s*undefined\)\}/);
});
