import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(testDir, "training-resource-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-resource-pages.module.css"), "utf8");

test("training resource pages keep backend wiring notes out of user-facing copy", () => {
  assert.doesNotMatch(pageSource, /后端接入时/, "training resource UI should not expose backend integration notes");
});

test("training resource delete actions describe local removal instead of confirmation placeholders", () => {
  assert.doesNotMatch(pageSource, /删除训练预制需要确认/, "single preset delete feedback should describe the local list removal");
  assert.doesNotMatch(pageSource, /批量删除训练预制需要确认/, "batch preset delete feedback should describe the local list removal");
  assert.doesNotMatch(pageSource, /删除训练模板小节需要确认/, "template section delete feedback should describe the local draft removal");
});

test("training resource pages use product-facing copy instead of internal prompt schema terms", () => {
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const presetDetailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  const sortStart = pageSource.indexOf("export function LoraTrainingPresetSortRulesPage");
  const templatesStart = pageSource.indexOf("function templateStatus");
  const templateFormStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const templateSectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");

  assert.notEqual(presetsStart, -1);
  assert.notEqual(presetDetailStart, -1);
  assert.notEqual(sortStart, -1);
  assert.notEqual(templatesStart, -1);
  assert.notEqual(templateFormStart, -1);
  assert.notEqual(templateSectionStart, -1);

  const visibleResourceCopy = [
    pageSource.slice(presetsStart, presetDetailStart),
    pageSource.slice(presetDetailStart, sortStart),
    pageSource.slice(sortStart, templatesStart),
    pageSource.slice(templatesStart, templateFormStart),
    pageSource.slice(templateFormStart, templateSectionStart),
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
  ].forEach((pattern) => {
    assert.doesNotMatch(visibleResourceCopy, pattern, `training resource pages should hide internal copy: ${pattern}`);
  });
});

test("training preset library uses the shared managed-library row model", () => {
  const itemStart = pageSource.indexOf("function TrainingPresetLibraryItemRow");
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  assert.notEqual(itemStart, -1);
  assert.notEqual(presetsStart, -1);
  assert.notEqual(detailStart, -1);

  const presetsSource = pageSource.slice(presetsStart, detailStart);
  const presetsWithItemSource = pageSource.slice(itemStart, detailStart);

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
    /@container \(min-width: 520px\) \{\s*\.trainingPresetFolderGrid,\s*\.trainingPresetItemList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "training preset folders and items should expand together at the project-demo library breakpoint",
  );
});

test("training preset library drag handles reorder visible presets locally", () => {
  const itemStart = pageSource.indexOf("function TrainingPresetLibraryItemRow");
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  assert.notEqual(itemStart, -1);
  assert.notEqual(presetsStart, -1);
  assert.notEqual(detailStart, -1);

  const itemSource = pageSource.slice(itemStart, presetsStart);
  const presetsSource = pageSource.slice(presetsStart, detailStart);

  assert.match(presetsSource, /orderedPresetIds/, "training preset library should keep a local preset order");
  assert.match(presetsSource, /visiblePresetIds/, "training preset library should derive the currently visible sortable ids");
  assert.match(presetsSource, /handleReorderPresets/, "training preset library should define a local reorder handler");
  assert.match(presetsSource, /<SortableList items=\{visiblePresetIds\} onReorder=\{handleReorderPresets\}>/, "visible training presets should use the shared sortable wrapper");
  assert.match(itemSource, /useDemoSortable\(preset\.id\)/, "training preset rows should attach sortable behavior to each row");
  assert.match(itemSource, /ref=\{ref\}/, "training preset rows should apply sortable refs");
  assert.match(itemSource, /style=\{style\}/, "training preset rows should apply sortable transforms");
  assert.match(itemSource, /\{\.\.\.handleProps\}/, "training preset row drag handles should receive sortable handle props");
});

