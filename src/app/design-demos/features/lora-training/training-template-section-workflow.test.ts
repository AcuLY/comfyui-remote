import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const resourceSource = readFileSync(resolve(testDir, "training-resource-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-resource-pages.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(testDir, "fixtures.ts"), "utf8");
const typesSource = readFileSync(resolve(testDir, "types.ts"), "utf8");

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

  for (const label of ["导入预制", "添加本地块"]) {
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
  assert.match(templateSectionPage, /setSceneBlocks/, "template section block actions should update local state");
  assert.match(templateSectionPage, /handleAddLocalTemplateBlock/, "template section should add a local draft block");
  assert.match(templateSectionPage, /handleMoveTemplateBlock/, "template section should reorder blocks locally");
  assert.match(templateSectionPage, /handleDeleteTemplateBlock/, "template section should delete blocks locally");
  assert.match(templateSectionPage, /editingTemplateBlockId/, "template section should track the block currently being edited");
  assert.match(templateSectionPage, /handleUpdateTemplateBlock/, "template section should update block text fields locally");
  assert.match(templateSectionPage, /sceneBlocks\.map/, "template block list should render the local block state");
  assert.match(templateSectionPage, /isEditing=\{editingTemplateBlockId === block\.id\}/, "template block cards should receive edit state");
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

test("training template section imports training presets into local scene blocks", () => {
  const templateSectionPage = sourceFrom("export function LoraTrainingTemplateSectionPage");

  assert.match(templateSectionPage, /const training = buildLoraTrainingDemoData\(data\)/, "template section should read available training presets");
  assert.match(templateSectionPage, /handleImportTemplatePresetBlock/, "template section should define a preset import action");
  assert.match(templateSectionPage, /source:\s*"预制"/, "imported template blocks should keep the preset source label");
  assert.match(templateSectionPage, /training\.presets\[0\]/, "demo import should copy a real preset fixture instead of showing a placeholder");
  assert.match(templateSectionPage, /onClick=\{handleImportTemplatePresetBlock\}/, "template import button should call the preset import action");
  assert.doesNotMatch(templateSectionPage, /导入预制入口已预览/, "template preset import should not be a preview-only placeholder");
});

test("training template section scene-block styles are responsive", () => {
  for (const className of [
    "templateSceneBlockList",
    "templateSceneBlockCard",
    "templateSceneBlockActions",
    "templateResolvedPreview",
  ]) {
    assert.match(cssSource, new RegExp(`\\.${className}\\b`), `${className} CSS should exist`);
  }
  assert.match(cssSource, /@media \(max-width:\s*639px\)[\s\S]*?\.templateSceneBlockCard/, "template scene blocks should adapt on mobile");
});
