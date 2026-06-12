import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(testDir, "settings-page.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "settings-page.shell.module.css"), "utf8");
const routeSource = readFileSync(resolve(testDir, "../../routing/routes.ts"), "utf8");

test("settings page exposes the generation versus LoRA training work mode switch", () => {
  assert.match(routeSource, /comfyui-manager:work-mode/, "routing should own the confirmed work mode storage key");
  assert.match(source, /WORK_MODE_STORAGE_KEY/, "settings should persist work mode through the shared storage key");
  assert.match(source, /WORK_MODE_CHANGE_EVENT/, "settings should notify the shell when the mode changes");
  assert.match(source, /generation/, "settings should expose generation mode");
  assert.match(source, /lora_training/, "settings should expose LoRA training mode");
  assert.match(source, /localStorage/, "settings should read and write mode locally");
  assert.match(source, /modeRouteList/, "settings should explain how resource entries resolve per mode");
  assert.match(cssSource, /\.workModePanel\b/, "settings should style work mode as its own panel");
  assert.match(cssSource, /\.workModeGrid\b/, "settings should style mode choices as responsive cards");
});

test("settings navigation icons are decorative and hidden from assistive tech", () => {
  assert.match(
    source,
    /<item\.icon className=\{s\.iconMd\} aria-hidden="true" \/>/,
    "settings row leading icons should not duplicate link text",
  );
  assert.match(
    source,
    /<ArrowRight className=\{s\.iconMd\} aria-hidden="true" \/>/,
    "settings row arrow icons should be decorative",
  );
});

test("settings links avoid implicit transition-all motion", () => {
  assert.doesNotMatch(
    cssSource,
    /transition:\s*150ms\s+ease\s*;/,
    "settings link transitions should name the animated properties",
  );
  assert.match(
    cssSource,
    /transition:\s*background-color\s+150ms\s+ease,\s*border-color\s+150ms\s+ease,\s*color\s+150ms\s+ease\s*;/,
    "settings link transitions should stay explicit",
  );
});
