import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const pageSource = readFileSync(resolve(featureUiDir, "training-resource-pages.tsx"), "utf8");
const resourcePageUtilsPath = resolve(featureUiDir, "training-resource-page-utils.ts");
const resourcePageUtilsSource = existsSync(resourcePageUtilsPath)
  ? readFileSync(resourcePageUtilsPath, "utf8")
  : "";
const resourceUrlSearchHookPath = resolve(featureUiDir, "use-resource-url-search.ts");
const resourceUrlSearchHookSource = existsSync(resourceUrlSearchHookPath)
  ? readFileSync(resourceUrlSearchHookPath, "utf8")
  : "";
const presetSortPanelPath = resolve(featureUiDir, "training-preset-sort-panel.tsx");
const presetSortPanelSource = existsSync(presetSortPanelPath)
  ? readFileSync(presetSortPanelPath, "utf8")
  : "";
const presetSortRulesPagePath = resolve(featureUiDir, "training-preset-sort-rules-page.tsx");
const presetSortRulesPageSource = existsSync(presetSortRulesPagePath)
  ? readFileSync(presetSortRulesPagePath, "utf8")
  : "";
const trainingPresetsPagePath = resolve(featureUiDir, "training-presets-page.tsx");
const trainingPresetsPageSource = existsSync(trainingPresetsPagePath)
  ? readFileSync(trainingPresetsPagePath, "utf8")
  : "";
const trainingPresetDetailPagePath = resolve(featureUiDir, "training-preset-detail-page.tsx");
const trainingPresetDetailPageSource = existsSync(trainingPresetDetailPagePath)
  ? readFileSync(trainingPresetDetailPagePath, "utf8")
  : "";
const presetLibraryPrimitivesPath = resolve(featureUiDir, "training-preset-library-primitives.tsx");
const presetLibraryPrimitivesSource = existsSync(presetLibraryPrimitivesPath)
  ? readFileSync(presetLibraryPrimitivesPath, "utf8")
  : "";
const templateListPrimitivesPath = resolve(featureUiDir, "training-template-list-primitives.tsx");
const templateListPrimitivesSource = existsSync(templateListPrimitivesPath)
  ? readFileSync(templateListPrimitivesPath, "utf8")
  : "";
const trainingTemplatesPagePath = resolve(featureUiDir, "training-templates-page.tsx");
const trainingTemplatesPageSource = existsSync(trainingTemplatesPagePath)
  ? readFileSync(trainingTemplatesPagePath, "utf8")
  : "";
const trainingTemplateFormPagePath = resolve(featureUiDir, "training-template-form-page.tsx");
const trainingTemplateFormPageSource = existsSync(trainingTemplateFormPagePath)
  ? readFileSync(trainingTemplateFormPagePath, "utf8")
  : "";
const trainingTemplateSectionPagePath = resolve(featureUiDir, "training-template-section-page.tsx");
const trainingTemplateSectionPageSource = existsSync(trainingTemplateSectionPagePath)
  ? readFileSync(trainingTemplateSectionPagePath, "utf8")
  : "";
const templateSectionRowPath = resolve(featureUiDir, "training-template-section-row.tsx");
const templateSectionRowSource = existsSync(templateSectionRowPath)
  ? readFileSync(templateSectionRowPath, "utf8")
  : "";
const templatePageUtilsPath = resolve(featureUiDir, "training-template-page-utils.ts");
const templatePageUtilsSource = existsSync(templatePageUtilsPath)
  ? readFileSync(templatePageUtilsPath, "utf8")
  : "";
const templateSceneBlockCardPath = resolve(featureUiDir, "training-template-scene-block-card.tsx");
const templateSceneBlockCardSource = existsSync(templateSceneBlockCardPath)
  ? readFileSync(templateSceneBlockCardPath, "utf8")
  : "";
const cssSource = readFileSync(resolve(featureUiDir, "training-resource-pages.module.css"), "utf8");
const headerSpecsSource = readFileSync(resolve(testDir, "../src/features/training/header-specs.ts"), "utf8");
const legacyPageSource = readFileSync(resolve(testDir, "../src/app/design-demos/features/lora-training/training-resource-pages.tsx"), "utf8");

function nestedComponentFunctionSource(source: string, functionName: string) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const endCandidates = [
    source.indexOf("\n  function ", start + 1),
    source.indexOf("\n  if (mode", start + 1),
    source.indexOf("\n  return (", start + 1),
  ].filter((index) => index !== -1);
  assert.ok(endCandidates.length > 0, `${functionName} should have a bounded source range`);
  return source.slice(start, Math.min(...endCandidates));
}

test("training resource page implementation is owned by the training feature layer", () => {
  assert.match(
    legacyPageSource,
    /from "@\/features\/training\/ui\/training-resource-pages"/,
    "design-demos resource page file should re-export the feature-layer resource pages",
  );
});

test("training resource pages keep backend wiring notes out of user-facing copy", () => {
  assert.doesNotMatch(pageSource, /后端接入时/, "training resource UI should not expose backend integration notes");
});

test("training resource pages use production-owned browser persistence keys", () => {
  assert.doesNotMatch(
    pageSource,
    /demo-training/,
    "production training resource pages must not store route state under demo-prefixed browser keys",
  );
  assert.match(
    templateListPrimitivesSource,
    /TRAINING_TEMPLATE_SCROLL_KEY\s*=\s*"comfyui-manager:training:templates:list-anchor"/,
    "training template list anchor state should use a production training namespace",
  );
});

test("training resource route and query helpers live in a focused utility module", () => {
  for (const helperName of [
    "findPreset",
    "findTemplate",
    "uniquePresetCategories",
    "uniquePresetFolders",
    "isProductionTrainingPath",
    "orderTrainingPresetsByIds",
    "readNewPresetHints",
    "readNewTemplateHints",
    "createProjectFromTemplateHref",
  ]) {
    assert.match(resourcePageUtilsSource, new RegExp(`function ${helperName}\\b`), `${helperName} should live in training-resource-page-utils.ts`);
    assert.doesNotMatch(pageSource, new RegExp(`function ${helperName}\\b`), `${helperName} should not stay inline in the broad resource pages file`);
  }
  assert.match(resourcePageUtilsSource, /type NewPresetHints\b/, "new preset hint typing should move with the hint parser");
  assert.match(resourcePageUtilsSource, /type NewTemplateHints\b/, "new template hint typing should move with the hint parser");
  assert.match(
    [
      trainingPresetsPageSource,
      trainingPresetDetailPageSource,
      trainingTemplatesPageSource,
      trainingTemplateFormPageSource,
      trainingTemplateSectionPageSource,
    ].join("\n"),
    /from "\.\/training-resource-page-utils"/,
    "focused resource pages should import focused route and query helpers",
  );
  assert.match(trainingPresetsPageSource, /orderTrainingPresetsByIds\(training\.presets, orderedPresetIds\)/, "preset list ordering should use the focused id-order helper");
});

test("training preset draft factory lives in the resource page utility module", () => {
  assert.match(resourcePageUtilsSource, /function createDraftTrainingPreset\b/, "new preset draft creation should live in training-resource-page-utils.ts");
  assert.doesNotMatch(pageSource, /\nfunction createDraftTrainingPreset\b/, "new preset draft creation should not stay inline in the broad resource pages file");
  assert.match(trainingPresetDetailPageSource, /createDraftTrainingPreset/, "preset detail page should import the focused preset draft factory");
});

test("training preset sort panel primitives live in a focused module", () => {
  for (const helperName of [
    "orderTrainingPresetSortItems",
    "buildTrainingPresetSortRulesDraft",
    "TrainingPresetSortPanel",
    "TrainingPresetSortableSortRow",
  ]) {
    assert.match(presetSortPanelSource, new RegExp(`function ${helperName}\\b`), `${helperName} should live in training-preset-sort-panel.tsx`);
    assert.doesNotMatch(pageSource, new RegExp(`function ${helperName}\\b`), `${helperName} should not stay inline in the broad resource pages file`);
  }
  assert.match(presetSortPanelSource, /type TrainingPresetSortItem\b/, "training preset sort item typing should move with the sort panel");
  assert.match(presetSortPanelSource, /type TrainingPresetSortRulesDraft\b/, "training preset sort draft typing should move with the sort panel helper");
  assert.match(presetSortRulesPageSource, /from "\.\/training-preset-sort-panel"/, "preset sort rules page should import focused preset sort panel primitives");
  assert.doesNotMatch(pageSource, /from "\.\/training-preset-sort-panel"/, "resource pages should leave preset sort panel wiring to the focused sort rules page");
});

