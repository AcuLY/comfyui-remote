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

test("training project pages keep backend wiring notes out of user-facing copy", () => {
  assert.doesNotMatch(pagesSource, /后端接入时/, "training project UI should not expose backend integration notes");
});

test("training project overview saves as template through the real template form route", () => {
  const overviewStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  assert.notEqual(overviewStart, -1);
  assert.notEqual(profileStart, -1);

  const overviewSource = pagesSource.slice(overviewStart, profileStart);

  assert.match(overviewSource, /saveAsTemplateHref/, "overview should build a concrete save-as-template href");
  assert.match(overviewSource, /<ButtonLink href=\{saveAsTemplateHref\} icon=\{CopyPlus\}>保存为模板<\/ButtonLink>/, "save-as-template should navigate to the template form");
  assert.match(overviewSource, /sourceProject/, "save-as-template href should carry the source project");
  assert.match(overviewSource, /sections:\s*String\(project\.sections\.length\)/, "save-as-template href should carry section count context");
  assert.doesNotMatch(overviewSource, /保存为模板入口已预览/, "save-as-template should not remain a feedback-only placeholder");
});

test("training project overview archives and restores the project locally", () => {
  const overviewStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  assert.notEqual(overviewStart, -1);
  assert.notEqual(profileStart, -1);

  const overviewSource = pagesSource.slice(overviewStart, profileStart);

  assert.match(overviewSource, /projectArchiveState/, "overview should keep local archive state for the current project");
  assert.match(overviewSource, /setProjectArchiveState/, "archive action should update local state");
  assert.match(overviewSource, /handleToggleProjectArchive/, "overview should define an archive/restore handler");
  assert.match(overviewSource, /activeProject/, "overview should pass the locally updated project into shared header/navigation");
  assert.match(overviewSource, /project=\{activeProject\}/, "ProjectHeader should receive the local archived status");
  assert.match(overviewSource, /onClick=\{handleToggleProjectArchive\}/, "archive button should call the local archive handler");
  assert.match(overviewSource, /isProjectArchived \? "恢复" : "归档"/, "archive action should visibly toggle between archive and restore");
  assert.doesNotMatch(overviewSource, /归档项目需要确认/, "archive action should not stay as a confirmation-only placeholder");
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

test("training profile page uploads reference images into local front-end state", () => {
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  const sectionsStart = pagesSource.indexOf("function SectionCard");
  assert.notEqual(profileStart, -1);
  assert.notEqual(sectionsStart, -1);

  const profileSource = pagesSource.slice(profileStart, sectionsStart);

  assert.match(profileSource, /localReferenceImages/, "profile should render references from local editable state");
  assert.match(profileSource, /setLocalReferenceImages/, "profile upload action should update local state");
  assert.match(profileSource, /handleUploadReferenceImage/, "profile should define a local upload simulation");
  assert.match(profileSource, /kind:\s*"auxiliary"/, "uploaded demo references should enter as auxiliary references");
  assert.match(profileSource, /localReferenceImages\.map/, "reference cards should render the local reference list");
  assert.match(profileSource, /onClick=\{handleUploadReferenceImage\}/, "upload action should call the local upload handler");
  assert.doesNotMatch(profileSource, /上传参考图入口已预览/, "reference upload should not remain a feedback-only placeholder");
  assert.doesNotMatch(profileSource, /后续接入文件选择和后端存储/, "reference upload should not expose backend wiring gaps in the UI");
});

test("training profile page saves a visible local profile draft instead of only showing feedback", () => {
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  const sectionsStart = pagesSource.indexOf("function SectionCard");
  assert.notEqual(profileStart, -1);
  assert.notEqual(sectionsStart, -1);

  const profileSource = pagesSource.slice(profileStart, sectionsStart);

  assert.match(profileSource, /profileDraft/, "profile page should expose a local saved profile draft");
  assert.match(profileSource, /setProfileDraft/, "save action should update local profile state");
  assert.match(profileSource, /handleSaveProfile/, "profile page should define a save handler");
  assert.match(profileSource, /onClick=\{handleSaveProfile\}/, "save button should call the local save handler");
  assert.match(profileSource, /资料保存草稿/, "profile page should render the visible saved draft panel");
  assert.match(profileSource, /localReferenceImages\.length/, "saved draft should include the current reference image count");
  assert.match(profileSource, /project\.usagePrompt/, "saved draft should preserve the current usage prompt");
  assert.doesNotMatch(profileSource, /feedback="角色资料已保存"/, "profile save should not remain a feedback-only placeholder");
});

test("training profile page saves editable profile fields into the local draft", () => {
  const profileStart = pagesSource.indexOf("export function LoraTrainingProjectProfilePage");
  const sectionsStart = pagesSource.indexOf("function SectionCard");
  assert.notEqual(profileStart, -1);
  assert.notEqual(sectionsStart, -1);

  const profileSource = pagesSource.slice(profileStart, sectionsStart);

  assert.match(profileSource, /profileForm/, "profile page should track editable profile fields in local state");
  assert.match(profileSource, /handleUpdateProfileForm/, "profile page should expose a form update handler");
  assert.match(profileSource, /value=\{profileForm\.usagePrompt\}/, "usage prompt field should be controlled by local form state");
  assert.match(profileSource, /onChange=\{\(value\) => handleUpdateProfileForm\("usagePrompt", value\)\}/, "usage prompt edits should update form state");
  assert.match(profileSource, /value=\{profileForm\.detailPrompt\}/, "detail prompt field should be controlled by local form state");
  assert.match(profileSource, /value=\{profileForm\.profileSummary\}/, "profile summary field should be controlled by local form state");
  assert.match(profileSource, /usagePrompt:\s*profileForm\.usagePrompt/, "profile draft should save the edited usage prompt");
  assert.match(profileSource, /detailPrompt:\s*profileForm\.detailPrompt/, "profile draft should save the edited detail prompt");
  assert.match(profileSource, /profileSummary:\s*profileForm\.profileSummary/, "profile draft should save the edited profile summary");
});

test("training results and dataset pages use caption-aware review grids instead of bare image grids", () => {
  assert.match(pagesSource, /function TrainingResultGrid/, "project pages should define a caption-aware training result grid");
  assert.match(pagesSource, /ImagePreviewLarge/, "training result grid should use the shared lightbox");
  assert.match(pagesSource, /result\.caption/, "result cards should render caption summaries");
  assert.match(pagesSource, /captionSnapshot/, "dataset revision pages should render frozen caption snapshots");
  assert.match(pagesSource, /manifestRows/, "dataset revision pages should render manifest rows");
  assert.match(pagesSource, /relatedTrainingRunIds/, "dataset revision pages should use related training ids");
});

test("training result review actions update local front-end review state", () => {
  const gridStart = pagesSource.indexOf("function TrainingResultGrid");
  const runRowsStart = pagesSource.indexOf("function runPreviewImages");
  const resultsPageStart = pagesSource.indexOf("export function LoraTrainingProjectResultsPage");
  const datasetPageStart = pagesSource.indexOf("export function LoraTrainingProjectDatasetPage");
  const sectionDetailStart = pagesSource.indexOf("export function LoraTrainingProjectSectionDetailPage");
  const composeStart = pagesSource.indexOf("export function LoraTrainingGenerationComposePage");
  assert.notEqual(gridStart, -1);
  assert.notEqual(runRowsStart, -1);
  assert.notEqual(resultsPageStart, -1);
  assert.notEqual(datasetPageStart, -1);
  assert.notEqual(sectionDetailStart, -1);
  assert.notEqual(composeStart, -1);

  const gridSource = pagesSource.slice(gridStart, runRowsStart);
  const resultsPageSource = pagesSource.slice(resultsPageStart, datasetPageStart);
  const sectionDetailSource = pagesSource.slice(sectionDetailStart, composeStart);

  assert.match(gridSource, /onReviewStatusChange/, "training result grid should expose a review status change callback");
  assert.match(gridSource, /onReviewStatusChange\?\.\(activeResult\.id, "kept"\)/, "keep action should mark the active result as kept");
  assert.match(gridSource, /onReviewStatusChange\?\.\(activeResult\.id, "rejected"\)/, "reject action should mark the active result as rejected");
  assert.match(resultsPageSource, /localResults/, "project result pool should render from local review state");
  assert.match(resultsPageSource, /setLocalResults/, "project result review actions should update local state");
  assert.match(resultsPageSource, /handleReviewResult/, "project results page should define a single-result review handler");
  assert.match(resultsPageSource, /handleKeepVisibleResults/, "project results page should define a batch keep handler for visible results");
  assert.match(resultsPageSource, /onReviewStatusChange=\{handleReviewResult\}/, "project results grid should be wired to the review handler");
  assert.match(sectionDetailSource, /sectionResults/, "section detail results should render from local review state");
  assert.match(sectionDetailSource, /onReviewStatusChange=\{handleReviewSectionResult\}/, "section detail result grid should be wired to a review handler");
});

test("training dataset page opens a local training draft instead of only previewing the start action", () => {
  const datasetPageStart = pagesSource.indexOf("export function LoraTrainingProjectDatasetPage");
  const revisionPageStart = pagesSource.indexOf("export function LoraTrainingProjectDatasetRevisionPage");
  assert.notEqual(datasetPageStart, -1);
  assert.notEqual(revisionPageStart, -1);

  const datasetPageSource = pagesSource.slice(datasetPageStart, revisionPageStart);

  assert.match(datasetPageSource, /trainingDraft/, "dataset page should expose a local training draft state");
  assert.match(datasetPageSource, /setTrainingDraft/, "start training should update local training draft state");
  assert.match(datasetPageSource, /handleOpenTrainingDraft/, "dataset page should define a start-training handler");
  assert.match(datasetPageSource, /onClick=\{handleOpenTrainingDraft\}/, "start training button should call the local draft handler");
  assert.match(datasetPageSource, /训练配置草稿/, "dataset page should render a visible training draft panel");
  assert.match(datasetPageSource, /project\.datasetVersion/, "training draft should carry the active dataset version");
  assert.match(datasetPageSource, /project\.keptCount/, "training draft should carry kept image count");
  assert.doesNotMatch(datasetPageSource, /启动训练配置已打开/, "start training should not remain a toast-only placeholder");
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

test("project-scoped run rows manage local delete and failed retry state", () => {
  const runRowsStart = pagesSource.indexOf("function RunRows");
  const referenceSourceStart = pagesSource.indexOf("type ReferenceCandidate");
  const scopedPageStart = pagesSource.indexOf("export function LoraTrainingProjectScopedRunsPage");
  assert.notEqual(runRowsStart, -1);
  assert.notEqual(referenceSourceStart, -1);
  assert.notEqual(scopedPageStart, -1);

  const runRowsSource = pagesSource.slice(runRowsStart, referenceSourceStart);
  const scopedPageSource = pagesSource.slice(scopedPageStart);

  assert.match(scopedPageSource, /hiddenProjectRunIds/, "project task page should track locally removed run ids");
  assert.match(scopedPageSource, /retriedProjectRunIds/, "project task page should track locally retried failed run ids");
  assert.match(scopedPageSource, /handleHideProjectRun/, "project task page should define a local delete handler");
  assert.match(scopedPageSource, /handleRetryProjectRun/, "project task page should define a local retry handler");
  assert.match(scopedPageSource, /!hiddenProjectRunIds\.has\(run\.id\)/, "visible project runs should exclude locally removed runs");
  assert.match(scopedPageSource, /onHideRun=\{handleHideProjectRun\}/, "project task rows should receive the delete handler");
  assert.match(scopedPageSource, /onRetryRun=\{handleRetryProjectRun\}/, "failed project task rows should receive the retry handler");
  assert.match(scopedPageSource, /retriedRunIds=\{retriedProjectRunIds\}/, "project task rows should receive retry state");
  assert.match(runRowsSource, /onHideRun\?\.\(run\.id\)/, "row delete button should remove the run locally");
  assert.match(runRowsSource, /onRetryRun\?\.\(run\.id\)/, "row retry button should queue a failed run locally");
  assert.match(runRowsSource, /retriedRunIds\.has\(run\.id\)/, "rows should derive retry state per run");
  assert.match(runRowsSource, /已排队重试/, "retried failed rows should show queued retry state");
});

test("project-scoped failed run rows use structured failure panels", () => {
  const runRowsStart = pagesSource.indexOf("function RunRows");
  const referenceSourceStart = pagesSource.indexOf("type ReferenceCandidate");
  assert.notEqual(runRowsStart, -1);
  assert.notEqual(referenceSourceStart, -1);

  const runRowsSource = pagesSource.slice(runRowsStart, referenceSourceStart);

  assert.match(pagesSource, /function ProjectRunFailureBlock/, "project scoped rows should render failed reasons through a dedicated block");
  assert.match(runRowsSource, /projectRunRowFailed/, "failed project rows should get a dedicated layout class");
  assert.match(runRowsSource, /projectRunSecondary/, "failed project rows should move error handling into a secondary panel");
  assert.match(runRowsSource, /projectRunFailureToolbar/, "failed project rows should group copy and retry as lightweight failure actions");
  assert.match(runRowsSource, /copyProjectRunMessage/, "failed project rows should let users copy the failure reason");
  assert.doesNotMatch(runRowsSource, /run\.errorMessage \? <em className=\{s\.projectRunError\}/, "failed reasons should not stay inside the title text flow");
  assert.match(cssSource, /\.projectRunRowFailed\b/, "failed project rows should have dedicated responsive layout CSS");
  assert.match(cssSource, /\.projectRunSecondary\b/, "failed project rows should style the secondary failure panel");
  assert.match(cssSource, /\.projectRunFailureBlock\b/, "failed project rows should style the failure reason separately");
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

test("training project create page manages initial section seeds locally", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /sectionSeeds/, "initial section seeds should render from local state");
  assert.match(formSource, /setSectionSeeds/, "copy/delete seed actions should update local state");
  assert.match(formSource, /handleCopySeedSection/, "initial section seeds should expose a copy handler");
  assert.match(formSource, /handleDeleteSeedSection/, "initial section seeds should expose a delete handler");
  assert.match(formSource, /sectionSeeds\.map/, "seed cards should render the local seed list");
  assert.match(formSource, /handleCopySeedSection\(section\)/, "copy button should call the seed copy handler");
  assert.match(formSource, /handleDeleteSeedSection\(section\.id\)/, "delete button should call the seed delete handler");
});

test("training project create page toggles initial section enabled state locally", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /handleToggleSeedSection/, "initial section seeds should expose an enable toggle handler");
  assert.match(formSource, /enabled:\s*!section\.enabled/, "toggle handler should flip the section enabled state");
  assert.match(formSource, /handleToggleSeedSection\(section\.id\)/, "seed card toggle button should call the handler");
  assert.match(formSource, /section\.enabled \? "停用" : "启用"/, "toggle action should visibly switch between enabling and disabling");
  assert.match(formSource, /sectionSeeds\.filter\(\(section\) => section\.enabled\)\.length/, "created draft should use current local enabled state");
});

test("training project create page creates a local front-end draft instead of previewing a backend placeholder", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /createdProjectDraft/, "project creation should expose a local created draft summary");
  assert.match(formSource, /setCreatedProjectDraft/, "project creation should update local state when created");
  assert.match(formSource, /handleCreateProjectDraft/, "project creation should define a local create handler");
  assert.match(formSource, /onClick=\{handleCreateProjectDraft\}/, "create button should call the local create handler");
  assert.match(formSource, /createdProjectDraft \? "更新项目草稿" : "创建项目"/, "create action should visibly switch to updating the local draft");
  assert.match(formSource, /创建结果/, "project creation should render a visible created-draft result panel");
  assert.match(formSource, /sectionSeeds\.length/, "created draft should reflect the current local seed section count");
  assert.doesNotMatch(formSource, /POST \/api\/training\/projects/, "project creation should not advertise missing backend wiring in the UI");
});

