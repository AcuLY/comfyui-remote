import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsPageSource = readFileSync("src/app/settings/page.tsx", "utf8");
const logsPageSource = readFileSync("src/app/settings/logs/page.tsx", "utf8");
const monitorPageSource = readFileSync("src/app/settings/monitor/page.tsx", "utf8");
const settingsSources = [
  settingsPageSource,
  logsPageSource,
  monitorPageSource,
].join("\n");

test("settings entry page stays an operational dashboard index", () => {
  assert.match(settingsPageSource, /href:\s*"\/settings\/monitor"/);
  assert.match(settingsPageSource, /href:\s*"\/settings\/logs"/);
  assert.match(settingsPageSource, /SfwModeToggle/);
  assert.doesNotMatch(
    settingsPageSource,
    /href:\s*"\/(?:projects|queue|assets\/presets|assets\/templates|training)/,
    "settings should not become a shortcut surface for business workspaces",
  );
});

test("settings pages do not import generation or training business modules", () => {
  assert.doesNotMatch(
    settingsSources,
    /from ["']@\/lib\/actions|from ["']@\/server\/|from ["']@\/features\/training/,
    "settings pages should stay UI dashboards around operational APIs",
  );
  assert.doesNotMatch(
    settingsSources,
    /WORK_MODE_STORAGE_KEY|WORK_MODE_CHANGE_EVENT|\/training\/runs/,
    "work-mode switching and training shortcuts belong to the shared navigation, not settings pages",
  );
});

test("settings logs page only polls the operational logs endpoint", () => {
  assert.match(logsPageSource, /fetch\(`\/api\/logs\?\$\{params\.toString\(\)\}`\)/);
  assert.match(logsPageSource, /const MODULES =/);
  assert.match(logsPageSource, /const LEVELS =/);
  assert.doesNotMatch(
    logsPageSource,
    /\/api\/(?:projects|training|queue|assets|presets|templates)/,
    "logs dashboard should not call business-resource APIs",
  );
});

test("settings monitor page only calls Comfy operational endpoints", () => {
  assert.match(monitorPageSource, /fetch\("\/api\/comfy\/status"\)/);
  assert.match(monitorPageSource, /fetch\(`\/api\/comfy\/\$\{action\}`,\s*\{\s*method:\s*"POST"\s*\}\)/);
  assert.match(monitorPageSource, /fetch\("\/api\/comfy\/health-probe",\s*\{\s*method:\s*"POST"\s*\}\)/);
  assert.doesNotMatch(
    monitorPageSource,
    /\/api\/(?:projects|training|queue|assets|presets|templates)/,
    "monitor dashboard should not call business-resource APIs",
  );
});