test("training preset sort rules page lives in a focused module", () => {
  assert.match(presetSortRulesPageSource, /export function LoraTrainingPresetSortRulesPage\b/, "preset sort rules page should live in training-preset-sort-rules-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingPresetSortRulesPage\b/, "preset sort rules page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-preset-sort-rules-page"/, "resource pages should re-export the focused preset sort rules page");
});

test("training presets page lives in a focused module", () => {
  assert.match(trainingPresetsPageSource, /export function LoraTrainingPresetsPage\b/, "training presets page should live in training-presets-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingPresetsPage\b/, "training presets page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-presets-page"/, "resource pages should re-export the focused presets page");
});

test("training preset detail page lives in a focused module", () => {
  assert.match(trainingPresetDetailPageSource, /export function LoraTrainingPresetDetailPage\b/, "training preset detail page should live in training-preset-detail-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingPresetDetailPage\b/, "training preset detail page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-preset-detail-page"/, "resource pages should re-export the focused preset detail page");
});

test("training preset library row primitives live in a focused module", () => {
  for (const helperName of [
    "presetStatus",
    "presetUsageLabel",
    "TrainingPresetLibraryItemRow",
    "TrainingPresetCategoryRailItem",
  ]) {
    assert.match(presetLibraryPrimitivesSource, new RegExp(`function ${helperName}\\b`), `${helperName} should live in training-preset-library-primitives.tsx`);
    assert.doesNotMatch(pageSource, new RegExp(`function ${helperName}\\b`), `${helperName} should not stay inline in the broad resource pages file`);
  }
  assert.match(`${trainingPresetsPageSource}\n${trainingPresetDetailPageSource}`, /from "\.\/training-preset-library-primitives"/, "focused preset pages should import focused preset library primitives");
  assert.doesNotMatch(pageSource, /from "\.\/training-preset-library-primitives"/, "resource pages should leave preset library primitive wiring to focused preset pages");
});

test("training template list primitives live in a focused module", () => {
  for (const helperName of [
    "templateStatus",
    "readAndClearTrainingTemplateListAnchor",
    "rememberTrainingTemplateListAnchor",
    "TrainingTemplateListItem",
  ]) {
    assert.match(templateListPrimitivesSource, new RegExp(`function ${helperName}\\b`), `${helperName} should live in training-template-list-primitives.tsx`);
    assert.doesNotMatch(pageSource, new RegExp(`function ${helperName}\\b`), `${helperName} should not stay inline in the broad resource pages file`);
  }
  assert.match(templateListPrimitivesSource, /TRAINING_TEMPLATE_SCROLL_KEY\s*=\s*"comfyui-manager:training:templates:list-anchor"/, "template list anchor key should move with the anchor helpers");
  assert.match(trainingTemplatesPageSource, /from "\.\/training-template-list-primitives"/, "training templates page should import focused template list primitives");
  assert.doesNotMatch(pageSource, /from "\.\/training-template-list-primitives"/, "resource pages should leave template list primitives to the focused templates page");
});

test("training templates page lives in a focused module", () => {
  assert.match(trainingTemplatesPageSource, /export function LoraTrainingTemplatesPage\b/, "training templates page should live in training-templates-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingTemplatesPage\b/, "training templates page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-templates-page"/, "resource pages should re-export the focused templates page");
});

test("training template form page lives in a focused module", () => {
  assert.match(trainingTemplateFormPageSource, /export function LoraTrainingTemplateFormPage\b/, "training template form page should live in training-template-form-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingTemplateFormPage\b/, "training template form page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-template-form-page"/, "resource pages should re-export the focused template form page");
});

test("training template section page lives in a focused module", () => {
  assert.match(trainingTemplateSectionPageSource, /export function LoraTrainingTemplateSectionPage\b/, "training template section page should live in training-template-section-page.tsx");
  assert.doesNotMatch(pageSource, /\nexport function LoraTrainingTemplateSectionPage\b/, "training template section page should not stay inline in the broad resource pages file");
  assert.match(pageSource, /from "\.\/training-template-section-page"/, "resource pages should re-export the focused template section page");
});

test("training template section row primitive lives in a focused module", () => {
  assert.match(templateSectionRowSource, /type LoraTrainingTemplateSection\b/, "template section row type should move with the row primitive");
  assert.match(templateSectionRowSource, /function TemplateEditorSectionRow\b/, "template section row should live in training-template-section-row.tsx");
  assert.doesNotMatch(pageSource, /function TemplateEditorSectionRow\b/, "template section row should not stay inline in the broad resource pages file");
  assert.match(trainingTemplateFormPageSource, /from "\.\/training-template-section-row"/, "training template form page should import the focused template section row");
  assert.doesNotMatch(pageSource, /from "\.\/training-template-section-row"/, "resource pages should leave template section rows to the focused template form page");
});

test("training template page pure helpers live in a focused module", () => {
  const templatePageConsumerSource = `${trainingTemplateFormPageSource}\n${trainingTemplateSectionPageSource}`;
  for (const helperName of [
    "buildTemplateSectionStateKey",
    "moveTemplateBlock",
    "nextTemplateSceneBlockOrdinal",
    "nextTemplateSectionCopyNumber",
    "nextTemplateSectionDraftNumber",
    "orderTemplateSectionsByIds",
    "orderTrainingTemplatesByIds",
    "buildTemplateSectionsFromProject",
  ]) {
    assert.match(templatePageUtilsSource, new RegExp(`function ${helperName}\\b`), `${helperName} should live in training-template-page-utils.ts`);
    assert.doesNotMatch(pageSource, new RegExp(`function ${helperName}\\b`), `${helperName} should not stay inline in the broad resource pages file`);
  }
  assert.match(templatePageConsumerSource, /from "\.\/training-template-page-utils"/, "focused template pages should import focused template page helpers");
  assert.doesNotMatch(pageSource, /from "\.\/training-template-page-utils"/, "resource pages should leave template page helper wiring to focused template pages");
});

test("training template scene block card lives in a focused module", () => {
  assert.match(templateSceneBlockCardSource, /export function TemplateSceneBlockCard\b/, "template scene block card should live in training-template-scene-block-card.tsx");
  assert.match(templateSceneBlockCardSource, /export type TemplateSceneBlockPatch\b/, "template scene block patch type should live beside the card");
  assert.doesNotMatch(pageSource, /\nfunction TemplateSceneBlockCard\b/, "template scene block card should not stay inline in the broad resource pages file");
  assert.match(trainingTemplateSectionPageSource, /from "\.\/training-template-scene-block-card"/, "training template section page should import the focused template scene block card");
  assert.doesNotMatch(pageSource, /from "\.\/training-template-scene-block-card"/, "resource pages should leave template scene block card wiring to the focused template section page");
});

test("training resource route helpers do not replace invalid route ids with first fixtures", () => {
  assert.match(trainingPresetDetailPageSource, /export function LoraTrainingPresetDetailPage\b/, "training preset detail source should be readable");
  assert.match(trainingTemplateFormPageSource, /export function LoraTrainingTemplateFormPage\b/, "training template form source should be readable");
  assert.match(trainingTemplateSectionPageSource, /export function LoraTrainingTemplateSectionPage\b/, "training template section source should be readable");

  const helperSource = resourcePageUtilsSource;
  const presetDetailSource = trainingPresetDetailPageSource;
  const templateFormSource = trainingTemplateFormPageSource;
  const templateSectionSource = trainingTemplateSectionPageSource;

  assert.match(helperSource, /if \(!presetId\) return undefined;/, "preset routes without a preset id should resolve to the empty state");
  assert.match(helperSource, /if \(!templateId\) return undefined;/, "template routes without a template id should resolve to the empty state");
  assert.doesNotMatch(helperSource, /training\.presets\[0\]/, "invalid preset ids should not silently render the first preset");
  assert.doesNotMatch(helperSource, /training\.templates\[0\]/, "invalid template ids should not silently render the first template");
  assert.match(presetDetailSource, /if \(!preset\) return <EmptyPage title="没有训练预制数据" \/>;/, "invalid preset edit routes should show the empty state");
  assert.match(templateFormSource, /if \(mode === "edit" && !template\) return <EmptyPage title="没有训练模板数据" \/>;/, "invalid template edit routes should show the empty state");
  assert.doesNotMatch(templateSectionSource, /template\?\.sections\[0\]/, "invalid template section indexes should not silently render the first section");
});

test("training resource query hints use Next search params instead of a manual location store", () => {
  assert.match(resourceUrlSearchHookSource, /function useResourceUrlSearch\b/, "resource URL search hook should live in a focused hook module");
  assert.match(resourceUrlSearchHookSource, /import \{[^}]*useSearchParams[^}]*\} from "next\/navigation";/, "resource URL search hook should subscribe to Next-managed query changes");
  assert.match(resourceUrlSearchHookSource, /const searchParams = useSearchParams\(\)/, "resource URL search hook should read current query params through Next navigation state");
  assert.match(resourceUrlSearchHookSource, /searchParams\.toString\(\)/, "resource URL search hook should pass the live query string into hint parsers");
  assert.match(trainingPresetDetailPageSource, /from "\.\/use-resource-url-search"/, "preset detail page should import the focused URL search hook");
  assert.doesNotMatch(pageSource, /from "\.\/use-resource-url-search"/, "resource pages should leave URL search hook wiring to focused pages");
  assert.doesNotMatch(pageSource, /import \{[^}]*useSearchParams[^}]*\} from "next\/navigation";/, "resource pages should not import Next search params directly");
  assert.doesNotMatch(pageSource, /\nfunction useUrlSearch\b/, "resource pages should not keep the URL search hook inline");
  assert.doesNotMatch(pageSource, /useSyncExternalStore/, "resource query hints should not depend on a manual window.location.search store");
  assert.doesNotMatch(pageSource, /window\.location\.search/, "resource query hints should not read location.search during render");
});

test("training resource delete actions describe local removal instead of confirmation placeholders", () => {
  const deleteActionSource = [
    trainingPresetsPageSource,
    trainingPresetDetailPageSource,
    pageSource,
    trainingTemplateFormPageSource,
  ].join("\n");

  assert.doesNotMatch(deleteActionSource, /删除训练预制需要确认/, "single preset delete feedback should describe the local list removal");
  assert.doesNotMatch(deleteActionSource, /批量删除训练预制需要确认/, "batch preset delete feedback should describe the local list removal");
  assert.doesNotMatch(deleteActionSource, /删除训练模板小节需要确认/, "template section delete feedback should describe the local draft removal");
});

test("training preset library deletes through the formal HTTP API on production routes", () => {
  const presetsSource = trainingPresetsPageSource;

  assert.match(presetsSource, /usePathname/, "training preset library should detect whether it is running under production \\/training routes");
  assert.match(presetsSource, /isDeletingPresets/, "training preset library should track the delete request state");
  assert.match(presetsSource, /fetch\(`\/api\/training\/presets\/\$\{presetId\}`/, "single preset delete should call the formal preset detail API");
  assert.match(presetsSource, /Promise\.all/, "batch preset delete should persist all selected presets before hiding them locally");
  assert.match(presetsSource, /method:\s*"DELETE"/, "preset delete should use DELETE");
  assert.match(presetsSource, /训练预制删除失败/, "preset delete should surface API failures through shared feedback");
});

test("training resource pages use product-facing copy instead of internal prompt schema terms", () => {
  assert.match(trainingPresetsPageSource, /export function LoraTrainingPresetsPage\b/, "training presets source should be readable");
  assert.match(trainingPresetDetailPageSource, /export function LoraTrainingPresetDetailPage\b/, "training preset detail source should be readable");
  assert.match(presetSortRulesPageSource, /export function LoraTrainingPresetSortRulesPage\b/, "preset sort rules source should be readable");
  assert.match(trainingTemplatesPageSource, /export function LoraTrainingTemplatesPage\b/, "training templates source should be readable");
  assert.match(trainingTemplateFormPageSource, /export function LoraTrainingTemplateFormPage\b/, "training template form source should be readable");
  assert.match(trainingTemplateSectionPageSource, /export function LoraTrainingTemplateSectionPage\b/, "training template section source should be readable");

  const visibleResourceCopy = [
    trainingPresetsPageSource,
    trainingPresetDetailPageSource,
    presetSortRulesPageSource,
    trainingTemplatesPageSource,
    templateListPrimitivesSource,
    trainingTemplateFormPageSource,
    trainingTemplateSectionPageSource,
  ].join("\n");

  [
    /scene description/,
    /scene block/,
    /variants \/ positive \/ negative \/ LoRA 结构/,
    /mutable refs/,
    /一次性 seed/,
    /live 回写/,
    /project-level guidance/,
    /section settings/,
    /preset\/local blocks/,
    /普通预设/,
    /Caption 生成指引/,
    /Caption 指引/,
    /字段/,
  ].forEach((pattern) => {
    assert.doesNotMatch(visibleResourceCopy, pattern, `training resource pages should hide internal copy: ${pattern}`);
  });
});

test("training preset library uses the shared managed-library row model", () => {
  const presetsSource = trainingPresetsPageSource;
  const presetsWithItemSource = presetLibraryPrimitivesSource;

  assert.match(presetsWithItemSource, /UnitRowShell/, "training presets should use the shared managed row shell");
  assert.match(presetsWithItemSource, /Checkbox/, "training presets should expose row selection controls");
  assert.match(presetsSource, /SelectionBatchBar/, "training presets should expose batch actions after selection");
  assert.match(presetsSource, /FolderBreadcrumb/, "training presets should show folder path context");
  assert.match(presetsSource, /FolderRow/, "training presets should expose folder rows before item rows");
  assert.match(presetsSource, /activeCategory/, "training presets should keep real selected category state");
  assert.match(presetsSource, /currentFolder/, "training presets should keep real folder state");
  assert.match(presetsSource, /visiblePresets/, "training presets should filter rows by category and folder");
  assert.doesNotMatch(presetsSource, /training\.presets\.map/, "training presets should not render all presets in every category view");
  assert.match(cssSource, /\.trainingPresetLibrarySurface\b/, "training presets should have a dedicated library surface");
  assert.match(cssSource, /\.trainingPresetItemList\b[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "training preset rows should expand to two columns");
});

test("training preset folder and item lists share the project-demo container-driven two-column layout", () => {
  assert.match(
    cssSource,
    /\.trainingPresetLibrarySurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "training preset library should query the actual workspace width",
  );
  assert.match(
    cssSource,
    /@container \(min-width: 720px\) \{\s*\.trainingPresetFolderGrid,\s*\.trainingPresetItemList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "training preset folders and items should wait for the shared wide card/list breakpoint before splitting",
  );
});

test("training preset library drag handles reorder visible presets locally", () => {
  const itemSource = presetLibraryPrimitivesSource;
  const presetsSource = trainingPresetsPageSource;

  assert.match(presetsSource, /orderedPresetIds/, "training preset library should keep a local preset order");
  assert.match(presetsSource, /visiblePresetIds/, "training preset library should derive the currently visible sortable ids");
  assert.match(presetsSource, /handleReorderPresets/, "training preset library should define a local reorder handler");
  assert.match(presetsSource, /<SortableList items=\{visiblePresetIds\} onReorder=\{handleReorderPresets\}>/, "visible training presets should use the shared sortable wrapper");
  assert.match(itemSource, /useDemoSortable\(preset\.id\)/, "training preset rows should attach sortable behavior to each row");
  assert.match(itemSource, /ref=\{ref\}/, "training preset rows should apply sortable refs");
  assert.match(itemSource, /style=\{style\}/, "training preset rows should apply sortable transforms");
  assert.match(itemSource, /\{\.\.\.handleProps\}/, "training preset row drag handles should receive sortable handle props");
});

test("training preset library persists reorder through the formal HTTP API on production routes", () => {
  const presetsSource = trainingPresetsPageSource;

  assert.match(presetsSource, /usePathname/, "training preset library should detect whether it is running under production \\/training routes");
  assert.match(presetsSource, /fetch\("\/api\/training\/presets\/sort-rules"/, "preset reorder should call the formal preset sort-rules API");
  assert.match(presetsSource, /categoryOrder:\s*orderedPresetCategories/, "preset reorder should persist the active category order together with preset order");
  assert.match(presetsSource, /presetOrder:\s*nextOrderedPresetIds/, "preset reorder should submit the reordered preset ids");
  assert.match(presetsSource, /setOrderedPresetIds\(previousIds\)/, "preset reorder should roll back local state when persistence fails");
  assert.match(presetsSource, /训练预制排序保存失败/, "preset reorder should surface save failures through the shared feedback system");
});

test("training preset category rail persists reorder through the formal HTTP API on production routes", () => {
  const presetsSource = trainingPresetsPageSource;

  assert.match(presetsSource, /handleReorderPresetCategories/, "preset library should define a category reorder handler");
  assert.match(presetsSource, /<SortableList items=\{orderedPresetCategories\} onReorder=\{handleReorderPresetCategories\}>/, "category rail should use the dedicated reorder handler");
  assert.match(presetsSource, /categoryOrder:\s*nextCategoryOrder/, "category reorder should submit the updated category order");
  assert.match(presetsSource, /presetOrder:\s*orderedPresetIds/, "category reorder should preserve the current preset order while persisting");
  assert.match(presetsSource, /setOrderedPresetCategories\(previousCategories\)/, "category reorder should roll back local category order when persistence fails");
});

test("training preset selection labels reflect selected state like the managed library demo", () => {
  const itemSource = presetLibraryPrimitivesSource;

  assert.match(
    itemSource,
    /label=\{selected \? `取消选择训练预制：\$\{preset\.title\}` : `选择训练预制：\$\{preset\.title\}`\}/,
    "training preset checkbox labels should expose both select and cancel-select states",
  );
});

test("training resource repeated object actions include the acted-on object name", () => {
  assert.match(trainingTemplatesPageSource, /export function LoraTrainingTemplatesPage\b/, "training templates source should be readable");

  const presetItemSource = presetLibraryPrimitivesSource;
  const sortPanelSource = presetSortPanelSource;
  const templateItemSource = templateListPrimitivesSource;
  const templateRowSource = templateSectionRowSource;

  assert.match(presetItemSource, /ariaLabel=\{`编辑训练预制：\$\{preset\.title\}`\}/, "preset edit action should name the preset");
  assert.match(sortPanelSource, /ariaLabel=\{`保存排序组：\$\{title\}`\}/, "sort-group save action should name the group");
  assert.match(templateItemSource, /ariaLabel=\{`用训练模板创建项目：\$\{template\.title\}`\}/, "template create-project action should name the template");
  assert.match(templateItemSource, /ariaLabel=\{`编辑训练模板：\$\{template\.title\}`\}/, "template edit action should name the template");
  assert.match(templateItemSource, /ariaLabel=\{`删除训练模板：\$\{template\.title\}`\}/, "template delete action should name the template");
  assert.match(templateRowSource, /ariaLabel=\{`编辑训练模板小节：\$\{section\.title\}`\}/, "template-section edit action should name the section");
  assert.match(templateRowSource, /ariaLabel=\{`复制训练模板小节：\$\{section\.title\}`\}/, "template-section copy action should name the section");
  assert.match(templateRowSource, /ariaLabel=\{`删除训练模板小节：\$\{section\.title\}`\}/, "template-section delete action should name the section");
});

test("training preset category rail drag handles reorder categories locally", () => {
  const categoryItemSource = presetLibraryPrimitivesSource;
  const presetsSource = trainingPresetsPageSource;

  assert.match(presetsSource, /orderedPresetCategories/, "training preset category rail should keep local category order");
  assert.match(presetsSource, /handleReorderPresetCategories/, "category rail reorder should update local state through a dedicated handler");
  assert.match(presetsSource, /setOrderedPresetCategories/, "category rail reorder handler should update local state");
  assert.match(presetsSource, /<SortableList items=\{orderedPresetCategories\} onReorder=\{handleReorderPresetCategories\}>/, "category rail should use the shared sortable wrapper");
  assert.match(categoryItemSource, /useDemoSortable\(category\)/, "category rail items should attach sortable behavior to each category");
  assert.match(categoryItemSource, /ref=\{ref\}/, "category rail items should apply sortable refs");
  assert.match(categoryItemSource, /style=\{style\}/, "category rail items should apply sortable transforms");
  assert.match(categoryItemSource, /\{\.\.\.handleProps\}/, "category drag handles should receive sortable handle props");
  assert.match(cssSource, /\.resourceRailDragHandle\b/, "category rail should style a dedicated drag handle");
});

test("training preset new actions route into a real new-preset form", () => {
  const presetsSource = trainingPresetsPageSource;
  const detailSource = trainingPresetDetailPageSource;

  assert.match(headerSpecsSource, /headerAction\("新建预制",\s*Plus,\s*"primary",\s*"\/training\/presets\/new"\)/, "global new action should live in the route header and navigate to the new training preset route");
  assert.match(presetsSource, /newPresetInCategoryHref/, "category-scoped new action should preserve the active category");
  assert.match(presetsSource, /href=\{newPresetInCategoryHref\}/, "category-scoped new action should be a link, not a feedback-only button");
  assert.match(presetsSource, /ariaLabel=\{`新建训练预制到分类：\$\{activeCategoryLabel\}`\}/, "category-scoped new action should name the active category");
  assert.doesNotMatch(presetsSource, /新建训练预制入口已预览/, "new preset actions should not be fake preview feedback");
  assert.match(detailSource, /mode === "new"/, "preset editor should expose a real new mode");
  assert.match(detailSource, /草稿/, "new preset editor should show draft state");
  assert.doesNotMatch(detailSource, /positivePrompt|negativePrompt|loraStages|variants/, "training preset editor must stay scene-description only in new mode");
});

test("training preset new form carries source training artifact context", () => {
  const detailSource = trainingPresetDetailPageSource;

  assert.match(resourcePageUtilsSource, /sourceRun:\s*searchParams\.get\("sourceRun"\)/, "new preset hints should read source training run id");
  assert.match(resourcePageUtilsSource, /artifact:\s*searchParams\.get\("artifact"\)/, "new preset hints should read source artifact name");
  assert.match(resourcePageUtilsSource, /project:\s*searchParams\.get\("project"\)/, "new preset hints should read source project title");
  assert.match(detailSource, /来源训练产物/, "new preset form should show source artifact context");
  assert.match(detailSource, /newPresetHints\.artifact/, "source artifact field should only appear when artifact context exists");
});

test("training preset new form keeps source run ids out of visible copy", () => {
  const detailSource = trainingPresetDetailPageSource;
  const sourceFieldStart = detailSource.indexOf('label="来源训练产物"');
  const nextFieldStart = detailSource.indexOf('<Field multiline', sourceFieldStart);
  assert.notEqual(sourceFieldStart, -1);
  assert.notEqual(nextFieldStart, -1);

  const sourceFieldSource = detailSource.slice(sourceFieldStart, nextFieldStart);

  assert.match(sourceFieldSource, /newPresetHints\.project/, "source artifact copy should name the project when present");
  assert.match(sourceFieldSource, /newPresetHints\.artifact/, "source artifact copy should include the artifact name");
  assert.doesNotMatch(sourceFieldSource, /newPresetHints\.sourceRun/, "source artifact copy should not expose the internal run id");
});

test("training preset direct creation stays neutral instead of inheriting the first preset", () => {
  const draftStart = resourcePageUtilsSource.indexOf("function createDraftTrainingPreset");
  const sceneBlockStart = resourcePageUtilsSource.indexOf("export function readNewTemplateHints");
  assert.notEqual(draftStart, -1);
  assert.notEqual(sceneBlockStart, -1);

  const draftSource = resourcePageUtilsSource.slice(draftStart, sceneBlockStart);

  assert.doesNotMatch(draftSource, /training\.presets\[0\]/, "direct new preset drafts should not use the first demo preset as a hidden template");
  assert.doesNotMatch(draftSource, /source\?\.category/, "direct new preset category should come from route hints or a neutral default");
  assert.doesNotMatch(draftSource, /source\?\.folder/, "direct new preset folder should come from route hints or a neutral default");
  assert.match(draftSource, /category:\s*hints\.category \|\| "未分类"/, "direct new preset category should use a neutral fallback");
  assert.match(draftSource, /folder:\s*hints\.folder \|\| "未归档"/, "direct new preset folder should use a neutral fallback");
});

test("training preset detail saves a visible local preset draft instead of only showing feedback", () => {
  const detailSource = trainingPresetDetailPageSource;

  assert.match(detailSource, /presetForm/, "preset detail should keep editable form fields in local state");
  assert.match(detailSource, /setPresetForm/, "preset field edits should update local form state");
  assert.match(detailSource, /handleUpdatePresetForm/, "preset detail should define a shared field updater");
  assert.match(detailSource, /value=\{presetForm\.title\}/, "preset name should render from local form state");
  assert.match(detailSource, /onChange=\{\(value\) => handleUpdatePresetForm\("title", value\)\}/, "preset name should update local form state");
  assert.match(detailSource, /presetDraft/, "preset detail should expose a local saved preset draft");
  assert.match(detailSource, /setPresetDraft/, "preset save action should update local preset state");
  assert.match(detailSource, /handleSavePreset/, "preset detail should define a save handler");
  assert.match(detailSource, /onClick=\{handleSavePreset\}/, "preset save button should call the local save handler");
  assert.match(detailSource, /预制保存草稿/, "preset detail should render a visible saved draft panel");
  assert.match(detailSource, /preset\.sceneDescriptionText/, "saved draft should preserve the scene description");
  assert.match(detailSource, /usages\.length/, "saved draft should include current usage impact");
});

test("training preset detail state stays scoped to the active preset context", () => {
  const detailSource = trainingPresetDetailPageSource;

  assert.match(detailSource, /presetFormContextId/, "preset detail should derive a route/query context id");
  assert.match(detailSource, /presetFormState/, "preset form fields should be stored with preset context");
  assert.match(detailSource, /presetDraftState/, "preset draft should be stored with preset context");
  assert.match(detailSource, /presetFormState\.contextId === presetFormContextId \? presetFormState\.form : initialPresetForm/, "preset fields should fall back after context changes");
  assert.match(detailSource, /presetDraftState\.contextId === presetFormContextId \? presetDraftState\.draft : null/, "preset draft should reset after context changes");
  assert.match(detailSource, /newPresetHints\.sourceRun/, "new preset context should include the source run hint");
  assert.match(detailSource, /newPresetHints\.artifact/, "new preset context should include the source artifact hint");
  assert.doesNotMatch(detailSource, /const \[presetForm, setPresetForm\] = useState\(/, "preset form should not be stored without preset context");
  assert.doesNotMatch(detailSource, /const \[presetDraft, setPresetDraft\] = useState/, "preset draft should not be stored without preset context");
});

test("training preset detail saves through the formal HTTP API on production routes", () => {
  const detailSource = trainingPresetDetailPageSource;

  assert.match(detailSource, /usePathname/, "preset detail should detect whether it is running under production \\/training routes");
  assert.match(detailSource, /fetch\(isNew \? "\/api\/training\/presets" : `\/api\/training\/presets\/\$\{preset\.id\}`/, "preset detail should save through the formal training preset API");
  assert.match(detailSource, /method:\s*isNew \? "POST" : "PATCH"/, "preset detail should choose POST or PATCH based on create vs edit mode");
  assert.match(detailSource, /sceneDescriptionText:\s*presetForm\.sceneDescriptionText/, "preset save should submit the current scene description text");
  assert.match(detailSource, /router\.push\(`\/training\/presets\/\$\{payload\.data\.id\}`\)/, "new presets should navigate to the created training preset route");
  assert.match(detailSource, /pushToast/, "preset detail should surface API success or failure through shared feedback");
});

test("training preset detail deletes through the formal cascade API on production routes", () => {
  const detailSource = trainingPresetDetailPageSource;

  assert.match(detailSource, /isDeletingPreset/, "preset detail should track delete request state");
  assert.match(detailSource, /handleDeletePreset/, "preset detail should define a delete handler");
  assert.match(detailSource, /fetch\(`\/api\/training\/scene-description\/presets\/\$\{preset\.id\}\/cascade`/, "preset detail should call the formal cascade delete API");
  assert.match(detailSource, /method:\s*"DELETE"/, "preset detail delete should use DELETE");
  assert.match(detailSource, /confirm:\s*true/, "preset detail delete should send the explicit cascade confirmation");
  assert.match(detailSource, /router\.push\("\/training\/presets"\)/, "preset detail delete should return to the preset library after success");
  assert.match(detailSource, /训练预制删除失败/, "preset detail delete should surface API failures through shared feedback");
});

test("training template form uses the shared template editor workspace model", () => {
  const formSource = trainingTemplateFormPageSource;
  const formWithRowSource = `${templateSectionRowSource}\n${formSource}`;

  assert.match(formSource, /WorkbenchSurface/, "template form should use the shared workbench surface");
  assert.match(formSource, /EditorBlock/, "template form should use editor blocks instead of generic panels");
  assert.match(formSource, /OperationStateStrip/, "template form should expose save/sort operation state");
  assert.match(formWithRowSource, /GripVertical/, "template section rows should expose drag handles");
  assert.match(formWithRowSource, /Copy/, "template section rows should expose copy actions");
  assert.match(formWithRowSource, /Trash2/, "template section rows should expose delete actions");
  assert.doesNotMatch(formSource, /className=\{s\.usageRow\}/, "template form should not use generic usage rows for editable sections");
  assert.match(cssSource, /\.trainingTemplateEditorSurface\b/, "template form should have a dedicated editor surface");
  assert.match(cssSource, /\.trainingTemplateSectionList\b[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "template sections should expand to two columns");
});

test("training template new form carries source project context", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(resourcePageUtilsSource, /type NewTemplateHints/, "template creation should define source-project hints");
  assert.match(resourcePageUtilsSource, /function readNewTemplateHints/, "template creation should read query hints");
  assert.match(resourcePageUtilsSource, /sourceProject:\s*searchParams\.get\("sourceProject"\)/, "template form should read source project title");
  assert.match(resourcePageUtilsSource, /sections:\s*searchParams\.get\("sections"\)/, "template form should read source section count");
  assert.match(formSource, /newTemplateHints/, "template form should derive hints in new mode");
  assert.match(formSource, /来源训练项目/, "new template form should show source project context");
  assert.match(formSource, /newTemplateHints\.sourceProject/, "source project field should only appear when project context exists");
});

test("training template direct creation does not silently apply the first template", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /const sourceProject = mode === "new"/, "new template creation should resolve project context explicitly");
  assert.match(formSource, /const seedTemplate = template;/, "direct template creation should start without an implicit template fixture");
  assert.match(formSource, /const templateSeedSections = sourceProject \? buildTemplateSectionsFromProject\(sourceProject\) : seedTemplate\?\.sections \?\? \[\];/, "project-sourced templates should seed from the selected project while direct creation stays empty");
  assert.match(formSource, /title:\s*newTemplateHints\.sourceProject \? `\$\{newTemplateHints\.sourceProject\} 训练模板` : seedTemplate\?\.title \?\? "新角色 LoRA 模板"/, "direct new template title should use a neutral draft title");
  assert.match(formSource, /没有初始小节/, "empty template creation should explain that sections can be added explicitly");
  assert.doesNotMatch(formSource, /const seedTemplate = template \?\? training\.templates\[0\];/, "direct new template creation should not silently reuse the first template");
});

test("training template new draft sections stay on the new-template route", () => {
  const rowSource = templateSectionRowSource;
  const formSource = trainingTemplateFormPageSource;

  assert.match(rowSource, /templateId\?: string;/, "template section rows should support unsaved template drafts");
  assert.match(rowSource, /const href = templateId \? `\/training\/templates\/\$\{templateId\}\/sections\/\$\{index\}` : "\/training\/templates\/new";/, "unsaved template draft rows should stay on the new-template route");
  assert.match(formSource, /templateId=\{mode === "edit" \? templateEditorId : undefined\}/, "new template rows should not receive a saved-template id");
});

test("training template new form keeps source project ids out of visible copy", () => {
  const formSource = trainingTemplateFormPageSource;
  const sourceFieldStart = formSource.indexOf('label="来源训练项目"');
  const nextFieldStart = formSource.indexOf('<Field multiline', sourceFieldStart);
  assert.notEqual(sourceFieldStart, -1);
  assert.notEqual(nextFieldStart, -1);

  const sourceFieldSource = formSource.slice(sourceFieldStart, nextFieldStart);

  assert.match(sourceFieldSource, /newTemplateHints\.sourceProject/, "source project copy should name the selected project");
  assert.match(sourceFieldSource, /newTemplateHints\.sections/, "source project copy may include the section count");
  assert.doesNotMatch(sourceFieldSource, /newTemplateHints\.projectId/, "source project copy should not expose the internal project id");
});

test("training template list creates projects with selected template context", () => {
  const templatesSource = trainingTemplatesPageSource;

  assert.match(resourcePageUtilsSource, /function createProjectFromTemplateHref/, "template list should build a concrete project-create href");
  assert.match(templatesSource, /createProjectFromTemplateHref\(template\)/, "template row create actions should carry the row template context");
  assert.match(templatesSource, /selectedVisibleTemplates\.length === 1 \? selectedVisibleTemplates\[0\] : null/, "top-level template create action should require one explicit selected template");
  assert.match(templatesSource, /ariaLabel=\{`从训练模板创建项目：\$\{projectTemplateSource\.title\}`\}/, "template-source create action should name the selected template");
  assert.match(resourcePageUtilsSource, /templateId:\s*template\.id/, "project-create href should include the template id");
  assert.match(resourcePageUtilsSource, /sections:\s*String\(template\.sections\.length\)/, "project-create href should include the template section count");
  assert.doesNotMatch(templatesSource, /visibleTemplates\[0\]/, "template create-project action should not silently use the first visible template");
  assert.doesNotMatch(templatesSource, /<ButtonLink href="\/training\/projects\/new" icon=\{CopyPlus\}>从模板创建项目<\/ButtonLink>/, "template create-project action should not navigate to a blank project form");
});

test("training template form saves a visible local template draft instead of only showing feedback", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /templateForm/, "template form should keep editable template fields in local state");
  assert.match(formSource, /setTemplateForm/, "template field edits should update local form state");
  assert.match(formSource, /handleUpdateTemplateForm/, "template form should define a shared field updater");
  assert.match(formSource, /value=\{templateForm\.title\}/, "template title should render from local form state");
  assert.match(formSource, /onChange=\{\(value\) => handleUpdateTemplateForm\("title", value\)\}/, "template title should update local form state");
  assert.match(formSource, /templateDraft/, "template form should expose a local saved template draft");
  assert.match(formSource, /setTemplateDraft/, "template save action should update local template state");
  assert.match(formSource, /handleSaveTemplate/, "template form should define a save handler");
  assert.match(formSource, /onClick=\{handleSaveTemplate\}/, "template save button should call the local save handler");
  assert.match(formSource, /模板保存草稿/, "template form should render a visible saved draft panel");
  assert.match(formSource, /templateSections\.length/, "saved draft should include the current section count");
  assert.doesNotMatch(formSource, /feedback=\{\{ title: "训练模板已创建"/, "new template save should not remain feedback-only");
  assert.doesNotMatch(formSource, /feedback=\{\{ title: "训练模板已保存"/, "template save should not remain feedback-only");
});

test("training template form saves through the formal HTTP API on production routes", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /usePathname/, "template form should detect whether it is running under production \\/training routes");
  assert.match(formSource, /useRouter/, "template form should be able to navigate to the saved training template on production routes");
  assert.match(formSource, /saveTemplateEndpoint/, "template form should derive the formal save endpoint before posting");
  assert.match(formSource, /fetch\(saveTemplateEndpoint/, "template form should call the resolved formal save endpoint");
  assert.match(formSource, /method:\s*saveTemplateMethod/, "template form should save through the resolved HTTP method");
  assert.match(formSource, /imageGuidance:/, "template form should send image guidance through the HTTP request");
  assert.match(formSource, /captionGuidance:/, "template form should send caption guidance through the HTTP request");
  assert.match(formSource, /sections:/, "template form should send the editable section list through the HTTP request");
  assert.match(formSource, /pushToast/, "template form should surface API success or failure through the shared feedback system");
});

test("training template form deletes through the formal HTTP API on production edit routes", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /isDeletingTemplate/, "template form should track delete request state");
  assert.match(formSource, /handleDeleteTemplate/, "template form should define a delete handler");
  assert.match(formSource, /mode === "edit"/, "template delete action should only apply to persisted edit routes");
  assert.match(formSource, /fetch\(`\/api\/training\/templates\/\$\{template\.id\}`/, "template form should call the formal template detail delete API");
  assert.match(formSource, /method:\s*"DELETE"/, "template form delete should use DELETE");
  assert.match(formSource, /router\.push\("\/training\/templates"\)/, "template form delete should return to the template list after success");
  assert.match(formSource, /训练模板删除失败/, "template form delete should surface API failures through the shared feedback system");
});

test("project-sourced template creation saves through the formal save-as-template API", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /const sourceProject = mode === "new"/, "project-backed template creation should resolve the source project explicitly");
  assert.match(formSource, /sourceProject && mode === "new"/, "save endpoint should branch when the template is sourced from a project");
  assert.match(formSource, /`\/api\/training\/projects\/\$\{sourceProject\.id\}\/save-as-template`/, "project-backed template creation should call the formal save-as-template route");
  assert.match(formSource, /const saveTemplateMethod = sourceProject && mode === "new"[\s\S]*?"POST"/, "project-backed template creation should submit through POST");
  assert.match(formSource, /const saveTemplateSections = orderedTemplateSectionIds/, "project-backed template save should derive payload sections from the current edited order");
  assert.match(formSource, /sections:\s*saveTemplateSections/, "project-backed template save should include the current edited section list");
});

test("training template form state stays scoped to the active template context", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /templateFormContextId/, "template form should derive a route/query context id");
  assert.match(formSource, /templateSectionState/, "template section list state should be stored with template context");
  assert.match(formSource, /templateFormState/, "template field state should be stored with template context");
  assert.match(formSource, /templateDraftState/, "template draft state should be stored with template context");
  assert.match(formSource, /templateSectionState\.contextId === templateFormContextId \? templateSectionState\.sections : templateSeedSections/, "template sections should fall back after context changes");
  assert.match(formSource, /templateFormState\.contextId === templateFormContextId \? templateFormState\.form : initialTemplateForm/, "template fields should fall back after context changes");
  assert.match(formSource, /templateDraftState\.contextId === templateFormContextId \? templateDraftState\.draft : null/, "template draft should reset after context changes");
  assert.doesNotMatch(formSource, /const \[localTemplateSections, setLocalTemplateSections\] = useState<LoraTrainingTemplateSection\[\]>/, "template sections should not be stored without template context");
  assert.doesNotMatch(formSource, /const \[orderedTemplateSectionIds, setOrderedTemplateSectionIds\] = useState\(\(\) => \(seedTemplate\?\.sections \?\? \[\]\)\.map/, "template order should not be stored without template context");
  assert.doesNotMatch(formSource, /const \[templateForm, setTemplateForm\] = useState\(/, "template form fields should not be stored without template context");
  assert.doesNotMatch(formSource, /const \[templateDraft, setTemplateDraft\] = useState/, "template draft should not be stored without template context");
});

test("training template form section actions update local front-end state", () => {
  const formSource = trainingTemplateFormPageSource;
  const rowSource = templateSectionRowSource;

  assert.match(formSource, /templateSections/, "template form should keep local editable sections");
  assert.match(formSource, /setLocalTemplateSections/, "template section actions should update local state");
  assert.match(formSource, /handleAddTemplateSection/, "template form should define local add behavior");
  assert.match(formSource, /handleCopyTemplateSection/, "template form should define local copy behavior");
  assert.match(formSource, /handleDeleteTemplateSection/, "template form should define local delete behavior");
  assert.match(formSource, /onClick=\{handleAddTemplateSection\}/, "add section action should be wired to local state");
  assert.match(rowSource, /onCopy\?\.\(section\)/, "template section copy button should call the copy handler");
  assert.match(rowSource, /onDelete\?\.\(section\.id\)/, "template section delete button should call the delete handler");
});

test("training template form section actions persist through formal HTTP APIs on production edit routes", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /usePathname/, "template form should detect whether it is running under production \\/training routes");
  assert.match(formSource, /mode === "edit"/, "template section mutations should distinguish persisted edit routes from new-template drafts");
  assert.match(formSource, /activeTemplateId = isProductionTrainingRoute && mode === "edit" \? template\?\.id : null/, "template section mutations should resolve the persisted template id before optimistic edits");
  assert.match(formSource, /fetch\(`\/api\/training\/templates\/\$\{activeTemplateId\}\/sections`/, "add and copy template section actions should call the formal template section collection API");
  assert.match(formSource, /sourceSectionId:\s*section\.id/, "template section copy should send the copied source section id");
  assert.match(formSource, /fetch\(`\/api\/training\/templates\/\$\{activeTemplateId\}\/sections\/\$\{sectionId\}`/, "template section delete should call the formal template section detail API");
  assert.match(formSource, /fetch\(`\/api\/training\/templates\/\$\{activeTemplateId\}\/sections\/reorder`/, "template section reorder should call the formal template section reorder API");
  assert.match(formSource, /method:\s*"DELETE"/, "template section delete should use DELETE");
  assert.match(formSource, /orderedSectionIds:\s*nextIds/, "template section reorder should submit the updated ordered ids");
  assert.match(formSource, /模板小节(创建|复制|删除|排序)失败/, "template section mutations should surface API failures through the shared feedback system");
});

test("training template form section mutation handlers guard concurrent actions before optimistic local state", () => {
  const formSource = trainingTemplateFormPageSource;

  for (const functionName of [
    "handleAddTemplateSection",
    "handleCopyTemplateSection",
    "handleDeleteTemplateSection",
    "handleReorderTemplateSections",
  ]) {
    const handler = nestedComponentFunctionSource(formSource, functionName);
    const guardMatch = handler.match(/if\s*\([^)]*isMutatingTemplateSections[^)]*\)\s*return;/);
    const guardIndex = guardMatch?.index ?? -1;
    const localMutationIndexes = [
      handler.indexOf("setLocalTemplateSections("),
      handler.indexOf("setOrderedTemplateSectionIds("),
    ].filter((index) => index !== -1);

    assert.notEqual(guardIndex, -1, `${functionName} should guard against concurrent template section mutations`);
    assert.ok(localMutationIndexes.length > 0, `${functionName} should still update local optimistic state after it is allowed to run`);
    assert.ok(
      guardIndex < Math.min(...localMutationIndexes),
      `${functionName} should not mutate local template section state while a production HTTP operation is in flight`,
    );
  }
});

test("training template section copy inserts the duplicate directly after the source section", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(formSource, /const sourceIndex = current\.findIndex\(\(item\) => item\.id === section\.id\)/, "template section copy should find the source section position");
  assert.match(formSource, /\.\.\.current\.slice\(0, sourceIndex \+ 1\),\s*copy,\s*\.\.\.current\.slice\(sourceIndex \+ 1\)/, "local template section copy should stay adjacent to the source");
  assert.match(formSource, /const sourceIndex = ids\.indexOf\(section\.id\)/, "template section copy should find the source id in visible order");
  assert.match(formSource, /\.\.\.ids\.slice\(0, sourceIndex \+ 1\),\s*copy\.id,\s*\.\.\.ids\.slice\(sourceIndex \+ 1\)/, "visible template section order should insert the copy after the source");
  assert.doesNotMatch(formSource, /setOrderedTemplateSectionIds\(\(ids\) => \[\.\.\.ids, copy\.id\]\)/, "template section copy should not append to the end of the section order");
});

test("training template form scans existing section ids for local copy and draft ids", () => {
  const formSource = trainingTemplateFormPageSource;

  assert.match(templatePageUtilsSource, /function nextTemplateSectionCopyNumber/, "template section copy ids should use a shared ordinal helper");
  assert.match(templatePageUtilsSource, /function nextTemplateSectionDraftNumber/, "new template section draft ids should use a shared ordinal helper");
  assert.match(formSource, /nextTemplateSectionCopyNumber\(templateSections, section\.id\)/, "template copy ids should scan existing copied section ids");
  assert.match(formSource, /nextTemplateSectionDraftNumber\(current\)/, "new template section ids should scan existing draft section ids");
  assert.doesNotMatch(formSource, /id:\s*`\$\{section\.id\}-copy-\$\{Date\.now\(\)\}`/, "template copy ids should not depend on Date.now");
  assert.doesNotMatch(formSource, /id:\s*`new-template-section-\$\{Date\.now\(\)\}`/, "new template section ids should not depend on Date.now");
});

test("training template section page saves through the formal HTTP API on production routes", () => {
  const sectionSource = trainingTemplateSectionPageSource;

  assert.match(sectionSource, /usePathname/, "template section page should detect whether it is running under production \\/training routes");
  assert.match(sectionSource, /fetch\(`\/api\/training\/templates\/\$\{activeTemplate\.id\}\/sections\/\$\{activeSection\.id\}`/, "template section page should call the formal training template section API");
  assert.match(sectionSource, /method:\s*"PATCH"/, "template section page should save through PATCH");
  assert.match(sectionSource, /enabled:/, "template section page should send the enabled state through the HTTP request");
  assert.match(sectionSource, /blocks:/, "template section page should send the editable scene blocks through the HTTP request");
  assert.match(sectionSource, /pushToast/, "template section page should surface API success or failure through the shared feedback system");
});

test("training template form section rows are actually sortable", () => {
  const formSource = trainingTemplateFormPageSource;
  const rowSource = templateSectionRowSource;

  assert.match(formSource, /orderedTemplateSectionIds/, "template form should keep an explicit section sort order");
  assert.match(formSource, /setOrderedTemplateSectionIds/, "template section reorder should update local order state");
  assert.match(formSource, /handleReorderTemplateSections/, "template form should define a reorder handler");
  assert.match(formSource, /<SortableList items=\{orderedTemplateSectionIds\} onReorder=\{handleReorderTemplateSections\}>/, "template sections should use the shared sortable wrapper");
  assert.match(rowSource, /useDemoSortable\(section\.id\)/, "template section rows should attach sortable behavior to each row");
  assert.match(rowSource, /handleProps/, "template section rows should pass drag handle props to the visible handle");
  assert.match(rowSource, /ref=\{ref\}/, "template section rows should apply sortable refs");
});

test("training template list follows the template-list surface with local delete state", () => {
  const templatesSource = trainingTemplatesPageSource;
  const templateListSource = `${templateListPrimitivesSource}\n${templatesSource}`;

  assert.match(templatesSource, /hiddenTemplateIds/, "template list should keep locally hidden templates");
  assert.match(templatesSource, /visibleTemplates/, "template list should render from local visible template state");
  assert.match(templatesSource, /hideTemplate/, "template list should define a local delete handler");
  assert.match(templateListSource, /onDelete=\{\(\) => hideTemplate\(template\.id\)\}/, "delete action should remove a template locally");
  assert.match(templateListSource, /template\.sections\.slice\(0,\s*5\)/, "template cards should keep section chips compact");
  assert.match(templateListSource, /template\.sections\.length > 5/, "template cards should show overflow count for extra sections");
  assert.doesNotMatch(templatesSource, /training\.templates\.map/, "template list should not render directly from immutable fixtures");
  assert.match(cssSource, /\.trainingTemplateListSurface\b[\s\S]*?container-type:\s*inline-size/, "template list should have a container-query surface");
  assert.match(
    cssSource,
    /@container\s*\(min-width:\s*720px\)\s*\{[\s\S]*?\.trainingTemplateList\s*\{[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "template list should wait for desktop workspace width before expanding to two columns",
  );
  assert.match(cssSource, /\.trainingTemplateListItem\b/, "template cards should use a dedicated list-item class");
});

test("training template list keeps card actions grouped by priority", () => {
  assert.match(trainingTemplatesPageSource, /export function LoraTrainingTemplatesPage\b/, "training templates source should be readable");

  const itemSource = templateListPrimitivesSource;
  const actionRule = cssSource.match(/\.trainingTemplateListActions\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(itemSource, /className=\{s\.trainingTemplateListCreateButton\}/, "template card should make create-project the primary action");
  assert.match(itemSource, /className=\{s\.trainingTemplateListSecondaryActions\}/, "template card should group edit and delete as secondary tools");
  assert.match(itemSource, /iconOnly[\s\S]*ariaLabel=\{`编辑训练模板：/, "template edit action should be an icon tool with an accessible label");
  assert.match(
    itemSource,
    /className=\{s\.trainingTemplateListDeleteButton\}[\s\S]*iconOnly[\s\S]*ariaLabel=\{`删除训练模板：/,
    "template delete action should be an icon danger tool with an accessible label",
  );
  assert.match(actionRule, /display:\s*grid/, "template card actions should stack as a controlled primary-plus-tools group");
  assert.doesNotMatch(actionRule, /flex-wrap/, "template card actions should not wrap three text buttons into a tall column");
});

test("training template list deletes through the formal HTTP API on production routes", () => {
  const templatesSource = trainingTemplatesPageSource;

  assert.match(templatesSource, /usePathname/, "template list should detect whether it is running under production \\/training routes");
  assert.match(templatesSource, /fetch\(`\/api\/training\/templates\/\$\{templateId\}`/, "template delete should call the formal training template API");
  assert.match(templatesSource, /method:\s*"DELETE"/, "template delete should use DELETE");
  assert.match(templatesSource, /Promise\.all/, "batch template delete should persist all selected templates before hiding them");
  assert.match(templatesSource, /pushToast/, "template delete should surface API success or failure through the shared feedback system");
});

test("training template list exposes managed object controls and local ordering", () => {
  const itemSource = templateListPrimitivesSource;
  const templatesSource = trainingTemplatesPageSource;

  assert.match(templatesSource, /selectedTemplateIds/, "template list should keep selected template ids in local state");
  assert.match(templatesSource, /orderedTemplateIds/, "template list should keep a local template order");
  assert.match(templatesSource, /handleReorderTemplates/, "template list should define a reorder handler");
  assert.match(templatesSource, /handleRemoveSelectedTemplates/, "template list should define a selected delete handler");
  assert.match(templatesSource, /SelectionBatchBar/, "template list should expose batch actions after selection");
  assert.match(templatesSource, /<SortableList items=\{visibleTemplateIds\} onReorder=\{handleReorderTemplates\}>/, "template list should use the shared sortable wrapper");
  assert.match(itemSource, /Checkbox/, "template items should expose a leading selection control");
  assert.match(itemSource, /trainingTemplateListHandle/, "template items should expose a leading drag handle");
  assert.match(itemSource, /useDemoSortable\(template\.id\)/, "template items should attach sortable behavior to each row");
  assert.match(itemSource, /ref=\{ref\}/, "template items should apply sortable refs");
  assert.match(itemSource, /style=\{style\}/, "template items should apply sortable transforms");
  assert.match(cssSource, /\.trainingTemplateListControls\b/, "template cards should have a dedicated leading control column");
});

test("training template list persists reorder through the formal HTTP API on production routes", () => {
  const templatesSource = trainingTemplatesPageSource;

  assert.match(templatesSource, /usePathname/, "template list should detect whether it is running under production \\/training routes");
  assert.match(templatesSource, /fetch\("\/api\/training\/templates\/reorder"/, "template reorder should call the formal template reorder API");
  assert.match(templatesSource, /orderedTemplateIds\.map\(\(templateId\) =>/, "template reorder should preserve hidden rows while reordering visible templates");
  assert.match(templatesSource, /setOrderedTemplateIds\(previousIds\)/, "template reorder should roll back local order when persistence fails");
  assert.match(templatesSource, /训练模板排序保存失败/, "template reorder should expose save failures through the shared feedback system");
});

test("training preset detail and sort rules reuse editor/sort shells without regular preset dimensions", () => {
  const detailSource = trainingPresetDetailPageSource;
  const sortSource = presetSortRulesPageSource;
  const sortWithPanelSource = presetSortPanelSource;

  assert.match(detailSource, /WorkbenchSurface/, "preset detail should use the shared editor surface");
  assert.match(detailSource, /EditorBlock/, "preset detail should use editor blocks");
  assert.match(detailSource, /OperationStateStrip/, "preset detail should expose save/delete state");
  assert.doesNotMatch(detailSource, /positivePrompt|negativePrompt|loraStages|variants/, "training preset detail must stay scene-description only");
  assert.match(sortWithPanelSource, /SortableRowShell/, "training preset sort rules should use the shared sortable row shell");
  assert.match(cssSource, /\.trainingPresetSortGrid\b[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "training preset sort panels should expand to two columns");
  assert.doesNotMatch(sortSource, /正向 Prompt|反向 Prompt|LoRA 1|LoRA 2/, "training preset sort rules should not inherit regular preset dimensions");
});

test("training preset sort rules keep local order state and save a visible draft", () => {
  const sortSource = presetSortRulesPageSource;
  const panelSource = presetSortPanelSource;

  assert.match(sortSource, /orderedCategoryIds/, "category sort order should live in local state");
  assert.match(sortSource, /setOrderedCategoryIds/, "category reorder should update local state");
  assert.match(sortSource, /orderedPresetIds/, "preset sort order should live in local state");
  assert.match(sortSource, /setOrderedPresetIds/, "preset reorder should update local state");
  assert.match(sortSource, /sortRulesDraft/, "save all should expose a local sort draft");
  assert.match(sortSource, /setSortRulesDraft/, "save all should update the visible sort draft");
  assert.match(sortSource, /buildTrainingPresetSortRulesDraft/, "sort page should build visible sort drafts through the focused helper");
  assert.match(sortSource, /handleSaveSortRules/, "sort page should define a save-all handler");
  assert.match(sortSource, /onClick=\{handleSaveSortRules\}/, "save-all action should call the local save handler");
  assert.match(sortSource, /排序保存草稿/, "sort page should render the visible saved draft panel");
  assert.match(panelSource, /SortableList/, "sort panels should use the shared sortable list wrapper");
  assert.match(panelSource, /useDemoSortable/, "sort rows should expose sortable handles");
  assert.match(panelSource, /onReorder/, "sort panels should receive a reorder callback");
});

test("training preset sort rules save through the formal HTTP API on production routes", () => {
  const sortSource = presetSortRulesPageSource;

  assert.match(sortSource, /usePathname/, "training preset sort rules should detect whether they are running under production \\/training routes");
  assert.match(sortSource, /fetch\("\/api\/training\/presets\/sort-rules"/, "training preset sort rules should save through the formal HTTP API");
  assert.match(sortSource, /method:\s*"POST"/, "training preset sort rules should POST the sort payload");
  assert.match(sortSource, /categoryOrder:\s*orderedCategoryIds/, "training preset sort rules should submit the category order");
  assert.match(sortSource, /presetOrder:\s*orderedPresetIds/, "training preset sort rules should submit the preset order");
  assert.match(sortSource, /pushToast/, "training preset sort rules should surface API success or failure through the shared feedback system");
});

test("training preset sort panel save buttons do not override HTTP result feedback", () => {
  const panelStart = presetSortPanelSource.indexOf("function TrainingPresetSortPanel");
  const panelEnd = presetSortPanelSource.indexOf("function TrainingPresetSortableSortRow");
  assert.notEqual(panelStart, -1);
  assert.notEqual(panelEnd, -1);

  const panelSource = presetSortPanelSource.slice(panelStart, panelEnd);

  assert.doesNotMatch(
    panelSource,
    /feedback=\{\{[\s\S]*?保存草稿已记录/,
    "Sort panel save buttons should let the route-level HTTP save handler own success/failure feedback.",
  );
});

test("training preset sort mobile footer keeps save actions compact", () => {
  assert.doesNotMatch(
    cssSource,
    /\.trainingPresetEditorHeader,\s*\.trainingPresetSortHeader,\s*\.trainingPresetSortFooter\s*\{\s*align-items:\s*stretch;\s*flex-direction:\s*column;\s*\}/,
    "Mobile sort footers should not inherit the stretched header layout that makes save buttons full-width",
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?\.trainingPresetSortFooter\s*\{[\s\S]*?align-items:\s*flex-start[\s\S]*?flex-direction:\s*column/,
    "Mobile sort footers should stack content while keeping actions sized to their content",
  );
  assert.match(
    cssSource,
    /\.trainingPresetSortFooter\s+:where\(\[data-demo-ui-button="true"\]\)\s*\{[\s\S]*?align-self:\s*flex-start/,
    "Sort footer save buttons should explicitly align to the start instead of stretching",
  );
});
