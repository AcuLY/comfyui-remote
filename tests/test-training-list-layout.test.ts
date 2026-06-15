import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const projectsCss = readFileSync(resolve(featureUiDir, "training-projects-page.module.css"), "utf8");
const projectPagesCss = readFileSync(resolve(featureUiDir, "training-project-pages.module.css"), "utf8");
const resourcesCss = readFileSync(resolve(featureUiDir, "training-resource-pages.module.css"), "utf8");
const runsCss = readFileSync(resolve(featureUiDir, "training-runs-page.module.css"), "utf8");

function hasResponsiveColumns(css: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `@(?:media|container)[^{]*\\{[\\s\\S]*?[^{}]*\\.${escaped}\\b[^{}]*\\{[^{}]*grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)`,
  ).test(css);
}

function cssRule(css: string, className: string) {
  return css.match(new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
}

function rulesForClass(css: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = css.matchAll(new RegExp(`([^{}]*\\.${escaped}\\b[^{}]*)\\{([\\s\\S]*?)\\}`, "g"));
  return [...matches].map((match) => ({ declarations: match[2] ?? "", selector: match[1]?.trim() ?? "" }));
}

function classHasDeclaration(css: string, className: string, declaration: RegExp) {
  return rulesForClass(css, className).some((rule) => declaration.test(rule.declarations));
}

function twoColumnContainerBreakpoint(css: string, className: string) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(
      `@container\\s*\\(min-width:\\s*(\\d+)px\\)\\s*\\{\\s*\\.${escaped}\\b[^{}]*\\{[^{}]*grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)`,
    ),
  );
  return match?.[1] ? Number(match[1]) : null;
}

function hasMobileSingleColumnOverride(css: string, className: string) {
  return new RegExp(
    `@media\\s*\\(max-width:\\s*639px\\)\\s*\\{[\\s\\S]*?\\.${className}\\b[\\s\\S]*?grid-template-columns:\\s*(?:minmax\\(0,\\s*)?1fr`,
  ).test(css);
}

test("training list surfaces expand to two columns when there is enough width", () => {
  assert.ok(hasResponsiveColumns(projectsCss, "projectGrid"), "Training project list should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(runsCss, "currentRunList"), "Current running tasks should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(runsCss, "runGroupList"), "Training run project groups should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(runsCss, "runRows"), "Training run groups should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(projectPagesCss, "sectionGrid"), "Training section list should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(projectPagesCss, "sectionSeedList"), "Initial training section seeds should use a responsive two-column grid");
  assert.ok(hasResponsiveColumns(projectPagesCss, "entityRows"), "Project detail entity lists should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(projectPagesCss, "projectRunRows"), "Project-scoped generation/training runs should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(projectPagesCss, "manifestList"), "Dataset manifest rows should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "trainingPresetFolderGrid"), "Training preset folders should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "trainingPresetItemList"), "Training preset items should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "trainingTemplateList"), "Training template cards should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "trainingTemplateSectionList"), "Training template section rows should use responsive two-column rows");
  assert.ok(hasResponsiveColumns(resourcesCss, "resourceGrid"), "Training preset/template grids should use responsive two columns");
  assert.ok(hasResponsiveColumns(resourcesCss, "sortGrid"), "Sort rule grid should use responsive two columns");
  assert.ok(hasResponsiveColumns(resourcesCss, "usageList"), "Preset/template usage lists should use responsive two-column rows");
});

test("training list surfaces are real grids before responsive column rules apply", () => {
  const gridSurfaces = [
    [projectsCss, "projectGrid"],
    [runsCss, "currentRunList"],
    [runsCss, "runGroupList"],
    [runsCss, "runRows"],
    [projectPagesCss, "sectionGrid"],
    [projectPagesCss, "sectionSeedList"],
    [projectPagesCss, "entityRows"],
    [projectPagesCss, "projectRunRows"],
    [projectPagesCss, "manifestList"],
    [resourcesCss, "trainingPresetFolderGrid"],
    [resourcesCss, "trainingPresetItemList"],
    [resourcesCss, "trainingTemplateList"],
    [resourcesCss, "trainingTemplateSectionList"],
    [resourcesCss, "resourceGrid"],
    [resourcesCss, "sortGrid"],
    [resourcesCss, "usageList"],
  ] as const;

  for (const [css, className] of gridSurfaces) {
    assert.ok(classHasDeclaration(css, className, /display:\s*grid/), `${className} should be a grid container`);
    assert.ok(classHasDeclaration(css, className, /min-width:\s*0/), `${className} should avoid overflow in constrained shells`);
  }
});

