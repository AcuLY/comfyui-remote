import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const pagesSource = readFileSync(resolve(featureUiDir, "training-project-pages.tsx"), "utf8");
const projectPageUtilsSource = readFileSync(resolve(featureUiDir, "project-page-utils.ts"), "utf8");
const projectSectionDraftHookSource = readFileSync(resolve(featureUiDir, "use-project-section-draft.ts"), "utf8");
const generationComposeReferenceSelectionHookPath = resolve(featureUiDir, "use-generation-compose-reference-selection.ts");
const generationComposeReferenceSelectionHookSource = existsSync(generationComposeReferenceSelectionHookPath)
  ? readFileSync(generationComposeReferenceSelectionHookPath, "utf8")
  : "";
const cssSource = readFileSync(resolve(featureUiDir, "training-project-pages.module.css"), "utf8");

function sourceBetween(startMarker: string, endMarker: string) {
  const start = pagesSource.indexOf(startMarker);
  const end = pagesSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return pagesSource.slice(start, end);
}

function cssRule(className: string) {
  return cssSource.match(new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
}

function nestedFunctionSource(source: string, functionName: string) {
  const asyncFunctionStart = source.indexOf(`async function ${functionName}`);
  const callbackStart = source.indexOf(`const ${functionName} = useCallback(async () =>`);
  const start = asyncFunctionStart === -1 ? callbackStart : asyncFunctionStart;
  assert.notEqual(start, -1, `${functionName} should exist`);

  const nextFunction = source.indexOf("\n  async function ", start + 1);
  const callbackEnd = source.indexOf("\n  }, [", start + 1);
  const returnStart = source.indexOf("\n  return (", start + 1);
  const endCandidates = [nextFunction, callbackEnd, returnStart].filter((index) => index !== -1);
  assert.ok(endCandidates.length > 0, `${functionName} should have a bounded source range`);
  return source.slice(start, Math.min(...endCandidates));
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

test("training section list copy and delete actions use HTTP-backed production mutations", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(sectionsPage, /localSections/, "section list should keep a local editable section list");
  assert.match(sectionsPage, /isProductionTrainingRoute/, "section mutations should distinguish production /training routes from reusable demos");
  assert.match(sectionsPage, /handleCopySection/, "section list should define a copy action");
  assert.match(sectionsPage, /handleDeleteSection/, "section list should define a delete action");
  assert.match(sectionsPage, /fetch\(`\/api\/training\/projects\/\$\{activeProject\.id\}\/sections`/, "copy should call the project section collection API");
  assert.match(sectionsPage, /sourceSectionId:\s*section\.id/, "copy should send the source section id to the API");
  assert.match(sectionsPage, /fetch\(`\/api\/training\/projects\/\$\{activeProject\.id\}\/sections\/\$\{sectionId\}`/, "delete should call the project section detail API");
  assert.match(sectionsPage, /method:\s*"DELETE"/, "delete should use the formal DELETE operation");
  assert.match(sectionsPage, /sections=\{sections\}/, "section rail should follow the same local list as the cards");
  assert.match(sectionCard, /onCopy\?\.\(section\)/, "copy button should call the section copy handler");
  assert.match(sectionCard, /onDelete\?\.\(section\.id\)/, "delete button should call the section delete handler");
  assert.doesNotMatch(sectionCard, /删除小节需要确认/, "delete feedback should describe the local section removal, not a confirmation placeholder");
});

test("training section list mutation handlers guard concurrent actions before optimistic local state", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  for (const functionName of ["handleCopySection", "handleDeleteSection", "handleReorderSections", "handleAddSection"]) {
    const handler = nestedFunctionSource(sectionsPage, functionName);
    const guardMatch = handler.match(/if\s*\(\s*(?:isProductionTrainingRoute\s*&&\s*)?isMutatingSections\s*\)\s*return;/);
    const guardIndex = guardMatch?.index ?? -1;
    const localMutationIndexes = [
      handler.indexOf("setLocalSections("),
      handler.indexOf("setOrderedSectionIds("),
    ].filter((index) => index !== -1);

    assert.notEqual(guardIndex, -1, `${functionName} should guard against concurrent section mutations`);
    assert.ok(localMutationIndexes.length > 0, `${functionName} should still update local optimistic state after it is allowed to run`);
    assert.ok(
      guardIndex < Math.min(...localMutationIndexes),
      `${functionName} should not mutate local state when the production HTTP operation is already in flight`,
    );
  }
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

test("training section list drag handles reorder through the project section API on production routes", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.match(sectionsPage, /orderedSectionIds/, "section list should keep local section ordering state");
  assert.match(sectionsPage, /handleReorderSections/, "section list should define a local reorder handler");
  assert.match(sectionsPage, /<SortableList items=\{orderedSectionIds\} onReorder=\{handleReorderSections\}>/, "section list should wrap cards in SortableList");
  assert.match(sectionsPage, /orderedSectionIds\.map/, "section cards should render in the local drag order");
  assert.match(sectionsPage, /fetch\(`\/api\/training\/projects\/\$\{activeProject\.id\}\/sections\/reorder`/, "section reorder should call the formal reorder API");
  assert.match(sectionsPage, /orderedSectionIds:\s*nextSectionIds/, "section reorder should submit the next id order");
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
  assert.match(sectionsPage, /const sourceOrderIndex = currentIds\.indexOf\(section\.id\)/, "copy should find the source id position in the visible order");
  assert.match(sectionsPage, /\.\.\.currentIds\.slice\(0, sourceOrderIndex \+ 1\),\s*copyId,\s*\.\.\.currentIds\.slice\(sourceOrderIndex \+ 1\)/, "visible section order should insert the copy after the source");
  assert.doesNotMatch(sectionsPage, /setOrderedSectionIds\(\(current\) => \[\.\.\.current, copyId\]\)/, "copy should not append to the end of the section order");
});

test("training section list can add a section through the project section API on production routes", () => {
  const sectionsPage = sourceBetween(
    "export function LoraTrainingProjectSectionsPage",
    "export function LoraTrainingProjectSectionDetailPage",
  );

  assert.match(sectionsPage, /handleAddSection/, "section list should define an add action");
  assert.match(sectionsPage, /新小节/, "local add action should create a readable draft section title");
  assert.match(sectionsPage, /fetch\(`\/api\/training\/projects\/\$\{activeProject\.id\}\/sections`/, "add should call the project section collection API");
  assert.match(
    sectionsPage,
    /window\.addEventListener\(TRAINING_PROJECT_SECTION_ADD_EVENT,\s*handleHeaderAddSection\)/,
    "route header new-section action should call the local add action",
  );
  assert.doesNotMatch(
    sectionsPage,
    /actions=\{<Button icon=\{Plus\} tone="primary" onClick=\{handleAddSection\}/,
    "section list should not keep a duplicate content-header new-section button",
  );
});

test("training section list generation actions name the target section while detail pages leave the CTA to route headers", () => {
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
  assert.doesNotMatch(
    detailPage,
    /ariaLabel=\{`生成小节样本：\$\{section\.title\}`\}/,
    "section detail should leave the primary generation CTA to the route header",
  );
});

test("training section cards keep enabled state as lightweight meta instead of a header badge", () => {
  const sectionCard = sourceBetween("function SectionCard", "export function LoraTrainingProjectSectionsPage");

  assert.doesNotMatch(
    sectionCard,
    /<StatusBadge/,
    "training section cards should not keep a heavy status capsule in the header",
  );
  assert.match(
    sectionCard,
    /section\.enabled \? "已启用" : "已停用"/,
    "training section cards should keep enabled state in lightweight meta text",
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

  assert.match(projectPageUtilsSource, /function nextProjectSectionCopyNumber/, "section copy ids should use a shared ordinal helper");
  assert.match(projectPageUtilsSource, /function nextProjectSectionDraftNumber/, "new section draft ids should use a shared ordinal helper");
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

test("training section detail puts results first and uses the page scroll", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );
  const sectionScrollPaneRule = cssRule("sectionScrollPane");

  assert.match(
    detailPage,
    /<TrainingSectionWorkspace[\s\S]*?>\s*<div id="section-results">[\s\S]*?<div className=\{s\.twoCol\}>/,
    "section results should render before scene blocks and preview content",
  );
  assert.doesNotMatch(sectionScrollPaneRule, /overflow-y:\s*auto/, "section detail content should not create a second vertical scroll container");
  assert.doesNotMatch(sectionScrollPaneRule, /max-height:/, "section detail content should not trap scrolling inside a viewport-height pane");
  assert.doesNotMatch(sectionScrollPaneRule, /mask-image:/, "section detail content should not fade out as though it owns scrolling");
});

test("training scene-block cards mirror the compact prompt-block row pattern", () => {
  const sceneBlockCard = sourceBetween("function SceneBlockCard", "function ReferencePicker");
  const sceneBlockCardRule = cssRule("sceneBlockCard");

  assert.match(sceneBlockCard, /className=\{s\.sceneBlockTitleRow\}/, "scene block title and source should share a stable title row");
  assert.match(sceneBlockCard, /className=\{s\.sceneBlockGrip\}/, "scene block rows should expose the same leading grip slot as prompt blocks");
  assert.match(sceneBlockCard, /className=\{s\.sceneBlockPreview\}/, "scene block body should use a compact prompt-preview line");
  assert.match(sceneBlockCard, /className=\{s\.sceneBlockPreviewSign\}/, "scene block preview should show a signed prompt prefix");
  assert.match(sceneBlockCard, /iconOnly/, "scene block actions should be icon-only like the prompt block reference");
  assert.match(
    sceneBlockCardRule,
    /grid-template-columns:\s*28px minmax\(0,\s*1fr\) auto/,
    "scene block rows should use a prompt-block-like grip / content / action grid",
  );
  assert.match(
    cssSource,
    /\.sceneBlockInlineBody\s*\{[\s\S]*?grid-column:\s*2 \/ -1/,
    "expanded scene block editing should align under the main prompt row content",
  );
});

test("training section detail scene-block actions update local front-end state", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );
  const sceneBlockCard = sourceBetween("function SceneBlockCard", "function ReferencePicker");

  assert.match(detailPage, /sceneBlocks/, "section detail should render from a local editable block list");
  assert.match(detailPage, /setSectionSceneBlocksByKey/, "section detail block actions should update keyed local state");
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

test("training section detail scene-block actions persist through formal HTTP APIs on production routes", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /usePathname/, "section detail should detect whether it is running under production \\/training routes");
  assert.match(detailPage, /fetch\(`\/api\/training\/sections\/\$\{activeSection\.id\}\/blocks\?projectId=\$\{activeProject\.id\}`/, "section block create actions should call the formal section block collection API");
  assert.match(detailPage, /fetch\(`\/api\/training\/sections\/\$\{activeSection\.id\}\/blocks\/reorder\?projectId=\$\{activeProject\.id\}`/, "section block move actions should call the formal section block reorder API");
  assert.match(detailPage, /fetch\(`\/api\/training\/blocks\/\$\{blockId\}\?projectId=\$\{activeProject\.id\}`/, "section block update and delete actions should call the formal block detail API");
  assert.match(detailPage, /method:\s*"PATCH"/, "section block updates should save through PATCH");
  assert.match(detailPage, /method:\s*"DELETE"/, "section block delete should use DELETE");
  assert.match(detailPage, /ids:\s*reorderedBlocks\.map\(\(block\) => block\.id\)/, "section block reorder should submit the updated block id order");
  assert.match(detailPage, /场景块(创建|保存|排序|删除)失败/, "section block production actions should surface API failures through the shared feedback system");
});

test("training section detail imports training presets into local scene blocks", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /const training = buildLoraTrainingData\(data\)/, "section detail should read available training presets");
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

  assert.match(projectPageUtilsSource, /function nextSceneBlockOrdinal/, "section block id generation should use a shared ordinal helper");
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

  assert.match(detailPage, /visibleSectionDraft/, "section detail should expose a saved local section draft");
  assert.match(detailPage, /saveSectionDraft\(nextDraft\)/, "section save should update the local draft hook");
  assert.match(projectSectionDraftHookSource, /setSectionDraftsByKey/, "section save hook should update keyed local draft state");
  assert.match(detailPage, /handleSaveSection/, "section detail should define a save handler");
  assert.match(detailPage, /onClick=\{handleSaveSection\}/, "section save action should call the local save handler");
  assert.match(detailPage, /sceneBlocks\.length/, "saved section draft should include current scene block count");
  assert.match(detailPage, /scenePreview/, "saved section draft should use current composed scene text");
  assert.match(detailPage, /小节保存草稿/, "section detail should render a visible saved draft panel");
  assert.doesNotMatch(detailPage, /generation-tasks\/new/, "section detail should leave the generation CTA to the route header");
  assert.doesNotMatch(detailPage, /feedback=\{\{\s*title:\s*"训练小节已保存"/, "section save should not remain feedback-only");
});

test("training section detail keeps local edits keyed by project and section", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /projectSectionStateKey/, "section detail should build a stable local state key");
  assert.match(detailPage, /sectionSceneBlocksByKey/, "scene-block edits should be stored per project section");
  assert.match(detailPage, /setSectionSceneBlocksByKey/, "scene-block actions should update keyed local state");
  assert.match(detailPage, /sectionResultsByProjectKey/, "result review changes should be stored per project");
  assert.match(detailPage, /setSectionResultsByProjectKey/, "result review actions should update keyed local results");
  assert.match(detailPage, /useProjectSectionDraft\(initialProjectSectionStateKey\)/, "saved section drafts should be delegated to the focused hook");
  assert.match(projectSectionDraftHookSource, /sectionDraftsByKey/, "saved section drafts should be stored per project section");
  assert.match(projectSectionDraftHookSource, /setSectionDraftsByKey/, "save action should update keyed local drafts");
  assert.match(detailPage, /sectionSceneBlocksByKey\[projectSectionStateKey\] \?\? activeSection\.blocks/, "scene blocks should read the active section key before falling back to fixtures");
  assert.match(projectSectionDraftHookSource, /sectionDraftsByKey\[projectSectionStateKey\] \?\? null/, "saved drafts should read the active section key before falling back to empty state");
  assert.doesNotMatch(detailPage, /sceneBlockState/, "section detail should not use a single mutable slot for scene blocks");
  assert.doesNotMatch(detailPage, /sectionDraft\?\.projectId/, "section detail should not filter a single mutable draft slot");
});

test("training section detail state stays scoped to the active project section", () => {
  const detailPage = sourceBetween(
    "export function LoraTrainingProjectSectionDetailPage",
    "export function LoraTrainingGenerationComposePage",
  );

  assert.match(detailPage, /buildProjectSectionStateKey\(activeProject\.id, activeSection\.id\)/, "state keys should include both parent project and active section");
  assert.match(
    detailPage,
    /sectionSceneBlocksByKey\[projectSectionStateKey\] \?\? activeSection\.blocks/,
    "scene blocks should read only the active keyed state",
  );
  assert.match(
    detailPage,
    /\[projectSectionStateKey\]: updater\(current\[projectSectionStateKey\] \?\? activeSection\.blocks\)/,
    "scene-block updates should write only the active keyed state",
  );
  assert.match(detailPage, /projectId:\s*activeProject\.id/, "scene-block updates and saved drafts should store the active project id");
  assert.match(projectPageUtilsSource, /type ProjectSectionDraftState = \{[\s\S]*?projectId:\s*string;/, "saved section drafts should be typed with the parent project id");
  assert.match(projectPageUtilsSource, /type ProjectSectionDraftState = \{[\s\S]*?sectionId:\s*string;/, "saved section drafts should be typed with the active section id");
  assert.match(detailPage, /editingSceneBlockState/, "editing scene-block state should be stored with route context");
  assert.match(
    detailPage,
    /editingSceneBlockState\.projectId === activeProject\.id && editingSceneBlockState\.sectionId === activeSection\.id \? editingSceneBlockState\.blockId : null/,
    "editing scene-block state should reset after project or section changes",
  );
  assert.match(detailPage, /isEditing=\{visibleEditingSceneBlockId === block\.id\}/, "scene block cards should only receive scoped edit state");
  assert.match(
    projectSectionDraftHookSource,
    /const visibleSectionDraft = projectSectionStateKey \? sectionDraftsByKey\[projectSectionStateKey\] \?\? null : null/,
    "saved section drafts should read only the active keyed draft",
  );
  assert.doesNotMatch(
    detailPage,
    /sceneBlockState/,
    "single-slot scene-block state should not replace keyed project-section state",
  );
  assert.doesNotMatch(
    detailPage,
    /sectionDraft\?\.projectId/,
    "saved drafts should not be filtered from a single mutable draft slot",
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

test("generation compose posts through the formal HTTP API on production routes", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /usePathname/, "generation compose should detect whether it is running under production \\/training routes");
  assert.match(composePage, /useRouter/, "generation compose should be able to navigate to the queued generation run on production routes");
  assert.match(composePage, /fetch\(`\/api\/training\/projects\/\$\{activeProject\.id\}\/generation-tasks`/, "generation compose should create a formal generation-task draft first");
  assert.match(composePage, /fetch\(`\/api\/training\/generation-tasks\/\$\{draftTaskId\}\/inputs`/, "generation compose should add selected references through the formal draft input API");
  assert.match(composePage, /role:\s*"reference"/, "generation compose should classify explicit references when posting draft inputs");
  assert.match(composePage, /role:\s*"supplemental_image"/, "generation compose should classify supplemental image attachments when posting draft inputs");
  assert.match(composePage, /fetch\(`\/api\/training\/generation-tasks\/\$\{draftTaskId\}\/preview`/, "generation compose should preview the formal draft before running it");
  assert.match(composePage, /fetch\(`\/api\/training\/generation-tasks\/\$\{draftTaskId\}\/run`/, "generation compose should run the formal generation-task draft");
  assert.match(composePage, /sectionId:\s*activeSection\.id/, "generation compose should scope draft creation to the active section");
  assert.match(composePage, /supplementalPrompt:\s*generationForm\.supplementalPrompt/, "generation compose should persist the current supplemental prompt into the draft");
  assert.match(composePage, /taskType:\s*generationForm\.taskType/, "generation compose should persist the current task type into the draft");
  assert.match(composePage, /router\.push\(`/, "generation compose should navigate to the queued generation run after a successful API response");
  assert.match(composePage, /pushToast/, "generation compose should surface API success or failure through the shared feedback system");
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

test("generation compose uploads supplemental images through the formal HTTP API on production routes", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /supplementalImageInputRef/, "compose page should keep a ref to the supplemental image input");
  assert.match(composePage, /handleUploadSupplementalImage/, "compose page should expose an explicit upload entrypoint");
  assert.match(composePage, /handleSupplementalImageFileChange/, "compose page should handle file uploads explicitly");
  assert.match(composePage, /type="file"/, "compose page should render a real file input for supplemental image uploads");
  assert.match(composePage, /fetch\(`\/api\/training\/generation-tasks\/\$\{ensuredDraftTaskId\}\/supplemental-images`/, "supplemental image upload should call the formal draft supplemental-image API");
  assert.match(composePage, /new FormData\(\)/, "supplemental image upload should send a multipart form payload");
  assert.match(composePage, /buildUploadedSupplementalImage/, "uploaded supplemental images should resolve through a dedicated preview helper");
  assert.match(projectPageUtilsSource, /function buildUploadedSupplementalImage/, "compose upload flow should define uploaded supplemental preview mapping in the utility module");
});

test("generation compose removes uploaded supplemental images through the formal HTTP API on production routes", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );
  const removeHandler = composePage.slice(
    composePage.indexOf("async function handleRemoveSupplementalImage"),
    composePage.indexOf("\n  function handleUploadSupplementalImage"),
  );

  assert.match(composePage, /async function handleRemoveSupplementalImage/, "supplemental image removal should be able to await HTTP deletion");
  assert.match(removeHandler, /attachment\.source === "上传"/, "only persisted uploaded supplemental inputs should use the delete-input API");
  assert.match(removeHandler, /fetch\(`\/api\/training\/generation-inputs\/\$\{attachmentId\}`/, "uploaded supplemental removal should call the formal generation input delete API");
  assert.match(removeHandler, /method:\s*"DELETE"/, "uploaded supplemental removal should use DELETE");
  assert.match(removeHandler, /!response\.ok \|\| !payload\?\.ok/, "uploaded supplemental removal should keep local state when the HTTP delete fails");
  assert.doesNotMatch(composePage, /onClick=\{\(\) => handleRemoveSupplementalImage\(attachment\.id\)\}[\s\S]*?feedback=\{\{ tone: "warning", title: "已移除补充图片"/, "the remove button should let the awaited handler own success and failure feedback");
});

test("generation compose does not post uploaded supplemental images as ordinary reference inputs", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /attachment\.source !== "上传"/, "uploaded supplemental images should be excluded from draft reference-input posting");
  assert.match(composePage, /supplementalDraftReferenceIds/, "compose page should derive queue-time supplemental references separately");
  assert.doesNotMatch(composePage, /supplementalReferenceIds/, "compose page should no longer post every supplemental attachment as a reference id");
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

test("reference picker can remove explicitly added references", () => {
  const pickerSource = sourceBetween("function ReferencePicker", "export function LoraTrainingProjectFormPage");
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(pickerSource, /onRemoveReference/, "reference picker should accept a remove callback");
  assert.match(pickerSource, /handleRemoveReference/, "reference picker should expose an explicit remove handler");
  assert.match(pickerSource, /setLocalSelectedReferenceIds\(\(current\) => \{[\s\S]*?next\.delete\(candidate\.id\)/, "local picker state should delete the selected reference id");
  assert.match(pickerSource, /ariaLabel=\{`移除引用：\$\{reference\.title\}`\}/, "selected references should render an accessible remove action");
  assert.match(composePage, /handleRemoveTaskReference/, "compose page should own reference removal in route-scoped state");
  assert.match(composePage, /onRemoveReference=\{handleRemoveTaskReference\}/, "compose page should pass the remove action into the reference picker");
  assert.match(cssSource, /\.selectedReferenceItem\b/, "selected references should have a row style for the remove button");
});

test("generation compose carries explicitly added references into the task draft", () => {
  const composePage = sourceBetween(
    "export function LoraTrainingGenerationComposePage",
    "export function LoraTrainingProjectResultsPage",
  );

  assert.match(composePage, /selectedReferenceIds/, "compose page should consume selected reference state");
  assert.match(generationComposeReferenceSelectionHookSource, /setReferenceSelectionState/, "generation compose reference hook should update selected references locally");
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

  assert.match(composePage, /useGenerationComposeReferenceSelection/, "compose reference selection should be delegated to a route-scoped hook");
  assert.match(generationComposeReferenceSelectionHookSource, /projectId:\s*projectId/, "reference selection should remember the source project id");
  assert.match(generationComposeReferenceSelectionHookSource, /sectionId:\s*sectionId/, "reference selection should remember the source section id");
  assert.match(generationComposeReferenceSelectionHookSource, /referenceSelectionState\.projectId === projectId && referenceSelectionState\.sectionId === sectionId/, "reference selection should fall back after project or section changes");
  assert.match(generationComposeReferenceSelectionHookSource, /selectedReferenceIds:\s*new Set<string>\(\)/, "a new project section should start with an empty explicit reference selection");
  assert.doesNotMatch(composePage, /setReferenceSelectionState/, "compose page should not update reference selection state inline");
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
