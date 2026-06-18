import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

const fieldSource = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");

test("design demo field binds the visible label to single-line controls", () => {
  const inputSource = fieldSource.match(/<input[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(fieldSource, /useId/, "Field should generate a stable id for the visible label");
  assert.match(fieldSource, /<label htmlFor=\{controlId\}>\{label\}<\/label>/, "field label should target the generated control id");
  assert.match(inputSource, /id=\{controlId\}/, "input should expose the id referenced by the label");
});

test("design demo field can render actions in the label row", () => {
  assert.match(fieldSource, /actions\?: React\.ReactNode/, "Field should accept optional label-row actions");
  assert.match(fieldSource, /className=\{s\.fieldActions\}/, "field actions should render in a dedicated header region");
  assert.match(fieldSource, /aria-label=\{`\$\{label\} 字段操作`\}/, "field actions should be grouped with an accessible label");
});

test("design demo field binds the visible label to multiline controls", () => {
  const textareaSource = fieldSource.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(textareaSource, /id=\{controlId\}/, "textarea should expose the id referenced by the label");
});