test("training project create page carries selected references into the local draft", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /selectedReferenceIds/, "project creation should own selected reference state");
  assert.match(formSource, /setSelectedReferenceIds/, "project creation should update selected references locally");
  assert.match(formSource, /selectedProjectReferences/, "project creation should resolve selected reference objects");
  assert.match(formSource, /selectedReferenceTitles/, "created draft should store selected reference titles");
  assert.match(formSource, /selectedReferenceCount/, "created draft summary should expose selected reference count");
  assert.match(formSource, /handleAddProjectReference/, "project creation should define a reference add handler");
  assert.match(formSource, /onAddReference=\{handleAddProjectReference\}/, "reference picker add action should update project form state");
  assert.match(formSource, /selectedReferenceIds=\{selectedReferenceIds\}/, "reference picker should receive selected ids from project form state");
});

test("training project create page training default switches feed into the local draft", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /trainingDefaults/, "project creation should track training defaults locally");
  assert.match(formSource, /setTrainingDefaults/, "training default switches should update local state");
  assert.match(formSource, /autoGenerateSamples/, "project creation should track the initial sample-generation default");
  assert.match(formSource, /autoFreezeDataset/, "project creation should track the dataset-freeze default");
  assert.match(formSource, /checked=\{trainingDefaults\.autoGenerateSamples\}/, "sample-generation switch should be controlled by local state");
  assert.match(formSource, /checked=\{trainingDefaults\.autoFreezeDataset\}/, "dataset-freeze switch should be controlled by local state");
  assert.match(formSource, /onCheckedChange=\{\(checked\) => setTrainingDefaults/, "switch changes should update training default state");
  assert.match(formSource, /自动生成样本/, "created draft should expose the sample-generation default");
  assert.match(formSource, /自动冻结数据集/, "created draft should expose the dataset-freeze default");
  assert.match(formSource, /createdProjectDraft\.autoGenerateSamples/, "created draft summary should render the sample-generation value");
  assert.match(formSource, /createdProjectDraft\.autoFreezeDataset/, "created draft summary should render the dataset-freeze value");
});

