import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectsCss = readFileSync(resolve(testDir, "training-projects-page.module.css"), "utf8");
const projectPagesCss = readFileSync(resolve(testDir, "training-project-pages.module.css"), "utf8");
const resourcesCss = readFileSync(resolve(testDir, "training-resource-pages.module.css"), "utf8");
const runsCss = readFileSync(resolve(testDir, "training-runs-page.module.css"), "utf8");

function hasResponsiveColumns(css: string, className: string) {
  return new RegExp(`@(?:media|container)[\\s\\S]*?\\.${className}[\\s\\S]*?grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)`).test(css);
}

test("training list surfaces expand to two columns when there is enough width", () => {
  assert.ok(hasResponsiveColumns(projectsCss, "projectGrid"), "Training project list should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(runsCss, "runRows"), "Training run groups should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(projectPagesCss, "sectionGrid"), "Training section list should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(projectPagesCss, "sectionSeedList"), "Initial training section seeds should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(projectPagesCss, "entityRows"), "Project detail entity lists should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "resourceGrid"), "Training preset/template grids should use responsive two columns");
  assert.ok(hasResponsiveColumns(resourcesCss, "sortGrid"), "Sort rule grid should use responsive two columns");
  assert.ok(hasResponsiveColumns(resourcesCss, "usageList"), "Preset/template usage lists should use responsive two-column rows");
});
