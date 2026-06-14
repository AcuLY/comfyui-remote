import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../../../../features/training/ui");
const featureRoot = resolve(testDir, "../../../../features/training");
const resourceSource = readFileSync(resolve(featureUiDir, "training-resource-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(featureUiDir, "training-resource-pages.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(featureRoot, "build.ts"), "utf8");
const typesSource = readFileSync(resolve(featureRoot, "types.ts"), "utf8");

function sourceBetween(startMarker: string, endMarker: string) {
  const start = resourceSource.indexOf(startMarker);
  const end = resourceSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return resourceSource.slice(start, end);
}

function sourceFrom(startMarker: string) {
  const start = resourceSource.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  return resourceSource.slice(start);
}

test("training template fixtures expose scene blocks instead of only block counts", () => {
  assert.match(typesSource, /blocks:\s*LoraTrainingSectionBlock\[\]/, "template sections should expose scene block fixtures");
  assert.match(typesSource, /resolvedScene:\s*string/, "template sections should expose resolved scene preview text");

  const templatesStart = fixtureSource.indexOf("const templates");
  assert.notEqual(templatesStart, -1);
  const templateFixtures = fixtureSource.slice(templatesStart);

  assert.match(templateFixtures, /blocks:\s*\[/, "template fixtures should include block arrays");
  assert.match(templateFixtures, /resolvedScene:/, "template fixtures should include resolved scene text");
});

test("training template section page uses the project-section scene-block action model", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");
  const blockCard = sourceBetween("function TemplateSceneBlockCard", "export function LoraTrainingPresetsPage");

  for (const label of ["选择预制", "导入所选", "添加本地块"]) {
    assert.match(templateSectionPage, new RegExp(label), `template section should include ${label}`);
  }
  for (const label of ["编辑", "上移", "下移", "删除"]) {
    assert.match(blockCard, new RegExp(label), `template scene block rows should include ${label}`);
  }
  assert.match(templateSectionPage, /TemplateSceneBlockCard/, "template section should render block cards");
  assert.match(blockCard, /templateSceneBlockActions/, "template block actions should use a compact action rail");
  assert.doesNotMatch(templateSectionPage, /添加 Block|scene block|local block/i, "template section copy should avoid raw schema phrasing");
});

test("training template section scene-block actions update local front-end state", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");
  const blockCard = sourceBetween("function TemplateSceneBlockCard", "export function LoraTrainingPresetsPage");

  assert.match(templateSectionPage, /sceneBlocks/, "template section should render from a local editable block list");
  assert.match(templateSectionPage, /setTemplateSectionSceneBlocksByKey/, "template section block actions should update keyed local state");
  assert.match(templateSectionPage, /handleAddLocalTemplateBlock/, "template section should add a local draft block");
  assert.match(templateSectionPage, /handleMoveTemplateBlock/, "template section should reorder blocks locally");
  assert.match(templateSectionPage, /handleDeleteTemplateBlock/, "template section should delete blocks locally");
  assert.match(templateSectionPage, /editingTemplateBlockState/, "template section should track the block currently being edited with route context");
  assert.match(templateSectionPage, /handleUpdateTemplateBlock/, "template section should update block text fields locally");
  assert.match(templateSectionPage, /sceneBlocks\.map/, "template block list should render the local block state");
  assert.match(templateSectionPage, /isEditing=\{visibleEditingTemplateBlockId === block\.id\}/, "template block cards should receive scoped edit state");
  assert.match(templateSectionPage, /onEdit=\{setEditingTemplateBlockId\}/, "template block cards should toggle local edit state");
  assert.match(templateSectionPage, /onUpdate=\{handleUpdateTemplateBlock\}/, "template block cards should push edits into local state");
  assert.match(blockCard, /isEditing/, "template block card should render an edit mode");
  assert.match(blockCard, /label="模板块标题"/, "template edit mode should expose a title field");
  assert.match(blockCard, /label="模板块文本"/, "template edit mode should expose a text field");
  assert.match(blockCard, /onUpdate\?\.\(block\.id, \{ title: value \}\)/, "template title edits should update the local block");
  assert.match(blockCard, /onUpdate\?\.\(block\.id, \{ text: value \}\)/, "template text edits should update the local block");
  assert.match(blockCard, /onMove\?\.\(index, -1\)/, "template move-up button should call the move handler");
  assert.match(blockCard, /onMove\?\.\(index, 1\)/, "template move-down button should call the move handler");
  assert.match(blockCard, /onDelete\?\.\(block\.id\)/, "template delete button should call the delete handler");
  assert.doesNotMatch(templateSectionPage, /编辑模板场景块入口已预览/, "template block editing should not be a preview-only placeholder");
});

