import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pagesSource = readFileSync(resolve(testDir, "training-project-pages.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-project-pages.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(testDir, "fixtures.ts"), "utf8");
const typesSource = readFileSync(resolve(testDir, "types.ts"), "utf8");

test("training project fixtures model reference images, result pool captions, and dataset snapshots", () => {
  for (const typeName of [
    "LoraTrainingReferenceImage",
    "LoraTrainingImageResult",
    "LoraTrainingDatasetRevisionItem",
  ]) {
    assert.match(typesSource, new RegExp(`type ${typeName}\\b`), `${typeName} should be a first-class fixture type`);
  }

  for (const projectField of ["referenceImages", "resultPool"]) {
    assert.match(typesSource, new RegExp(`\\b${projectField}\\b`), `Project fixtures should expose ${projectField}`);
  }

  for (const revisionField of ["samples", "manifestRows", "relatedTrainingRunIds"]) {
    assert.match(typesSource, new RegExp(`\\b${revisionField}\\b`), `Dataset revisions should expose ${revisionField}`);
  }

  assert.match(fixtureSource, /captionSnapshot/, "dataset revision sample fixtures should include caption snapshots");
  assert.match(fixtureSource, /reviewStatus/, "result pool fixtures should include review status");
});

test("training project overview keeps subresource bodies out of the overview page", () => {
  const overviewStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  assert.notEqual(overviewStart, -1);
  assert.notEqual(profileStart, -1);

  const overviewSource = pagesSource.slice(overviewStart, profileStart);

  assert.match(overviewSource, /最近产物/, "overview should expose recent outputs as a light entry point");
  assert.match(overviewSource, /训练入口/, "overview should expose the training entry point");
  assert.doesNotMatch(overviewSource, /<StatGrid/, "overview should not duplicate full dataset/readiness metric grids");
  assert.doesNotMatch(overviewSource, /<ImageGrid/, "overview should not inline full results/dataset grids");
});

test("training profile page renders reference image cards with kind, label, and note", () => {
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  const sectionsStart = pagesSource.indexOf("function SectionCard");
  assert.notEqual(profileStart, -1);
  assert.notEqual(sectionsStart, -1);

  const profileSource = pagesSource.slice(profileStart, sectionsStart);

  assert.match(profileSource, /referenceImages/, "profile should render project reference image fixtures");
  assert.match(profileSource, /referenceImageCard/, "profile should use explicit reference image cards");
  assert.match(profileSource, /reference\.kind/, "reference cards should show original/generated/auxiliary kind");
  assert.match(profileSource, /reference\.label/, "reference cards should show editable labels");
  assert.match(profileSource, /reference\.note/, "reference cards should show notes");
});

test("training results and dataset pages use caption-aware review grids instead of bare image grids", () => {
  assert.match(pagesSource, /function TrainingResultGrid/, "project pages should define a caption-aware training result grid");
  assert.match(pagesSource, /ImagePreviewLarge/, "training result grid should use the shared lightbox");
  assert.match(pagesSource, /result\.caption/, "result cards should render caption summaries");
  assert.match(pagesSource, /captionSnapshot/, "dataset revision pages should render frozen caption snapshots");
  assert.match(pagesSource, /manifestRows/, "dataset revision pages should render manifest rows");
  assert.match(pagesSource, /relatedTrainingRunIds/, "dataset revision pages should use related training ids");
});

test("training result cards keep thumbnail density and clamp captions", () => {
  assert.match(cssSource, /\.trainingResultGrid\b/, "training result grid CSS should exist");
  assert.match(cssSource, /\.trainingResultCard\b/, "training result cards should exist");
  assert.match(cssSource, /\.trainingResultCaption\b/, "training result captions should be styled separately");
  assert.match(cssSource, /-webkit-line-clamp:\s*2/, "training result captions should be compact by default");
  assert.match(cssSource, /\.referenceImageGrid\b/, "profile reference image card grid CSS should exist");
  assert.match(cssSource, /\.manifestList\b/, "dataset revision manifest list CSS should exist");
});

test("project-scoped run rows use task cards with recent output thumbnails", () => {
  const runRowsStart = pagesSource.indexOf("function runPreviewImages");
  const sectionRailStart = pagesSource.indexOf("type ReferenceCandidate");
  assert.notEqual(runRowsStart, -1);
  assert.notEqual(sectionRailStart, -1);

  const runRowsSource = pagesSource.slice(runRowsStart, sectionRailStart);

  assert.match(runRowsSource, /project:\s*LoraTrainingProject/, "RunRows should receive the active project context");
  assert.match(runRowsSource, /runPreviewImages/, "RunRows should resolve previews per run");
  assert.match(runRowsSource, /ImageListSmall/, "RunRows should render the shared small thumbnail strip");
  assert.match(runRowsSource, /resultPool/, "generation task rows should source previews from project results");
  assert.match(runRowsSource, /datasetSamples/, "training task rows should source previews from dataset samples");
  assert.doesNotMatch(runRowsSource, /className=\{s\.entityRow\}/, "RunRows should not collapse back to generic entity rows");
  assert.match(cssSource, /\.projectRunRows\b/, "project run rows should have dedicated list styling");
  assert.match(cssSource, /\.projectRunThumbs\b/, "project run rows should style thumbnail strips separately");
});

test("training project create page is a full form workspace with training seed controls", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /referenceSourceTree/, "project creation should offer explicit reference sources");
  assert.match(formSource, /ReferencePicker/, "project creation should preview references before adding them");
  assert.match(formSource, /previewReference/, "reference selection should be preview-first, not immediate write");
  assert.match(formSource, /SwitchRow/, "project creation should expose default training/dataset toggles");
  assert.match(formSource, /训练默认/, "project creation should include training defaults");
  assert.match(formSource, /caption/, "project creation should include caption/dataset setup");
  assert.match(formSource, /Copy/, "initial template sections should be manageable, including copy");
  assert.match(formSource, /Trash2/, "initial template sections should be manageable, including delete");
  assert.match(formSource, /data\.models/, "project creation should choose a base model/checkpoint from demo data");
  assert.match(cssSource, /\.projectCreateWorkspace\b/, "project creation should have a dedicated workspace layout");
  assert.match(cssSource, /\.sectionSeedCard\b/, "initial section seed cards should have dedicated styling");
});
