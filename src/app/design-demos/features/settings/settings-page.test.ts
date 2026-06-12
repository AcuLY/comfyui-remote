import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(testDir, "settings-page.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "settings-page.shell.module.css"), "utf8");

test("settings page exposes the generation versus LoRA training work mode switch", () => {
  assert.match(source, /comfyui-manager:work-mode/, "settings should persist work mode in the confirmed storage key");
  assert.match(source, /generation/, "settings should expose generation mode");
  assert.match(source, /lora_training/, "settings should expose LoRA training mode");
  assert.match(source, /localStorage/, "settings should read and write mode locally");
  assert.match(source, /modeRouteList/, "settings should explain how resource entries resolve per mode");
  assert.match(cssSource, /\.workModePanel\b/, "settings should style work mode as its own panel");
  assert.match(cssSource, /\.workModeGrid\b/, "settings should style mode choices as responsive cards");
});
