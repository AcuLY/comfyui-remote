import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(testDir, "training-resource-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-resource-pages.module.css"), "utf8");

test("training preset library uses the shared managed-library row model", () => {
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  assert.notEqual(presetsStart, -1);
  assert.notEqual(detailStart, -1);

  const presetsSource = pageSource.slice(presetsStart, detailStart);

  assert.match(presetsSource, /UnitRowShell/, "training presets should use the shared managed row shell");
  assert.match(presetsSource, /Checkbox/, "training presets should expose row selection controls");
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

test("training template form uses the shared template editor workspace model", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const rowStart = pageSource.indexOf("function TemplateEditorSectionRow");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(rowStart, -1);
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);
  const formWithRowSource = pageSource.slice(rowStart, sectionStart);

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

test("training preset detail and sort rules reuse editor/sort shells without regular preset dimensions", () => {
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  const sortPanelStart = pageSource.indexOf("function TrainingPresetSortPanel");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  const templatesStart = pageSource.indexOf("function templateStatus");
  assert.notEqual(detailStart, -1);
  assert.notEqual(sortPanelStart, -1);
  assert.notEqual(sortStart, -1);
  assert.notEqual(templatesStart, -1);

  const detailSource = pageSource.slice(detailStart, sortStart);
  const sortSource = pageSource.slice(sortStart, templatesStart);
  const sortWithPanelSource = pageSource.slice(sortPanelStart, templatesStart);

  assert.match(detailSource, /WorkbenchSurface/, "preset detail should use the shared editor surface");
  assert.match(detailSource, /EditorBlock/, "preset detail should use editor blocks");
  assert.match(detailSource, /OperationStateStrip/, "preset detail should expose save/delete state");
  assert.doesNotMatch(detailSource, /positivePrompt|negativePrompt|loraStages|variants/, "training preset detail must stay scene-description only");
  assert.match(sortWithPanelSource, /SortableRowShell/, "training preset sort rules should use the shared sortable row shell");
  assert.match(cssSource, /\.trainingPresetSortGrid\b[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "training preset sort panels should expand to two columns");
  assert.doesNotMatch(sortSource, /正向 Prompt|反向 Prompt|LoRA 1|LoRA 2/, "training preset sort rules should not inherit regular preset dimensions");
});
