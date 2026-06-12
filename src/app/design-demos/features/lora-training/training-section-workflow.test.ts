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

test("training section workflow has responsive rail and compact action styles", () => {
  for (const className of [
    "trainingSectionWorkspace",
    "trainingSectionRail",
    "sectionScrollPane",
    "sceneBlockActions",
    "referenceSourceTree",
    "referencePreview",
  ]) {
    assert.match(cssSource, new RegExp(`\\.${className}\\b`), `${className} CSS should exist`);
  }
  assert.match(cssSource, /@media \(max-width:\s*639px\)[\s\S]*?\.trainingSectionWorkspace/, "section workspace should adapt for mobile widths");
});
