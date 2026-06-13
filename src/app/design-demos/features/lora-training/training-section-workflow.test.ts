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

test("training section list uses the project-demo container-driven two-column layout", () => {
  const sectionGridRule = cssSource.match(/\.sectionGrid\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(
    cssSource,
    /\.sectionScrollPane\s*\{[\s\S]*?container-type:\s*inline-size/,
    "section grid should respond to the scroll pane width",
  );
  assert.match(
    cssSource,
    /@container\s*\(min-width:\s*520px\)\s*\{[\s\S]*?\.sectionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "section cards should expand at the project-demo 520px container breakpoint",
  );
  assert.doesNotMatch(sectionGridRule, /container-type:\s*inline-size/, "section grid should not query its own width directly");
  assert.doesNotMatch(
    cssSource,
    /@media\s*\(min-width:\s*720px\)\s*\{\s*\.sectionGrid\s*\{/,
    "section cards should not use viewport width to decide their column count",
  );
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
  assert.doesNotMatch(sectionCard, /删除小节需要确认/, "delete feedback should describe the local section removal, not a confirmation placeholder");
});

test("training section list keeps local section state scoped to the active project", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  assert.match(sectionsPage, /projectId:\s*project\?\.id \?\? null/, "local section state should remember the source project id");
  assert.match(sectionsPage, /localSectionState\.projectId === project\.id \? localSectionState\.sections : project\.sections/, "section cards should fall back to the active project's sections after route changes");
  assert.match(sectionsPage, /orderedSectionState\.projectId === project\.id \? orderedSectionState\.ids : project\.sections\.map\(\(section\) => section\.id\)/, "section order should fall back to the active project after route changes");
  assert.doesNotMatch(sectionsPage, /const \[localSections, setLocalSections\] = useState\(\(\) => project\?\.sections \?\? \[\]\)/, "local sections should not be a project-agnostic state array");
  assert.doesNotMatch(sectionsPage, /const \[orderedSectionIds, setOrderedSectionIds\] = useState\(\(\) => project\?\.sections\.map\(\(section\) => section\.id\) \?\? \[\]\)/, "local section order should not be a project-agnostic state array");
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

test("training section copy inserts the duplicate directly after the source section", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  assert.match(sectionsPage, /const sourceIndex = currentSections\.findIndex\(\(item\) => item\.id === section\.id\)/, "copy should find the source section position");
  assert.match(sectionsPage, /\.\.\.currentSections\.slice\(0, sourceIndex \+ 1\),\s*copy,\s*\.\.\.currentSections\.slice\(sourceIndex \+ 1\)/, "local section copy should stay adjacent to the source");
  assert.match(sectionsPage, /const sourceIndex = currentIds\.indexOf\(section\.id\)/, "copy should find the source id position in the visible order");
  assert.match(sectionsPage, /\.\.\.currentIds\.slice\(0, sourceIndex \+ 1\),\s*copyId,\s*\.\.\.currentIds\.slice\(sourceIndex \+ 1\)/, "visible section order should insert the copy after the source");
  assert.doesNotMatch(sectionsPage, /setOrderedSectionIds\(\(current\) => \[\.\.\.current, copyId\]\)/, "copy should not append to the end of the section order");
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

test("training section generation actions name the target section", () => {
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(
    sectionCard,
    /ariaLabel=\{`生成小节样本：\$\{section\.title\}`\}/,
    "section card generation action should name the section",
  );
  assert.match(
    detailPage,
    /ariaLabel=\{`生成小节样本：\$\{section\.title\}`\}/,
    "section detail generation action should name the section",
  );
});

test("training section thumbnail links name the section results they open", () => {
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(
    sectionCard,
    /aria-label=\{`打开第 \$\{index \+ 1\} 个训练小节最近结果：\$\{section\.title\}`\}/,
    "section thumbnail link should follow the project-demo image-link accessible-name pattern",
  );
});

test("training section list scans existing section ids for local copy and draft ids", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  assert.match(pagesSource, /function nextProjectSectionCopyNumber/, "section copy ids should use a shared ordinal helper");
  assert.match(pagesSource, /function nextProjectSectionDraftNumber/, "new section draft ids should use a shared ordinal helper");
  assert.match(sectionsPage, /nextProjectSectionCopyNumber\(localSections, section\.id\)/, "copy ids should scan existing copied section ids");
  assert.match(sectionsPage, /nextProjectSectionDraftNumber\(localSections\)/, "new section ids should scan existing draft section ids");
  assert.doesNotMatch(sectionsPage, /copyId = `\$\{section\.id\}-copy-\$\{Date\.now\(\)\}`/, "copy ids should not depend on Date.now");
  assert.doesNotMatch(sectionsPage, /draftId = `new-section-\$\{Date\.now\(\)\}`/, "draft ids should not depend on Date.now");
});

test("training section detail exposes full scene-block management controls", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );
  const sceneBlockCard = sourceBetween("function SceneBlockCard", "function ReferencePicker");

  for (const label of ["选择预制", "导入所选", "添加本地块"]) {
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
  assert.match(detailPage, /editingSceneBlockState/, "section detail should track the block currently being edited with route context");
  assert.match(detailPage, /handleUpdateSceneBlock/, "section detail should update block text fields locally");
  assert.match(detailPage, /sceneBlocks\.map/, "block list should render the local block state");
  assert.match(detailPage, /isEditing=\{visibleEditingSceneBlockId === block\.id\}/, "block cards should receive scoped edit state");
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
  assert.match(detailPage, /presetImportOpen/, "preset import should open a visible candidate picker");
  assert.match(detailPage, /selectedTrainingPresetId/, "preset import should track the selected training preset");
  assert.match(detailPage, /selectedTrainingPreset/, "preset import should import the selected preset, not an implicit default");
  assert.match(detailPage, /training\.presets\.map/, "preset import should render the available training presets as selectable candidates");
  assert.match(detailPage, /source:\s*"预制"/, "imported preset blocks should keep the preset source label");
  assert.doesNotMatch(detailPage, /training\.presets\[0\]/, "preset import should not silently copy the first fixture");
  assert.match(detailPage, /handleImportPresetBlock\(selectedTrainingPreset\)/, "import button should pass the selected preset to the import action");
  assert.doesNotMatch(detailPage, /导入预制入口已预览/, "preset import should not be a preview-only placeholder");
});

test("training section detail generates scene block ids from existing ids instead of list length", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(pagesSource, /function nextSceneBlockOrdinal/, "section block id generation should use a shared ordinal helper");
  assert.match(detailPage, /nextSceneBlockOrdinal\(current, `\$\{activeSection\.id\}-local-block-`\)/, "local block ids should scan existing local ids");
  assert.match(detailPage, /nextSceneBlockOrdinal\(current, `\$\{activeSection\.id\}-preset-block-\$\{preset\.id\}-`\)/, "imported preset block ids should scan existing imported ids");
  assert.doesNotMatch(detailPage, /id:\s*`\$\{activeSection\.id\}-local-block-\$\{current\.length \+ 1\}`/, "local block ids should not reuse ids after deleting earlier blocks");
  assert.doesNotMatch(detailPage, /id:\s*`\$\{activeSection\.id\}-preset-block-\$\{preset\.id\}-\$\{current\.length \+ 1\}`/, "imported block ids should not reuse ids after deleting earlier blocks");
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

test("training section detail state stays scoped to the active project section", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /projectId:\s*project\?\.id \?\? null/, "scene-block state should remember the parent project");
  assert.match(
    detailPage,
    /sceneBlockState\.projectId === project\?\.id && sceneBlockState\.sectionId === section\?\.id \? sceneBlockState\.blocks : section\?\.blocks \?\? \[\]/,
    "scene blocks should only reuse local state for the same project and section",
  );
  assert.match(
    detailPage,
    /current\.projectId === activeProject\.id && current\.sectionId === activeSection\.id \? current\.blocks : activeSection\.blocks/,
    "scene-block updates should fall back to the active section when switching projects",
  );
  assert.match(detailPage, /projectId:\s*activeProject\.id/, "scene-block updates and saved drafts should store the active project id");
  assert.match(detailPage, /projectId:\s*string;/, "saved section drafts should be typed with the parent project id");
  assert.match(detailPage, /editingSceneBlockState/, "editing scene-block state should be stored with route context");
  assert.match(
    detailPage,
    /editingSceneBlockState\.projectId === activeProject\.id && editingSceneBlockState\.sectionId === activeSection\.id \? editingSceneBlockState\.blockId : null/,
    "editing scene-block state should reset after project or section changes",
  );
  assert.match(detailPage, /isEditing=\{visibleEditingSceneBlockId === block\.id\}/, "scene block cards should only receive scoped edit state");
  assert.match(
    detailPage,
    /sectionDraft\?\.projectId === activeProject\.id && sectionDraft\?\.sectionId === activeSection\.id \? sectionDraft : null/,
    "saved section drafts should only appear for the same project and section",
  );
  assert.doesNotMatch(
    detailPage,
    /const sceneBlocks = sceneBlockState\.sectionId === section\?\.id \? sceneBlockState\.blocks : section\?\.blocks \?\? \[\]/,
    "section-only scene-block state should not leak between projects",
  );
  assert.doesNotMatch(
    detailPage,
    /const visibleSectionDraft = sectionDraft\?\.sectionId === section\?\.id \? sectionDraft : null/,
    "section-only saved drafts should not leak between projects",
  );
  assert.doesNotMatch(
    detailPage,
    /const \[editingSceneBlockId, setEditingSceneBlockId\] = useState<string \| null>\(null\)/,
    "editing scene-block state should not be stored without route context",
  );
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

test("generation compose manages supplemental image attachments in local state", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /supplementalImageAttachments/, "compose page should keep supplemental image attachments in local state");
  assert.match(composePage, /handleAddSupplementalImage/, "compose page should expose an explicit local add-image action");
  assert.match(composePage, /handleAddSupplementalImage\(candidate: SupplementalImageAttachment\)/, "add-image action should require an explicit candidate");
  assert.match(composePage, /onClick=\{\(\) => handleAddSupplementalImage\(candidate\)\}/, "candidate cards should pass the selected image to the add handler");
  assert.match(composePage, /handleRemoveSupplementalImage/, "compose page should expose an explicit local remove-image action");
  assert.match(composePage, /补充图片附件/, "compose page should render a visible supplemental image attachment list");
  assert.match(composePage, /supplementalImageCount:\s*supplementalImageAttachments\.length/, "task draft should save the supplemental image count");
  assert.match(composePage, /visibleGenerationTaskDraft\.supplementalImageCount/, "visible task draft should summarize attached supplemental images");
  assert.doesNotMatch(composePage, /candidate = supplementalImageCandidates\[0\]/, "supplemental image add should not silently pick the first candidate");
  assert.doesNotMatch(composePage, /handleAddSupplementalImage\(\)/, "supplemental image add buttons should not call the handler without a selected candidate");
  assert.doesNotMatch(composePage, /supplementalImageCandidates\[0\]\?\.title/, "supplemental image feedback should not describe an implicit first candidate");
  assert.match(cssSource, /\.supplementalImageList\b/, "supplemental image attachments should have a dedicated compact list style");
});

test("generation compose task draft stays scoped to the active project section", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /projectId:\s*string;/, "generation task draft should remember its project");
  assert.match(composePage, /sectionId:\s*string;/, "generation task draft should remember its section");
  assert.match(composePage, /visibleGenerationTaskDraft/, "compose page should derive a route-scoped visible draft");
  assert.match(composePage, /generationTaskDraft\?\.projectId === activeProject\.id && generationTaskDraft\.sectionId === activeSection\.id \? generationTaskDraft : null/, "draft display should be gated by the active project and section");
  assert.match(composePage, /projectId:\s*activeProject\.id/, "queue action should store the active project id");
  assert.match(composePage, /sectionId:\s*activeSection\.id/, "queue action should store the active section id");
  assert.doesNotMatch(composePage, /\{generationTaskDraft \? \(/, "compose page should not render a stale draft from another project section");
});

test("reference picker records explicitly added references in local front-end state", () => {
  const pickerSource = sourceBetween("function ReferencePicker", "export function LoraTrainingProjectFormPage");

  assert.match(pickerSource, /selectedReferenceIds/, "reference picker should track added references locally");
  assert.match(pickerSource, /handleAddReference/, "reference picker should expose an explicit add handler");
  assert.match(pickerSource, /已添加引用/, "reference picker should render added references instead of only showing a toast");
});

test("reference picker disables references that have already been added", () => {
  const pickerSource = sourceBetween("function ReferencePicker", "export function LoraTrainingProjectFormPage");

  assert.match(pickerSource, /previewAlreadyAdded/, "reference picker should know when the previewed reference is already selected");
  assert.match(pickerSource, /if \(!previewReference \|\| previewAlreadyAdded\) return;/, "add handler should short-circuit duplicate selected references");
  assert.match(pickerSource, /disabled=\{!previewReference \|\| previewAlreadyAdded\}/, "add button should be disabled after a reference is already selected");
});

test("generation compose carries explicitly added references into the task draft", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /selectedReferenceIds/, "compose page should own the selected reference state");
  assert.match(composePage, /setReferenceSelectionState/, "compose page should update selected references locally");
  assert.match(composePage, /selectedReferences/, "compose page should resolve selected reference objects");
  assert.match(composePage, /selectedReferenceTitles/, "task draft should store the selected reference titles");
  assert.match(composePage, /selectedReferenceDetails/, "final input should include selected reference details");
  assert.match(composePage, /onAddReference=\{handleAddTaskReference\}/, "reference picker add action should update compose state");
  assert.match(composePage, /selectedReferenceIds=\{selectedReferenceIds\}/, "reference picker should receive selected ids from compose state");
  assert.doesNotMatch(composePage, /referenceTitle:\s*activePreviewReference/, "task draft should not only save the currently previewed reference");
});

test("generation compose keeps reference selection scoped to the active project section", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /referenceSelectionState/, "compose reference selection should be stored with route context");
  assert.match(composePage, /projectId:\s*project\?\.id \?\? null/, "reference selection should remember the source project id");
  assert.match(composePage, /sectionId:\s*section\?\.id \?\? null/, "reference selection should remember the source section id");
  assert.match(composePage, /referenceSelectionState\.projectId === activeProject\.id && referenceSelectionState\.sectionId === activeSection\.id/, "reference selection should fall back after project or section changes");
  assert.match(composePage, /selectedReferenceIds:\s*new Set<string>\(\)/, "a new project section should start with an empty explicit reference selection");
  assert.doesNotMatch(composePage, /const \[previewReference, setPreviewReference\] = useState<ReferenceCandidate \| null>/, "preview state should not be stored without route context");
  assert.doesNotMatch(composePage, /const \[selectedReferenceIds, setSelectedReferenceIds\] = useState<Set<string>>\(new Set\(\)\)/, "selected references should not be stored without route context");
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