test("training preset category rail drag handles reorder categories locally", () => {
  const categoryItemStart = pageSource.indexOf("function TrainingPresetCategoryRailItem");
  const presetsStart = pageSource.indexOf("export function LoraTrainingPresetsPage");
  const detailStart = pageSource.indexOf("export function LoraTrainingPresetDetailPage");
  assert.notEqual(categoryItemStart, -1);
  assert.notEqual(presetsStart, -1);
  assert.notEqual(detailStart, -1);

  const categoryItemSource = pageSource.slice(categoryItemStart, presetsStart);
  const presetsSource = pageSource.slice(presetsStart, detailStart);

  assert.match(presetsSource, /orderedPresetCategories/, "training preset category rail should keep local category order");
  assert.match(presetsSource, /setOrderedPresetCategories/, "category rail reorder should update local state");
  assert.match(presetsSource, /<SortableList items=\{orderedPresetCategories\} onReorder=\{setOrderedPresetCategories\}>/, "category rail should use the shared sortable wrapper");
  assert.match(categoryItemSource, /useDemoSortable\(category\)/, "category rail items should attach sortable behavior to each category");
  assert.match(categoryItemSource, /ref=\{ref\}/, "category rail items should apply sortable refs");
  assert.match(categoryItemSource, /style=\{style\}/, "category rail items should apply sortable transforms");
  assert.match(categoryItemSource, /\{\.\.\.handleProps\}/, "category drag handles should receive sortable handle props");
  assert.match(cssSource, /\.resourceRailDragHandle\b/, "category rail should style a dedicated drag handle");
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

test("training template list creates projects with selected template context", () => {
  const templatesStart = pageSource.indexOf("export function LoraTrainingTemplatesPage");
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  assert.notEqual(templatesStart, -1);
  assert.notEqual(formStart, -1);

  const templatesSource = pageSource.slice(templatesStart, formStart);

  assert.match(pageSource, /function createProjectFromTemplateHref/, "template list should build a concrete project-create href");
  assert.match(templatesSource, /createProjectFromTemplateHref\(template\)/, "template row create actions should carry the row template context");
  assert.match(pageSource, /templateId:\s*template\.id/, "project-create href should include the template id");
  assert.match(pageSource, /sections:\s*String\(template\.sections\.length\)/, "project-create href should include the template section count");
  assert.doesNotMatch(templatesSource, /<ButtonLink href="\/training\/projects\/new" icon=\{CopyPlus\}>从模板创建项目<\/ButtonLink>/, "template create-project action should not navigate to a blank project form");
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

test("training template section copy inserts the duplicate directly after the source section", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);

  assert.match(formSource, /const sourceIndex = current\.findIndex\(\(item\) => item\.id === section\.id\)/, "template section copy should find the source section position");
  assert.match(formSource, /\.\.\.current\.slice\(0, sourceIndex \+ 1\),\s*copy,\s*\.\.\.current\.slice\(sourceIndex \+ 1\)/, "local template section copy should stay adjacent to the source");
  assert.match(formSource, /const sourceIndex = ids\.indexOf\(section\.id\)/, "template section copy should find the source id in visible order");
  assert.match(formSource, /\.\.\.ids\.slice\(0, sourceIndex \+ 1\),\s*copy\.id,\s*\.\.\.ids\.slice\(sourceIndex \+ 1\)/, "visible template section order should insert the copy after the source");
  assert.doesNotMatch(formSource, /setOrderedTemplateSectionIds\(\(ids\) => \[\.\.\.ids, copy\.id\]\)/, "template section copy should not append to the end of the section order");
});

test("training template form scans existing section ids for local copy and draft ids", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);

  assert.match(pageSource, /function nextTemplateSectionCopyNumber/, "template section copy ids should use a shared ordinal helper");
  assert.match(pageSource, /function nextTemplateSectionDraftNumber/, "new template section draft ids should use a shared ordinal helper");
  assert.match(formSource, /nextTemplateSectionCopyNumber\(localTemplateSections, section\.id\)/, "template copy ids should scan existing copied section ids");
  assert.match(formSource, /nextTemplateSectionDraftNumber\(current\)/, "new template section ids should scan existing draft section ids");
  assert.doesNotMatch(formSource, /id:\s*`\$\{section\.id\}-copy-\$\{Date\.now\(\)\}`/, "template copy ids should not depend on Date.now");
  assert.doesNotMatch(formSource, /id:\s*`new-template-section-\$\{Date\.now\(\)\}`/, "new template section ids should not depend on Date.now");
});