test("training template section scene-block actions persist through formal HTTP APIs on production routes", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /usePathname/, "template section page should detect whether it is running under production \\/training routes");
  assert.match(templateSectionPage, /fetch\(`\/api\/training\/templates\/\$\{activeTemplate\.id\}\/sections\/\$\{activeSection\.id\}\/blocks`/, "template block create actions should call the formal template block collection API");
  assert.match(templateSectionPage, /fetch\(`\/api\/training\/templates\/\$\{activeTemplate\.id\}\/sections\/\$\{activeSection\.id\}\/blocks\/reorder`/, "template block move actions should call the formal template block reorder API");
  assert.match(templateSectionPage, /fetch\(`\/api\/training\/templates\/\$\{activeTemplate\.id\}\/blocks\/\$\{blockId\}`/, "template block update and delete actions should call the formal template block detail API");
  assert.match(templateSectionPage, /method:\s*"PATCH"/, "template block updates should save through PATCH");
  assert.match(templateSectionPage, /method:\s*"DELETE"/, "template block delete should use DELETE");
  assert.match(templateSectionPage, /ids:\s*reorderedBlocks\.map\(\(block\) => block\.id\)/, "template block reorder should submit the updated block id order");
  assert.match(templateSectionPage, /模板场景块(创建|保存|排序|删除)失败/, "template block production actions should surface API failures through the shared feedback system");
});

test("training template section imports training presets into local scene blocks", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /const training = buildLoraTrainingDemoData\(data\)/, "template section should read available training presets");
  assert.match(templateSectionPage, /handleImportTemplatePresetBlock/, "template section should define a preset import action");
  assert.match(templateSectionPage, /templatePresetImportOpen/, "template preset import should open a visible candidate picker");
  assert.match(templateSectionPage, /selectedTemplatePresetId/, "template preset import should track the selected preset");
  assert.match(templateSectionPage, /selectedTemplatePreset/, "template preset import should import the selected preset, not an implicit default");
  assert.match(templateSectionPage, /training\.presets\.map/, "template preset import should render selectable training preset candidates");
  assert.match(templateSectionPage, /source:\s*"预制"/, "imported template blocks should keep the preset source label");
  assert.doesNotMatch(templateSectionPage, /training\.presets\[0\]/, "template preset import should not silently copy the first fixture");
  assert.match(templateSectionPage, /handleImportTemplatePresetBlock\(selectedTemplatePreset\)/, "template import button should pass the selected preset to the import action");
  assert.doesNotMatch(templateSectionPage, /导入预制入口已预览/, "template preset import should not be a preview-only placeholder");
});

test("training template section generates block ids from existing ids instead of list length", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(resourceSource, /function nextTemplateSceneBlockOrdinal/, "template block id generation should use a shared ordinal helper");
  assert.match(templateSectionPage, /nextTemplateSceneBlockOrdinal\(current, `\$\{activeSection\.id\}-template-local-block-`\)/, "local template block ids should scan existing local ids");
  assert.match(templateSectionPage, /nextTemplateSceneBlockOrdinal\(current, `\$\{activeSection\.id\}-template-preset-block-\$\{preset\.id\}-`\)/, "imported template block ids should scan existing imported ids");
  assert.doesNotMatch(templateSectionPage, /id:\s*`\$\{activeSection\.id\}-template-local-block-\$\{current\.length \+ 1\}`/, "local template block ids should not reuse ids after deleting earlier blocks");
  assert.doesNotMatch(templateSectionPage, /id:\s*`\$\{activeSection\.id\}-template-preset-block-\$\{preset\.id\}-\$\{current\.length \+ 1\}`/, "imported template block ids should not reuse ids after deleting earlier blocks");
});

test("training template section saves a visible local section draft", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /templateSectionDraft/, "template section should expose a saved local section draft");
  assert.match(templateSectionPage, /setTemplateSectionDraft/, "template section save should update local draft state");
  assert.match(templateSectionPage, /handleSaveTemplateSection/, "template section should define a local save handler");
  assert.match(templateSectionPage, /onClick=\{handleSaveTemplateSection\}/, "save section action should call the local save handler");
  assert.match(templateSectionPage, /sceneBlocks\.length/, "saved section draft should include the current scene block count");
  assert.match(templateSectionPage, /resolvedTemplateScene/, "saved section draft should use the current resolved scene text");
  assert.match(templateSectionPage, /模板小节保存草稿/, "template section should render a visible saved draft panel");
  assert.doesNotMatch(templateSectionPage, /feedback=\{\{ title: "模板小节已保存"/, "template section save should not remain feedback-only");
});

test("training template section saves editable basic fields into the local draft", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /templateSectionForm/, "template section should track basic fields in local form state");
  assert.match(templateSectionPage, /handleUpdateTemplateSectionForm/, "template section should expose a basic form update handler");
  assert.match(templateSectionPage, /value=\{templateSectionForm\.title\}/, "section title should be controlled by local form state");
  assert.match(templateSectionPage, /onChange=\{\(value\) => handleUpdateTemplateSectionForm\("title", value\)\}/, "section title edits should update local form state");
  assert.match(templateSectionPage, /value=\{templateSectionForm\.enabledLabel\}/, "enabled status should be controlled by local form state");
  assert.match(templateSectionPage, /onChange=\{\(value\) => handleUpdateTemplateSectionForm\("enabledLabel", value\)\}/, "enabled status changes should update local form state");
  assert.match(templateSectionPage, /sectionTitle:\s*templateSectionForm\.title/, "saved draft should use the edited section title");
  assert.match(templateSectionPage, /enabledLabel:\s*templateSectionForm\.enabledLabel/, "saved draft should use the edited enabled status");
  assert.match(templateSectionPage, /visibleTemplateSectionDraft\.enabledLabel/, "visible draft should render the saved enabled status");
});