test("training run task cards wait for desktop workspace width before splitting", () => {
  const breakpoint = twoColumnContainerBreakpoint(runsCss, "runRows");

  if (breakpoint === null) {
    assert.fail("Training run groups should still expand to two columns when there is enough width");
  }

  assert.ok(
    breakpoint >= 900,
    "Training run task cards should not split at tablet-width containers because thumbnails and row actions crowd the card body",
  );
});

test("training current-running list waits for desktop workspace width before splitting", () => {
  assert.match(
    runsCss,
    /@container\s*\(min-width:\s*720px\)\s*\{[\s\S]*?\.currentRunList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Current running tasks should stay single-column on mobile-width workspaces",
  );
});

test("training current-running cards keep single-column internals while the list first splits", () => {
  assert.match(
    runsCss,
    /@container\s*\(max-width:\s*1020px\)\s*\{[\s\S]*?\.currentRunItem\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    "Current running cards should not split their internals until two list columns have enough room",
  );
});

test("sortable training resource lists use ancestor surfaces for container queries", () => {
  assert.match(
    resourcesCss,
    /\.trainingPresetLibrarySurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Training preset folders and items should respond to their library surface width",
  );
  assert.match(
    resourcesCss,
    /@container\s*\(min-width:\s*520px\)\s*\{\s*\.trainingPresetFolderGrid,\s*\.trainingPresetItemList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training preset folders and items should match the project-demo library breakpoint",
  );
  assert.match(
    resourcesCss,
    /\.trainingTemplateListSurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Training template list should have an outer surface container for width queries",
  );
  assert.match(
    resourcesCss,
    /@container\s*\(min-width:\s*720px\)\s*\{[\s\S]*?\.trainingTemplateList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training template cards should wait for desktop workspace width before splitting",
  );
  assert.doesNotMatch(
    cssRule(resourcesCss, "trainingTemplateList"),
    /container-type:\s*inline-size/,
    "Training template list should not query its own width directly",
  );
});

test("training preset sort panels use the shared container-driven list breakpoint", () => {
  assert.match(
    resourcesCss,
    /\.page\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Training resource pages should expose the workspace width as a query container",
  );
  assert.match(
    resourcesCss,
    /@container\s*\(min-width:\s*520px\)\s*\{[\s\S]*?\.trainingPresetSortGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training preset sort panels should expand at the same container breakpoint as other managed lists",
  );
  assert.doesNotMatch(
    resourcesCss,
    /@media\s*\(min-width:\s*700px\)\s*\{[\s\S]*?\.trainingPresetSortGrid/,
    "Training preset sort panels should not depend on the viewport width",
  );
});

test("training managed lists stay single column in the mobile shell", () => {
  assert.ok(hasMobileSingleColumnOverride(runsCss, "runRows"), "Run groups should not split into narrow mobile columns");
  assert.ok(hasMobileSingleColumnOverride(projectPagesCss, "sectionSeedList"), "Initial project sections should stay single column on mobile");
  assert.ok(hasMobileSingleColumnOverride(resourcesCss, "trainingPresetSortGrid"), "Preset sort groups should stay single column on mobile");
});

test("training mobile row actions keep compact demo toolbar density", () => {
  assert.match(
    cssRule(projectPagesCss, "sectionSeedActions"),
    /display:\s*flex/,
    "Initial section seed actions should use a compact wrapping toolbar instead of wide grid buttons",
  );
  assert.match(
    cssRule(projectPagesCss, "sceneBlockActions"),
    /display:\s*flex/,
    "Project scene block actions should use compact wrapping controls",
  );
  assert.match(
    cssRule(resourcesCss, "templateSceneBlockActions"),
    /display:\s*flex/,
    "Template scene block actions should use compact wrapping controls",
  );
  assert.doesNotMatch(
    projectPagesCss,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?\.sceneBlockActions\s+:where\(\[data-demo-ui-button="true"\]\)\s*\{[\s\S]*?width:\s*100%/,
    "Project scene block buttons should not be stretched full-width in the mobile shell",
  );
  assert.doesNotMatch(
    resourcesCss,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?\.templateSceneBlockActions\s+:where\(\[data-demo-ui-button="true"\]\)\s*\{[\s\S]*?width:\s*100%/,
    "Template scene block buttons should not be stretched full-width in the mobile shell",
  );
});
