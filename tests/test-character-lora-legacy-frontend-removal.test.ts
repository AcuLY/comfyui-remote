import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveRouteFallback } from "../src/lib/route-fallback";

test("legacy character LoRA frontend routes are removed from the app shell", () => {
  assert.equal(existsSync(resolve("src/app/character-lora-training")), false);
  assert.equal(resolveRouteFallback("/character-lora-training"), null);
  assert.equal(resolveRouteFallback("/character-lora-training/new"), null);
  assert.equal(resolveRouteFallback("/character-lora-training/job-1/sections/section-1/extra"), null);
});

test("shared task panel actions do not import from the removed frontend route", () => {
  const taskPanelForm = readFileSync(resolve("src/components/task-panel/task-panel-form.tsx"), "utf8");
  const appShell = readFileSync(resolve("src/components/app-shell.tsx"), "utf8");
  const bottomNav = readFileSync(resolve("src/components/persistent-bottom-nav.tsx"), "utf8");
  const workModeResources = readFileSync(resolve("src/lib/work-mode-resources.ts"), "utf8");
  assert.doesNotMatch(taskPanelForm, /@\/app\/character-lora-training/);
  assert.doesNotMatch(appShell, /TaskPanel(?:Provider|Container)|@\/components\/task-panel/);
  assert.doesNotMatch(bottomNav, /\/character-lora-training/);
  assert.match(bottomNav, /@\/lib\/work-mode-resources/);
  assert.match(workModeResources, /href:\s*"\/training\/runs"/);
});