test("training template section keeps local edits keyed by template and section", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /templateSectionStateKey/, "template section should build a stable local state key");
  assert.match(templateSectionPage, /templateSectionSceneBlocksByKey/, "scene-block edits should be stored per template section");
  assert.match(templateSectionPage, /setTemplateSectionSceneBlocksByKey/, "scene-block actions should update keyed local state");
  assert.match(templateSectionPage, /templateSectionFormsByKey/, "basic field edits should be stored per template section");
  assert.match(templateSectionPage, /setTemplateSectionFormsByKey/, "basic field changes should update keyed local state");
  assert.match(templateSectionPage, /templateSectionDraftsByKey/, "saved drafts should be stored per template section");
  assert.match(templateSectionPage, /setTemplateSectionDraftsByKey/, "save action should update keyed local drafts");
  assert.match(templateSectionPage, /templateSectionSceneBlocksByKey\[templateSectionStateKey\] \?\? activeSection\.blocks/, "scene blocks should read the active section key before falling back to fixtures");
  assert.match(templateSectionPage, /templateSectionFormsByKey\[templateSectionStateKey\] \?\?/, "basic fields should read the active section key before falling back to fixtures");
  assert.doesNotMatch(templateSectionPage, /sceneBlockState/, "template section should not use a single mutable slot for scene blocks");
  assert.doesNotMatch(templateSectionPage, /templateSectionFormState/, "template section should not use a single mutable slot for fields");
});

test("training template section state stays scoped to the active template section", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /buildTemplateSectionStateKey\(activeTemplate\.id, activeSection\.id\)/, "state keys should include both parent template and active section");
  assert.match(
    templateSectionPage,
    /templateSectionSceneBlocksByKey\[templateSectionStateKey\] \?\? activeSection\.blocks/,
    "scene blocks should read only the active keyed state",
  );
  assert.match(
    templateSectionPage,
    /\[templateSectionStateKey\]: updater\(current\[templateSectionStateKey\] \?\? activeSection\.blocks\)/,
    "scene-block updates should write only the active keyed state",
  );
  assert.match(resourceSource, /type TemplateSectionDraftState = \{[\s\S]*?templateId:\s*string;/, "saved template section drafts should be typed with the parent template id");
  assert.match(resourceSource, /type TemplateSectionDraftState = \{[\s\S]*?sectionId:\s*string;/, "saved template section drafts should be typed with the active section id");
  assert.match(templateSectionPage, /templateId:\s*activeTemplate\.id/, "scene-block updates and saved drafts should store the active template id");
  assert.match(templateSectionPage, /sectionId:\s*activeSection\.id/, "scene-block updates and saved drafts should store the active section id");
  assert.match(templateSectionPage, /editingTemplateBlockState/, "editing template block state should be stored with route context");
  assert.match(
    templateSectionPage,
    /editingTemplateBlockState\.templateId === activeTemplate\.id && editingTemplateBlockState\.sectionId === activeSection\.id \? editingTemplateBlockState\.blockId : null/,
    "editing template block state should reset after template or section changes",
  );
  assert.match(templateSectionPage, /isEditing=\{visibleEditingTemplateBlockId === block\.id\}/, "template block cards should only receive scoped edit state");
  assert.match(
    templateSectionPage,
    /const visibleTemplateSectionDraft = templateSectionDraftsByKey\[templateSectionStateKey\] \?\? null/,
    "saved template section drafts should read only the active keyed draft",
  );
  assert.match(templateSectionPage, /visibleTemplateSectionDraft/, "template section should render through a scoped visible draft");
  assert.doesNotMatch(
    templateSectionPage,
    /sceneBlockState/,
    "single-slot scene-block state should not replace keyed template-section state",
  );
  assert.doesNotMatch(
    templateSectionPage,
    /templateSectionDraft\?\.templateId/,
    "saved drafts should not be filtered from a single mutable draft slot",
  );
  assert.doesNotMatch(
    templateSectionPage,
    /\{templateSectionDraft \? \(/,
    "template section should not render an unscoped saved draft",
  );
  assert.doesNotMatch(
    templateSectionPage,
    /const \[editingTemplateBlockId, setEditingTemplateBlockId\] = useState<string \| null>\(null\)/,
    "editing template block state should not be stored without route context",
  );
});

test("training template section scene-block styles are responsive", () => {
  for (const className of [
    "templateSceneBlockList",
    "templateSceneBlockCard",
    "templateSceneBlockActions",
    "templateResolvedPreview",
    "trainingTemplateSectionDraft",
  ]) {
    assert.match(cssSource, new RegExp(`\\.${className}\\b`), `${className} CSS should exist`);
  }
  assert.match(cssSource, /@media \(max-width:\s*639px\)[\s\S]*?\.templateSceneBlockCard/, "template scene blocks should adapt on mobile");
});
