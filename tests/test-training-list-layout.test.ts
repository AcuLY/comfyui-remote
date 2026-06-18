import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureRoot = resolve(testDir, "../src/features/training");
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const shellSource = readFileSync(resolve(featureRoot, "shell.tsx"), "utf8");
const appSource = readFileSync(resolve(featureRoot, "app.tsx"), "utf8");
const projectCardSource = readFileSync(resolve(featureUiDir, "training-project-list-item.tsx"), "utf8");
const projectCardCss = readFileSync(resolve(featureUiDir, "training-project-list-item.module.css"), "utf8");
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
  const headerPattern = /@container\s*\(min-width:\s*(\d+)px\)\s*\{/g;
  for (const match of css.matchAll(headerPattern)) {
    const startIndex = match.index ?? 0;
    const bodyStart = startIndex + match[0].length;
    let depth = 1;
    let endIndex = bodyStart;

    for (; endIndex < css.length; endIndex += 1) {
      const character = css[endIndex];
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      if (depth === 0) break;
    }

    const body = css.slice(bodyStart, endIndex);
    const hasClassRule = new RegExp(
      `\\.${escaped}\\b[^{}]*\\{[^{}]*grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)`,
    ).test(body);

    if (hasClassRule) return Number(match[1]);
  }

  return null;
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

test("training shell delegates resource navigation to the persistent bottom nav", () => {
  assert.match(
    shellSource,
    /PersistentBottomNav/,
    "Training shell should render the shared persistent bottom navigation inside its standalone shell",
  );
  assert.match(
    shellSource,
    /navigationChrome="none"/,
    "Training shell should disable demo sidebar navigation chrome",
  );
  assert.match(
    shellSource,
    /footerNav=\{<PersistentBottomNav\s*\/>\}/,
    "Training shell should put the shared bottom navigation in the shared shell footer slot",
  );
  assert.doesNotMatch(
    shellSource,
    /TRAINING_MODULE_NAV_KEYS|buildTrainingNavigationLinks|navigationLinks=\{/,
    "Training shell should not maintain its own sidebar navigation list",
  );
  assert.doesNotMatch(shellSource, /\bmodels:\s*Database\b|\bsettings:\s*Settings\b|case "models"|case "settings"/, "Models and settings should not be private training nav entries");
  assert.doesNotMatch(appSource, /training-(?:models|settings)|\/training\/(?:models|settings)/, "Training app should not route private model or settings pages");
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

test("training managed lists keep explicit item gaps and independent rounded rows", () => {
  const listSurfaces = [
    [projectsCss, "projectGrid"],
    [runsCss, "currentRunList"],
    [runsCss, "runGroupList"],
    [runsCss, "runRows"],
    [resourcesCss, "trainingPresetFolderGrid"],
    [resourcesCss, "trainingPresetItemList"],
    [resourcesCss, "trainingTemplateList"],
    [resourcesCss, "trainingTemplateSectionList"],
  ] as const;
  const rowSurfaces = [
    [runsCss, "currentRunItem"],
    [runsCss, "runProjectHeader"],
    [runsCss, "runRow"],
    [resourcesCss, "resourceRow"],
    [resourcesCss, "templateRow"],
    [resourcesCss, "trainingTemplateListItem"],
    [resourcesCss, "trainingTemplateSectionRow"],
  ] as const;

  for (const [css, className] of listSurfaces) {
    assert.ok(classHasDeclaration(css, className, /gap:\s*(?:8|9|10|11|12)px/), `${className} should separate each managed row with a visible gap`);
  }
  for (const [css, className] of rowSurfaces) {
    assert.ok(classHasDeclaration(css, className, /border-radius:\s*(?:8|9|10|11|12px|var\(--demo-radius\))/), `${className} should own its rounded row shape`);
  }
});

test("training project cards keep demo-like list anatomy without importing design-demos project rows", () => {
  assert.match(
    projectCardSource,
    /export function TrainingProjectCardShell[\s\S]*?<UnitRowShell[\s\S]*className=\{cx\(s\.trainingProjectCard/,
    "Training project cards should own a module-specific row shell built on shared primitives",
  );
  assert.doesNotMatch(
    projectCardSource,
    /from\s+["'][^"']*design-demos\/features\/projects\/project-list-item|project-list-item\.projects/,
    "Production training projects should not import the design-demos project row implementation",
  );
  assert.match(
    projectCardSource,
    /leading=\{\([\s\S]*<Checkbox[\s\S]*className=\{s\.trainingProjectSelectCheckbox\}[\s\S]*className=\{s\.trainingProjectDragHandle\}/,
    "Training project cards should preserve the left checkbox and drag-handle control rail",
  );
  assert.match(
    projectCardSource,
    /title=\{\([\s\S]*s\.trainingProjectTitleRow[\s\S]*s\.trainingProjectTitleLink[\s\S]*<strong>\{project\.title\}<\/strong>[\s\S]*<span>\{sectionCountLabel\}<\/span>[\s\S]*s\.trainingProjectActions[\s\S]*ariaLabel=\{`删除训练项目/,
    "Training project cards should keep a clean title row with short section label and right-side delete action",
  );
  assert.match(
    projectCardSource,
    /body=\{\([\s\S]*s\.trainingProjectRecentResults[\s\S]*<ImageListSmall[\s\S]*className=\{s\.recentResultImages\}[\s\S]*s\.trainingProjectMeta[\s\S]*更新：\{project\.updatedAt\}[\s\S]*<StatusBadge/,
    "Training project cards should keep the recent-result thumbnail strip and lightweight bottom metadata",
  );
  assert.ok(
    classHasDeclaration(projectCardCss, "trainingProjectControls", /grid-template-rows:\s*var\(--training-project-title-row-height\)\s+minmax\(0,\s*1fr\)/),
    "Project card controls should align checkbox with the title row and drag handle with the body",
  );
  assert.ok(
    classHasDeclaration(projectCardCss, "trainingProjectTitleRow", /display:\s*flex/) &&
      classHasDeclaration(projectCardCss, "trainingProjectTitleRow", /justify-content:\s*space-between/),
    "Project card title rows should keep title content separate from the delete action",
  );
  assert.ok(
    classHasDeclaration(projectCardCss, "trainingProjectRecentResults", /border-block:\s*1px\s+solid\s+var\(--demo-border\)/),
    "Project card thumbnail strips should remain visually separated from title and metadata",
  );
  assert.match(
    projectCardCss,
    /\.trainingProjectCardCompact\s+\.trainingProjectTitleLink\s+span,\s*\.trainingProjectCardCompact\s+\.trainingProjectRecentResults,\s*\.trainingProjectCardCompact\s+\.trainingProjectMeta,\s*\.trainingProjectCardCompact\s+\.trainingProjectBody\s*\{[\s\S]*?display:\s*none/,
    "Compact training project cards should hide the short label, thumbnail strip, metadata, and body",
  );
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
    /@container\s*\(min-width:\s*720px\)\s*\{\s*\.trainingPresetFolderGrid,\s*\.trainingPresetItemList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training preset folders and items should wait for the shared wide card/list breakpoint before splitting",
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
    /@container\s*\(min-width:\s*720px\)\s*\{[\s\S]*?\.trainingPresetSortGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Training preset sort panels should wait for the shared wide card/list breakpoint before splitting",
  );
  assert.doesNotMatch(
    resourcesCss,
    /@media\s*\(min-width:\s*700px\)\s*\{[\s\S]*?\.trainingPresetSortGrid/,
    "Training preset sort panels should not depend on the viewport width",
  );
});

test("training managed list cards use the same wide two-column breakpoint family", () => {
  const wideListBreakpoints = [
    [projectsCss, "projectGrid"],
    [runsCss, "currentRunList"],
    [runsCss, "runGroupList"],
    [resourcesCss, "trainingPresetFolderGrid"],
    [resourcesCss, "trainingPresetItemList"],
    [resourcesCss, "trainingTemplateList"],
    [resourcesCss, "resourceGrid"],
    [resourcesCss, "sortGrid"],
    [resourcesCss, "usageList"],
  ] as const;

  for (const [css, className] of wideListBreakpoints) {
    assert.equal(
      twoColumnContainerBreakpoint(css, className),
      720,
      `${className} should wait for the shared wide card/list breakpoint before using two columns`,
    );
  }
});

test("training managed lists stay single column in the mobile shell", () => {
  assert.ok(hasMobileSingleColumnOverride(projectsCss, "projectGrid"), "Project cards should stay single column in the mobile shell");
  assert.ok(hasMobileSingleColumnOverride(runsCss, "runRows"), "Run groups should not split into narrow mobile columns");
  assert.ok(hasMobileSingleColumnOverride(projectPagesCss, "sectionSeedList"), "Initial project sections should stay single column on mobile");
  assert.ok(hasMobileSingleColumnOverride(resourcesCss, "trainingPresetFolderGrid"), "Preset folders should stay single column on mobile");
  assert.ok(hasMobileSingleColumnOverride(resourcesCss, "trainingPresetItemList"), "Preset cards should stay single column on mobile");
  assert.ok(hasMobileSingleColumnOverride(resourcesCss, "trainingTemplateList"), "Template cards should stay single column on mobile");
  assert.ok(hasMobileSingleColumnOverride(resourcesCss, "trainingTemplateSectionList"), "Template sections should stay single column on mobile");
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
    /display:\s*inline-flex/,
    "Project scene block actions should use a compact prompt-block icon rail",
  );
  assert.equal(
    classHasDeclaration(projectPagesCss, "sceneBlockIconButton", /width:\s*28px/),
    true,
    "Project scene block action buttons should stay visually icon-sized",
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

test("training run row cancel and delete actions stay visually icon sized", () => {
  assert.match(
    runsCss,
    /\.rowActions:not\(\.runFailureToolbar\)\s+:where\(\[data-demo-ui-button-label="true"\]\)\s*\{[\s\S]*?display:\s*none/,
    "Default run row cancel/delete buttons should hide their visual labels instead of squeezing text into icon-sized controls",
  );
  assert.doesNotMatch(
    runsCss,
    /\.runFailureToolbar\s+:where\(\[data-demo-ui-button-label="true"\]\)\s*\{[\s\S]*?display:\s*none/,
    "Failed-run copy/retry toolbar should keep labels visible because those actions are not icon-only row controls",
  );
});
