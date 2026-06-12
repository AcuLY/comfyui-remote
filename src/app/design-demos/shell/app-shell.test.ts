import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(resolve(testDir, "app-shell.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "app-shell.module.css"), "utf8");

function sourceRegion(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return source.slice(start, end);
}

test("mobile bottom navigation fits six resource entries plus the right-edge mode indicator", () => {
  assert.match(
    cssSource,
    /\.mobileBottomNav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)\s+minmax\(52px,\s*0\.9fr\)/,
    "mobile bottom nav should reserve six resource columns plus a compact right-edge mode indicator",
  );
});

test("mobile bottom navigation shows work mode as passive status instead of a More navigation item", () => {
  const mobileNavSource = sourceRegion(shellSource, "function MobileBottomNav", "function MobileTopbar");

  assert.match(mobileNavSource, /workMode:\s*DesignDemoWorkMode/, "mobile nav should receive the resolved work mode");
  assert.match(mobileNavSource, /mobileModeIndicator/, "mobile nav should render a dedicated mode status element");
  assert.match(mobileNavSource, /当前模式：/, "mode status should expose the confirmed accessibility label");
  assert.match(mobileNavSource, /FlaskConical/, "LoRA training mode should use the training/flask icon");
  assert.match(mobileNavSource, /ImageIcon/, "generation mode should use the image icon");
  assert.doesNotMatch(mobileNavSource, /<span>更多<\/span>/, "More should not remain a seventh bottom-nav item");
  assert.doesNotMatch(mobileNavSource, /onClick=\{onMore\}/, "mode status should not open the drawer or change modes");
});

test("mobile drawer access remains separate from the bottom navigation resources", () => {
  assert.match(shellSource, /mobileNavDrawerButton/, "mobile drawer should remain available outside resource navigation");
  assert.match(cssSource, /\.mobileNavDrawerButton\b/, "separate mobile drawer button should be styled explicitly");
});