test("training project create page saves editable form fields into the local draft", () => {
  const formStart = pagesSource.indexOf("export function LoraTrainingProjectFormPage");
  const detailStart = pagesSource.indexOf("export function LoraTrainingProjectDetailPage");
  assert.notEqual(formStart, -1);
  assert.notEqual(detailStart, -1);

  const formSource = pagesSource.slice(formStart, detailStart);

  assert.match(formSource, /projectForm/, "project creation should track editable form fields in local state");
  assert.match(formSource, /handleUpdateProjectForm/, "project creation should expose a form update handler");
  assert.match(formSource, /handleSelectTemplate/, "template selection should update both form state and seed sections");
  assert.match(formSource, /value=\{projectForm\.title\}/, "project title field should be controlled by local form state");
  assert.match(formSource, /onChange=\{\(value\) => handleUpdateProjectForm\("title", value\)\}/, "project title edits should update form state");
  assert.match(formSource, /value=\{projectForm\.baseModel\}/, "base model select should be controlled by local form state");
  assert.match(formSource, /value=\{projectForm\.captionStrategy\}/, "caption strategy select should be controlled by local form state");
  assert.match(formSource, /title:\s*projectForm\.title/, "created draft should save the edited title");
  assert.match(formSource, /usagePrompt:\s*projectForm\.usagePrompt/, "created draft should save the edited usage prompt");
  assert.match(formSource, /detailPrompt:\s*projectForm\.detailPrompt/, "created draft should save the edited detail prompt");
  assert.match(formSource, /perSectionImageCount:\s*projectForm\.perSectionImageCount/, "created draft should save the edited per-section image count");
  assert.match(formSource, /trainingSteps:\s*projectForm\.trainingSteps/, "created draft should save the edited training steps");
  assert.match(formSource, /createdProjectDraft\.usagePrompt/, "created draft summary should render the saved usage prompt");
  assert.match(formSource, /createdProjectDraft\.trainingSteps/, "created draft summary should render the saved training steps");
});
