import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const cssSource = readFileSync(resolve(testDir, "app-shell.module.css"), "utf8");

test("mobile bottom navigation fits the six work-mode resource entries plus the drawer action", () => {
  assert.match(
    cssSource,
    /\.mobileBottomNav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    "mobile bottom nav should use four columns so six resource entries plus More fit in two rows",
  );
});
