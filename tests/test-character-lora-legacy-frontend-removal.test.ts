import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveRouteFallback } from "../src/lib/route-fallback";

function listSourceFilesIfExists(path: string) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => entry.name);
}

test("legacy character LoRA frontend routes are removed from the app shell", () => {
  assert.equal(existsSync(resolve("src/app/character-lora-training")), false);
  assert.equal(resolveRouteFallback("/character-lora-training"), null);
  assert.equal(resolveRouteFallback("/character-lora-training/new"), null);
  assert.equal(resolveRouteFallback("/character-lora-training/job-1/sections/section-1/extra"), null);
});

test("legacy Character LoRA task panel frontend is removed", () => {
  const appShell = readFileSync(resolve("src/components/app-shell.tsx"), "utf8");
  const bottomNav = readFileSync(resolve("src/components/persistent-bottom-nav.tsx"), "utf8");
  const workModeResources = readFileSync(resolve("src/lib/work-mode-resources.ts"), "utf8");
  assert.deepEqual(listSourceFilesIfExists(resolve("src/components/task-panel")), []);
  assert.equal(existsSync(resolve("src/lib/actions/task-polling.ts")), false);
  assert.doesNotMatch(appShell, /TaskPanel(?:Provider|Container)|@\/components\/task-panel/);
  assert.doesNotMatch(bottomNav, /\/character-lora-training/);
  assert.match(bottomNav, /@\/lib\/work-mode-resources/);
  assert.match(workModeResources, /href:\s*"\/training\/runs"/);
});
