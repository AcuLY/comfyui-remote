import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pagesSource = readFileSync(resolve(testDir, "training-project-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-project-pages.module.css"), "utf8");

function sourceBetween(startMarker: string, endMarker: string) {
  const start = pagesSource.indexOf(startMarker);
  const end = pagesSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return pagesSource.slice(start, end);
}

test("training section list uses the same management shell as design-demo sections", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(sectionsPage, /TrainingSectionWorkspace/, "section list should render inside a rail + scroll workspace");
  assert.match(sectionsPage, /activeSectionId/, "section workspace should know the active section");
  assert.match(sectionCard, /limit=\{4\}/, "section cards should keep fixed four-thumbnail result slots");
  assert.match(sectionCard, /Copy/, "section cards should expose an independent copy action");
  assert.match(sectionCard, /Trash2/, "section cards should expose an independent delete action");
  assert.match(sectionCard, /generation-tasks\/new/, "section cards should expose an independent generation action");
});

test("training section list copy and delete actions update local front-end state", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(sectionsPage, /localSections/, "section list should keep a local editable section list");
  assert.match(sectionsPage, /setLocalSections/, "section copy/delete should update local state without needing backend calls");
  assert.match(sectionsPage, /handleCopySection/, "section list should define a copy action");
  assert.match(sectionsPage, /handleDeleteSection/, "section list should define a delete action");
  assert.match(sectionsPage, /sections=\{sections\}/, "section rail should follow the same local list as the cards");
  assert.match(sectionCard, /onCopy\?\.\(section\)/, "copy button should call the section copy handler");
  assert.match(sectionCard, /onDelete\?\.\(section\.id\)/, "delete button should call the section delete handler");
});

test("training section list drag handles reorder the local section list", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(sectionsPage, /orderedSectionIds/, "section list should keep local section ordering state");
  assert.match(sectionsPage, /handleReorderSections/, "section list should define a local reorder handler");
  assert.match(sectionsPage, /<SortableList items=\{orderedSectionIds\} onReorder=\{handleReorderSections\}>/, "section list should wrap cards in SortableList");
  assert.match(sectionsPage, /orderedSectionIds\.map/, "section cards should render in the local drag order");
  assert.match(sectionCard, /useDemoSortable\(section\.id\)/, "section card drag handle should be connected to sortable state");
  assert.match(sectionCard, /\{\.\.\.handleProps\}/, "section card drag handle should receive sortable handle props");
});

test("training section list can add a local draft section without backend calls", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  assert.match(sectionsPage, /handleAddSection/, "section list should define a local add action");
  assert.match(sectionsPage, /新小节/, "local add action should create a readable draft section title");
  assert.match(sectionsPage, /onClick=\{handleAddSection\}/, "new section button should call the local add action");
});

test("training section detail exposes full scene-block management controls", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );
  const sceneBlockCard = sourceBetween("function SceneBlockCard", "function ReferencePicker");

  for (const label of ["导入预制", "添加本地块"]) {
    assert.match(detailPage, new RegExp(label), `section detail should include ${label}`);
  }
  for (const label of ["编辑", "上移", "下移", "删除"]) {
    assert.match(sceneBlockCard, new RegExp(label), `scene block rows should include ${label}`);
  }
  assert.match(detailPage, /SceneBlockCard/, "section detail should render scene block cards");
  assert.match(sceneBlockCard, /sceneBlockActions/, "scene blocks should use a dedicated action rail");
  assert.match(detailPage, /TrainingResultGrid/, "section results should use the same thumbnail/lightbox grid as result pool");
});

