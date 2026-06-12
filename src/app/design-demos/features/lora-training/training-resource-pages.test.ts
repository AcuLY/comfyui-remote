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

test("training preset new actions route into a real new-preset form", () => {
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  assert.notEqual(presetsStart, -1);
  assert.notEqual(detailStart, -1);
  assert.notEqual(sortStart, -1);

  const presetsSource = pageSource.slice(presetsStart, detailStart);
  const detailSource = pageSource.slice(detailStart, sortStart);

  assert.match(presetsSource, /<ButtonLink href="\/training\/presets\/new" icon=\{Plus\} tone="primary">新建<\/ButtonLink>/, "global new action should navigate to the new training preset route");
  assert.match(presetsSource, /newPresetInCategoryHref/, "category-scoped new action should preserve the active category");
  assert.match(presetsSource, /href=\{newPresetInCategoryHref\}/, "category-scoped new action should be a link, not a feedback-only button");
  assert.doesNotMatch(presetsSource, /新建训练预制入口已预览/, "new preset actions should not be fake preview feedback");
  assert.match(detailSource, /mode === "new"/, "preset editor should expose a real new mode");
  assert.match(detailSource, /草稿/, "new preset editor should show draft state");
  assert.doesNotMatch(detailSource, /positivePrompt|negativePrompt|loraStages|variants/, "training preset editor must stay scene-description only in new mode");
});

test("training preset new form carries source training artifact context", () => {
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  assert.notEqual(detailStart, -1);
  assert.notEqual(sortStart, -1);

  const detailSource = pageSource.slice(detailStart, sortStart);

  assert.match(pageSource, /sourceRun:\s*searchParams\.get\("sourceRun"\)/, "new preset hints should read source training run id");
  assert.match(pageSource, /artifact:\s*searchParams\.get\("artifact"\)/, "new preset hints should read source artifact name");
  assert.match(pageSource, /project:\s*searchParams\.get\("project"\)/, "new preset hints should read source project title");
  assert.match(detailSource, /来源训练产物/, "new preset form should show source artifact context");
  assert.match(detailSource, /newPresetHints\.artifact/, "source artifact field should only appear when artifact context exists");
});

test("training preset detail saves a visible local preset draft instead of only showing feedback", () => {
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  assert.notEqual(detailStart, -1);
  assert.notEqual(sortStart, -1);

  const detailSource = pageSource.slice(detailStart, sortStart);

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
  assert.doesNotMatch(detailSource, /训练预制已创建/, "new preset save should not remain feedback-only");
  assert.doesNotMatch(detailSource, /训练预制已保存/, "preset save should not remain feedback-only");
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

test("training template new form carries source project context", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);

  assert.match(pageSource, /type NewTemplateHints/, "template creation should define source-project hints");
  assert.match(pageSource, /function readNewTemplateHints/, "template creation should read query hints");
  assert.match(pageSource, /sourceProject:\s*searchParams\.get\("sourceProject"\)/, "template form should read source project title");
  assert.match(pageSource, /sections:\s*searchParams\.get\("sections"\)/, "template form should read source section count");
  assert.match(formSource, /newTemplateHints/, "template form should derive hints in new mode");
  assert.match(formSource, /来源训练项目/, "new template form should show source project context");
  assert.match(formSource, /newTemplateHints\.sourceProject/, "source project field should only appear when project context exists");
});

test("training template form saves a visible local template draft instead of only showing feedback", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);

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
  assert.doesNotMatch(formSource, /训练模板已创建/, "new template save should not remain feedback-only");
  assert.doesNotMatch(formSource, /训练模板已保存/, "template save should not remain feedback-only");
});

test("training template form section actions update local front-end state", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const rowStart = pageSource.indexOf("function TemplateEditorSectionRow");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(rowStart, -1);
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);
  const rowSource = pageSource.slice(rowStart, formStart);

  assert.match(formSource, /localTemplateSections/, "template form should keep local editable sections");
  assert.match(formSource, /setLocalTemplateSections/, "template section actions should update local state");
  assert.match(formSource, /handleAddTemplateSection/, "template form should define local add behavior");
  assert.match(formSource, /handleCopyTemplateSection/, "template form should define local copy behavior");
  assert.match(formSource, /handleDeleteTemplateSection/, "template form should define local delete behavior");
  assert.match(formSource, /onClick=\{handleAddTemplateSection\}/, "add section action should be wired to local state");
  assert.match(rowSource, /onCopy\?\.\(section\)/, "template section copy button should call the copy handler");
  assert.match(rowSource, /onDelete\?\.\(section\.id\)/, "template section delete button should call the delete handler");
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

test("training preset sort rules keep local order state and save a visible draft", () => {
  const sortPanelStart = pageSource.indexOf("function TrainingPresetSortPanel");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  const templatesStart = pageSource.indexOf("function templateStatus");
  assert.notEqual(sortPanelStart, -1);
  assert.notEqual(sortStart, -1);
  assert.notEqual(templatesStart, -1);

  const sortSource = pageSource.slice(sortStart, templatesStart);
  const panelSource = pageSource.slice(sortPanelStart, templatesStart);

  assert.match(sortSource, /orderedCategoryIds/, "category sort order should live in local state");
  assert.match(sortSource, /setOrderedCategoryIds/, "category reorder should update local state");
  assert.match(sortSource, /orderedPresetIds/, "preset sort order should live in local state");
  assert.match(sortSource, /setOrderedPresetIds/, "preset reorder should update local state");
  assert.match(sortSource, /sortRulesDraft/, "save all should expose a local sort draft");
  assert.match(sortSource, /setSortRulesDraft/, "save all should update the visible sort draft");
  assert.match(sortSource, /handleSaveSortRules/, "sort page should define a save-all handler");
  assert.match(sortSource, /onClick=\{handleSaveSortRules\}/, "save-all action should call the local save handler");
  assert.match(sortSource, /排序保存草稿/, "sort page should render the visible saved draft panel");
  assert.match(panelSource, /SortableList/, "sort panels should use the shared sortable list wrapper");
  assert.match(panelSource, /useDemoSortable/, "sort rows should expose sortable handles");
  assert.match(panelSource, /onReorder/, "sort panels should receive a reorder callback");
  assert.doesNotMatch(sortSource, /feedback="排序规则已保存"/, "save-all should not remain feedback-only");
  assert.doesNotMatch(panelSource, /排序已保存/, "group save should not remain feedback-only");
});