test("training template form section rows are actually sortable", () => {
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  const rowStart = pageSource.indexOf("function TemplateEditorSectionRow");
  const sectionStart = pageSource.indexOf("export function LoraTrainingTemplateSectionPage");
  assert.notEqual(rowStart, -1);
  assert.notEqual(formStart, -1);
  assert.notEqual(sectionStart, -1);

  const formSource = pageSource.slice(formStart, sectionStart);
  const rowSource = pageSource.slice(rowStart, formStart);

  assert.match(formSource, /orderedTemplateSectionIds/, "template form should keep an explicit section sort order");
  assert.match(formSource, /setOrderedTemplateSectionIds/, "template section reorder should update local order state");
  assert.match(formSource, /handleReorderTemplateSections/, "template form should define a reorder handler");
  assert.match(formSource, /<SortableList items=\{orderedTemplateSectionIds\} onReorder=\{handleReorderTemplateSections\}>/, "template sections should use the shared sortable wrapper");
  assert.match(rowSource, /useDemoSortable\(section\.id\)/, "template section rows should attach sortable behavior to each row");
  assert.match(rowSource, /handleProps/, "template section rows should pass drag handle props to the visible handle");
  assert.match(rowSource, /ref=\{ref\}/, "template section rows should apply sortable refs");
});

test("training template list follows the template-list surface with local delete state", () => {
  const itemStart = pageSource.indexOf("function TrainingTemplateListItem");
  const templatesStart = pageSource.indexOf("export function LoraTrainingTemplatesPage");
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  assert.notEqual(itemStart, -1);
  assert.notEqual(templatesStart, -1);
  assert.notEqual(formStart, -1);

  const templatesSource = pageSource.slice(templatesStart, formStart);
  const templateListSource = pageSource.slice(itemStart, formStart);

  assert.match(templatesSource, /hiddenTemplateIds/, "template list should keep locally hidden templates");
  assert.match(templatesSource, /visibleTemplates/, "template list should render from local visible template state");
  assert.match(templatesSource, /hideTemplate/, "template list should define a local delete handler");
  assert.match(templateListSource, /onDelete=\{\(\) => hideTemplate\(template\.id\)\}/, "delete action should remove a template locally");
  assert.match(templateListSource, /template\.sections\.slice\(0,\s*5\)/, "template cards should keep section chips compact");
  assert.match(templateListSource, /template\.sections\.length > 5/, "template cards should show overflow count for extra sections");
  assert.doesNotMatch(templatesSource, /training\.templates\.map/, "template list should not render directly from immutable fixtures");
  assert.match(cssSource, /\.trainingTemplateList\b[\s\S]*?container-type:\s*inline-size/, "template list should have a container-query surface");
  assert.match(cssSource, /\.trainingTemplateList\b[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "template list should expand to two columns when there is enough width");
  assert.match(cssSource, /\.trainingTemplateListItem\b/, "template cards should use a dedicated list-item class");
});

test("training template list exposes managed object controls and local ordering", () => {
  const itemStart = pageSource.indexOf("function TrainingTemplateListItem");
  const templatesStart = pageSource.indexOf("export function LoraTrainingTemplatesPage");
  const formStart = pageSource.indexOf("export function LoraTrainingTemplateFormPage");
  assert.notEqual(itemStart, -1);
  assert.notEqual(templatesStart, -1);
  assert.notEqual(formStart, -1);

  const itemSource = pageSource.slice(itemStart, templatesStart);
  const templatesSource = pageSource.slice(templatesStart, formStart);

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
