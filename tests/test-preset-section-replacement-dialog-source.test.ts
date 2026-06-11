import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/preset-section-replacement-dialog.tsx", "utf8");

test("preset section replacement dialog exposes dry-run then apply workflow", () => {
  assert.match(source, /createPortal/);
  assert.match(source, /Dry Run/);
  assert.match(source, /确认 Apply/);
  assert.match(source, /setDryRunResult\(null\)/);
});

test("preset section replacement dialog supports project and template targets", () => {
  assert.match(source, /targetType === "project"/);
  assert.match(source, /targetType === "template"/);
  assert.match(source, /toVariantId/);
});
