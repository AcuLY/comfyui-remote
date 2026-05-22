import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const designDemosDir = resolve(testDir, "../..");
const fieldSource = readDemoSource("shared/primitives/field/index.tsx");
const floatingSelectSource = readDemoSource("shared/primitives/floating-select/index.tsx");
const floatingSelectStyleSource = readDemoSource("shared/primitives/floating-select/floating-select.module.css");
const segmentedControlStyleSource = readDemoSource("shared/primitives/segmented-control/segmented-control.module.css");
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

function cssBlockSource(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} should exist`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${marker} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${marker} body should close`);
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

test("Field supports multiline, optional resize, optional clipboard, and readOnly paste safeguards", () => {
  assert.match(fieldSource, /multiline\?:\s*boolean/);
  assert.match(fieldSource, /features\?:\s*\{[\s\S]*resize\?:\s*boolean[\s\S]*clipboard\?:\s*boolean[\s\S]*\}/);
  assert.match(fieldSource, /const\s+hasClipboardTools\s*=\s*Boolean\(features\?\.clipboard\)/);
  assert.match(fieldSource, /const\s+resizeEnabled\s*=\s*Boolean\(features\?\.resize\)/);
  assert.match(fieldSource, /multiline\s*\?\s*\(/);
  assert.match(fieldSource, /<textarea/);
  assert.match(fieldSource, /className=\{cx\(s\.control,\s*s\.multilineControl,\s*resizeEnabled\s*\?\s*s\.resizable\s*:\s*s\.noResize\)\}/);
  assert.match(fieldSource, /hasClipboardTools\s*\?\s*\(/);
  assert.match(fieldSource, /copyToClipboard\(displayValue\)/);
  assert.match(fieldSource, /disabled=\{isReadOnly\s*\|\|\s*disabled\}/);

  const updateValueSource = functionSource(fieldSource, "updateValue");
  assert.match(updateValueSource, /if\s*\(isReadOnly\s*\|\|\s*disabled\)\s*return/);
  assert.match(updateValueSource, /onChange\?\.\(nextValue\)/);
  assert.match(updateValueSource, /if\s*\(isControlled\)\s*return/);
  assert.match(updateValueSource, /setFieldValue\(\{ sourceValue: resolvedValue, draftValue: nextValue \}\)/);

  assert.match(fieldSource, /readOnly=\{isReadOnly\}/);
  assert.match(fieldSource, /aria-readonly=\{isReadOnly\s*\?\s*"true"\s*:\s*undefined\}/);
  assert.match(fieldSource, /onBeforeInput=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(fieldSource, /onDrop=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.match(fieldSource, /onPaste=\{isReadOnly\s*\?\s*preventReadonlyEdit\s*:\s*undefined\}/);
  assert.doesNotMatch(fieldSource, /const\s+isInteractive\s*=\s*Boolean\(onChange\)/);
  assert.doesNotMatch(fieldSource, /readOnly=\{!isInteractive\}/);
  assert.doesNotMatch(fieldSource, /aria-readonly=\{isInteractive\s*\?\s*undefined\s*:\s*"true"\}/);
});

test("FloatingSelect supports local selection state, explicit readOnly, and keyboard listbox ARIA", () => {
  assert.match(floatingSelectSource, /^"use client";/);
  assert.match(floatingSelectSource, /value\?:\s*string/);
  assert.match(floatingSelectSource, /defaultValue\?:\s*string/);
  assert.match(floatingSelectSource, /label\?:\s*string/);
  assert.match(floatingSelectSource, /readOnly\?:\s*boolean/);
  assert.match(floatingSelectSource, /options\?:\s*Array<FloatingSelectOption\s*\|\s*string>/);
  assert.match(floatingSelectSource, /function\s+normalizeFloatingSelectOptions/);
  assert.match(floatingSelectSource, /const\s+fallbackValue\s*=\s*value\s*\?\?\s*defaultValue\s*\?\?\s*""/);
  assert.match(floatingSelectSource, /\[fallbackValue\]/);
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

test("FloatingSelect has standalone and labeled field chrome", () => {
  assert.match(floatingSelectStyleSource, /:where\(\.floatingSelectBtn\)\s*\{/);
  assert.match(floatingSelectStyleSource, /min-height:\s*38px/);
  assert.match(floatingSelectStyleSource, /border:\s*1px solid var\(--ui-glass-border\)/);
  assert.match(floatingSelectStyleSource, /background:\s*var\(--ui-field-bg\)/);
  assert.match(floatingSelectStyleSource, /padding:\s*8px 12px/);
  assert.match(floatingSelectStyleSource, /\.floatingSelectBtn:hover/);
  assert.match(floatingSelectStyleSource, /\.floatingSelectBtn:focus-visible/);
  assert.match(floatingSelectStyleSource, /\.fieldRoot\s*\{/);
  assert.match(floatingSelectStyleSource, /\.fieldRoot label\s*\{/);
  assert.match(floatingSelectStyleSource, /\.fieldButton\s*\{/);
  assert.match(floatingSelectStyleSource, /width:\s*100%/);
});

test("SegmentedControl fit and dense layouts do not expose vertical scrollbars", () => {
  const fitItemsBlock = cssBlockSource(segmentedControlStyleSource, '.root[data-fit-items="true"]');
  const denseBlock = cssBlockSource(segmentedControlStyleSource, ".dense");

  assert.match(fitItemsBlock, /overflow-x:\s*auto/, "fit item segmented controls may scroll horizontally when space is tight");
  assert.match(fitItemsBlock, /overflow-y:\s*hidden/, "fit item segmented controls should not expose a vertical scrollbar");
  assert.match(fitItemsBlock, /scrollbar-width:\s*none/, "fit item segmented controls should hide native scrollbar chrome");
  assert.match(denseBlock, /overflow-x:\s*auto/, "dense segmented controls may scroll horizontally when space is tight");
  assert.match(denseBlock, /overflow-y:\s*hidden/, "dense segmented controls should not expose a vertical scrollbar");
  assert.match(denseBlock, /scrollbar-width:\s*none/, "dense segmented controls should hide native scrollbar chrome");
});

test("legacy select and textarea adapter primitives are removed", () => {
  assert.equal(existsSync(resolve(designDemosDir, ["shared/primitives/select", "like/index.tsx"].join("-"))), false);
  assert.equal(existsSync(resolve(designDemosDir, ["shared/primitives/text", "area", "field/index.tsx"].join("-"))), false);
});

test("Checkbox declares an explicit client boundary", () => {
  assert.match(checkboxSource, /^"use client";/);
});

test("ButtonLink preserves explicit aria labels even when visible text is present", () => {
  assert.match(buttonSource, /const\s+label\s*=\s*controlLabel\(children,\s*ariaLabel\)/);
  assert.match(buttonSource, /aria-label=\{ariaLabel\s*\?\?\s*\(iconOnly\s*\?\s*label\s*:\s*undefined\)\}/);
});

test("Button primitives expose a stable label slot for responsive composition", () => {
  assert.match(buttonSource, /<span\s+data-demo-ui-button-label="true">\{children\}<\/span>/);
});