test("training section detail scene-block actions update local front-end state", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );
  const sceneBlockCard = sourceBetween("function SceneBlockCard", "function ReferencePicker");

  assert.match(detailPage, /sceneBlocks/, "section detail should render from a local editable block list");
  assert.match(detailPage, /setSceneBlocks/, "section detail block actions should update local state");
  assert.match(detailPage, /handleAddLocalSceneBlock/, "section detail should add a local draft block");
  assert.match(detailPage, /handleMoveSceneBlock/, "section detail should reorder blocks locally");
  assert.match(detailPage, /handleDeleteSceneBlock/, "section detail should delete blocks locally");
  assert.match(detailPage, /editingSceneBlockId/, "section detail should track the block currently being edited");
  assert.match(detailPage, /handleUpdateSceneBlock/, "section detail should update block text fields locally");
  assert.match(detailPage, /sceneBlocks\.map/, "block list should render the local block state");
  assert.match(detailPage, /isEditing=\{editingSceneBlockId === block\.id\}/, "block cards should receive edit state");
  assert.match(detailPage, /onEdit=\{setEditingSceneBlockId\}/, "block cards should toggle local edit state");
  assert.match(detailPage, /onUpdate=\{handleUpdateSceneBlock\}/, "block cards should push edits into local state");
  assert.match(sceneBlockCard, /isEditing/, "scene block card should render an edit mode");
  assert.match(sceneBlockCard, /label="场景块标题"/, "edit mode should expose a title field");
  assert.match(sceneBlockCard, /label="场景块文本"/, "edit mode should expose a text field");
  assert.match(sceneBlockCard, /onUpdate\?\.\(block\.id, \{ title: value \}\)/, "title edits should update the local block");
  assert.match(sceneBlockCard, /onUpdate\?\.\(block\.id, \{ text: value \}\)/, "text edits should update the local block");
  assert.match(sceneBlockCard, /onMove\?\.\(index, -1\)/, "move-up button should call the move handler");
  assert.match(sceneBlockCard, /onMove\?\.\(index, 1\)/, "move-down button should call the move handler");
  assert.match(sceneBlockCard, /onDelete\?\.\(block\.id\)/, "delete button should call the delete handler");
  assert.doesNotMatch(detailPage, /编辑场景块入口已预览/, "scene-block editing should not be a preview-only placeholder");
});

test("training section detail imports training presets into local scene blocks", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /const training = buildLoraTrainingDemoData\(data\)/, "section detail should read available training presets");
  assert.match(detailPage, /handleImportPresetBlock/, "section detail should define a preset import action");
  assert.match(detailPage, /source:\s*"预制"/, "imported preset blocks should keep the preset source label");
  assert.match(detailPage, /training\.presets\[0\]/, "demo import should copy a real preset fixture instead of showing a placeholder");
  assert.match(detailPage, /onClick=\{handleImportPresetBlock\}/, "import button should call the preset import action");
  assert.doesNotMatch(detailPage, /导入预制入口已预览/, "preset import should not be a preview-only placeholder");
});

test("training section detail saves a visible local section draft", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /sectionDraft/, "section detail should expose a saved local section draft");
  assert.match(detailPage, /setSectionDraft/, "section save should update local draft state");
  assert.match(detailPage, /handleSaveSection/, "section detail should define a save handler");
  assert.match(detailPage, /onClick=\{handleSaveSection\}/, "section save action should call the local save handler");
  assert.match(detailPage, /sceneBlocks\.length/, "saved section draft should include current scene block count");
  assert.match(detailPage, /scenePreview/, "saved section draft should use current composed scene text");
  assert.match(detailPage, /小节保存草稿/, "section detail should render a visible saved draft panel");
  assert.match(detailPage, /generation-tasks\/new/, "saving the section should not replace the generation action");
  assert.doesNotMatch(detailPage, /小节已保存/, "section save should not remain feedback-only");
});

test("generation compose uses an explicit reference source tree with preview then add", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /ReferencePicker/, "compose page should delegate reference selection to a source-tree picker");
  assert.match(composePage, /referenceSourceTree/, "reference picker should render an explicit source tree");
  assert.match(composePage, /previewReference/, "clicking a candidate should preview instead of adding immediately");
  assert.match(sourceBetween("function ReferencePicker", "export function LoraTrainingProjectFormPage"), /添加引用/, "reference candidates should require an explicit add action");
});

