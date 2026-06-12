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

function cssRule(css: string, className: string) {
  return css.match(new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
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

test("sortable training resource lists use ancestor surfaces for container queries", () => {
  assert.match(
    resourcesCss,
    /\.trainingPresetLibrarySurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Training preset folders and items should respond to their library surface width",
  );
  assert.match(
    resourcesCss,
    /@container\s*\(min-width:\s*700px\)\s*\{[\s\S]*?\.trainingPresetFolderGrid[\s\S]*?\.trainingPresetItemList[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training preset folders and items should use a container query rather than viewport width",
  );
  assert.match(
    resourcesCss,
    /\.trainingTemplateListSurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Training template list should have an outer surface container for width queries",
  );
  assert.match(
    resourcesCss,
    /@container\s*\(min-width:\s*520px\)\s*\{[\s\S]*?\.trainingTemplateList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training template cards should expand from the surface container",
  );
  assert.doesNotMatch(
    cssRule(resourcesCss, "trainingTemplateList"),
    /container-type:\s*inline-size/,
    "Training template list should not query its own width directly",
  );
});