test("generation compose queues a local generation task draft instead of only showing a toast", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /generationTaskDraft/, "compose page should expose a local generated task draft");
  assert.match(composePage, /setGenerationTaskDraft/, "run action should update local generation task state");
  assert.match(composePage, /handleQueueGenerationTask/, "compose page should define a queue handler");
  assert.match(composePage, /onClick=\{handleQueueGenerationTask\}/, "run button should call the local queue handler");
  assert.match(composePage, /生成任务草稿/, "compose page should render a visible task draft panel");
  assert.match(composePage, /activePreviewReference/, "task draft should include the currently previewed reference context");
  assert.match(composePage, /section\.resolvedScene/, "task draft should preserve the resolved section scene");
  assert.doesNotMatch(composePage, /生成任务已加入队列/, "run action should not remain a toast-only placeholder");
});

test("generation compose saves editable task fields into final input and draft", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /generationForm/, "compose page should track editable task fields in local state");
  assert.match(composePage, /handleUpdateGenerationForm/, "compose page should expose a local task form update handler");
  assert.match(composePage, /value=\{generationForm\.taskType\}/, "task type select should be controlled by local form state");
  assert.match(composePage, /onChange=\{\(value\) => handleUpdateGenerationForm\("taskType", value\)\}/, "task type changes should update local form state");
  assert.match(composePage, /value=\{generationForm\.supplementalPrompt\}/, "supplemental prompt should be controlled by local form state");
  assert.match(composePage, /onChange=\{\(value\) => handleUpdateGenerationForm\("supplementalPrompt", value\)\}/, "supplemental prompt changes should update local form state");
  assert.match(composePage, /generationForm\.supplementalPrompt/, "final input preview should include the current supplemental prompt");
  assert.match(composePage, /taskType:\s*generationForm\.taskType/, "task draft should save the edited task type");
  assert.match(composePage, /supplementalPrompt:\s*generationForm\.supplementalPrompt/, "task draft should save the edited supplemental prompt");
});

test("reference picker records explicitly added references in local front-end state", () => {
  const pickerSource = sourceBetween("function ReferencePicker", "export function LoraTrainingProjectFormPage");

  assert.match(pickerSource, /selectedReferenceIds/, "reference picker should track added references locally");
  assert.match(pickerSource, /handleAddReference/, "reference picker should expose an explicit add handler");
  assert.match(pickerSource, /已添加引用/, "reference picker should render added references instead of only showing a toast");
});

test("generation compose carries explicitly added references into the task draft", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /selectedReferenceIds/, "compose page should own the selected reference state");
  assert.match(composePage, /setSelectedReferenceIds/, "compose page should update selected references locally");
  assert.match(composePage, /selectedReferences/, "compose page should resolve selected reference objects");
  assert.match(composePage, /selectedReferenceTitles/, "task draft should store the selected reference titles");
  assert.match(composePage, /selectedReferenceDetails/, "final input should include selected reference details");
  assert.match(composePage, /onAddReference=\{handleAddTaskReference\}/, "reference picker add action should update compose state");
  assert.match(composePage, /selectedReferenceIds=\{selectedReferenceIds\}/, "reference picker should receive selected ids from compose state");
  assert.doesNotMatch(composePage, /referenceTitle:\s*activePreviewReference/, "task draft should not only save the currently previewed reference");
});

test("training section workflow has responsive rail and compact action styles", () => {
  for (const className of [
    "trainingSectionWorkspace",
    "trainingSectionRail",
    "sectionScrollPane",
    "sceneBlockActions",
    "referenceSourceTree",
    "referencePreview",
    "sectionDraftGrid",
  ]) {
    assert.match(cssSource, new RegExp(`\\.${className}\\b`), `${className} CSS should exist`);
  }
  assert.match(cssSource, /@media \(max-width:\s*639px\)[\s\S]*?\.trainingSectionWorkspace/, "section workspace should adapt for mobile widths");
});
