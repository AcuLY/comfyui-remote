import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const sectionDetailSource = readFileSync(resolve(featureUiDir, "training-project-section-detail-page.tsx"), "utf8");
const featureRoot = resolve(testDir, "../src/features/training");
const detailSource = readFileSync(resolve(featureUiDir, "training-run-detail-page.tsx"), "utf8");
const detailUtilsSource = readFileSync(resolve(featureUiDir, "training-run-detail-utils.ts"), "utf8");
const detailCss = readFileSync(resolve(featureUiDir, "training-run-detail-page.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(featureRoot, "build.ts"), "utf8");
const typesSource = readFileSync(resolve(featureRoot, "types.ts"), "utf8");
const legacyDetailSource = readFileSync(resolve(testDir, "../src/app/design-demos/features/lora-training/training-run-detail-page.tsx"), "utf8");

test("training run detail implementation is owned by the training feature layer", () => {
  assert.match(
    legacyDetailSource,
    /export \{ LoraTrainingRunDetailPage \} from "@\/features\/training\/ui\/training-run-detail-page";/,
    "design-demos run detail file should re-export the feature-layer run detail implementation",
  );
});

test("training run detail keeps the compact detail header with dataset-version training titles", () => {
  const headerStart = detailSource.indexOf("<PageHeader");
  const headerEnd = detailSource.indexOf("/>", headerStart);
  assert.notEqual(headerStart, -1, "training run detail should render a PageHeader");
  assert.notEqual(headerEnd, -1, "training run detail PageHeader should be self-closing");

  const headerSource = detailSource.slice(headerStart, headerEnd);

  assert.match(headerSource, /back=\{\{ href: "\/training\/runs", label: "返回运行" \}\}/, "detail header should keep the back link");
  assert.match(headerSource, /title=\{trainingRunDetailTitle\(currentRun, project\)\}/, "detail header should use the product-facing run detail title helper");
  assert.match(headerSource, /actions=/, "detail header should keep direct object actions");
  assert.doesNotMatch(headerSource, /eyebrow=/, "detail header should not duplicate the task kind above the title");
  assert.doesNotMatch(headerSource, /subtitle=/, "detail header should keep summary and timestamp inside the page body");
  assert.doesNotMatch(headerSource, /title=\{`\$\{currentRun\.projectTitle\} \/ \$\{currentRun\.title\}`\}/, "training detail should not expose the internal training task title as the page title");
});

test("training run detail pure helpers live in a focused utility module", () => {
  for (const helperName of [
    "isProductionTrainingPath",
    "findRun",
    "trainingRunDetailTitle",
    "progressPercent",
    "trainingConfigText",
    "generationResultsForRun",
    "trainingArtifactLabel",
    "trainingPresetStatusLabel",
  ]) {
    assert.match(detailUtilsSource, new RegExp(`export function ${helperName}\\b`), `${helperName} should live in training-run-detail-utils.ts`);
    assert.doesNotMatch(detailSource, new RegExp(`\\nfunction ${helperName}\\b`), `${helperName} should not stay inline in the broad run detail page`);
  }
  assert.match(detailSource, /from "\.\/training-run-detail-utils"/, "run detail page should import focused pure helpers");
});

test("training run detail title uses dataset version for training runs and task title for generation runs", () => {
  const helperStart = detailUtilsSource.indexOf("export function trainingRunDetailTitle");
  const helperEnd = detailUtilsSource.indexOf("export function progressPercent", helperStart);
  assert.notEqual(helperStart, -1, "run detail should define a product-facing title helper");
  assert.notEqual(helperEnd, -1, "title helper should live before progress helper");

  const helperSource = detailUtilsSource.slice(helperStart, helperEnd);

  assert.match(helperSource, /run\.kind === "training"/, "training runs should receive dataset-version titles");
  assert.match(helperSource, /project\?\.datasetRevisions\.find/, "training title should prefer the matched dataset revision version");
  assert.match(helperSource, /project\?\.datasetVersion/, "training title should fall back to the project dataset version");
  assert.match(helperSource, /return `\$\{run\.projectTitle\} \/ 数据集 \$\{datasetVersion\}`;/, "training titles should use compact dataset-version copy");
  assert.match(helperSource, /return `\$\{run\.projectTitle\} \/ \$\{run\.title\}`;/, "generation titles should keep the concrete task title");
});

test("training run detail route helper does not replace invalid ids with first fixtures", () => {
  const helperStart = detailUtilsSource.indexOf("export function findRun");
  const helperEnd = detailUtilsSource.indexOf("export function progressPercent", helperStart);
  assert.notEqual(helperStart, -1, "run detail should define a route helper");
  assert.notEqual(helperEnd, -1, "run detail helper should end before progress helper");

  const helperSource = detailUtilsSource.slice(helperStart, helperEnd);
  assert.match(helperSource, /if \(!runId\) return undefined;/, "missing run ids should render the empty state");
  assert.doesNotMatch(helperSource, /\?\?\s*training\.runs\.find\(\(run\) => run\.kind === kind\)/, "invalid run ids should not silently render the first run of the same kind");
  assert.match(detailSource, /if \(!run\) return <EmptyPage title=\{kind === "generation" \? "没有生成任务数据" : "没有训练任务数据"\} \/>;/, "invalid run ids should reach the explicit empty state");
});

test("training run fixtures expose final artifact, config, logs, and frozen caption samples", () => {
  for (const field of [
    "finalLoraArtifactId",
    "presetCreatedAt",
    "trainingConfig",
    "trainingLogLines",
    "datasetSamples",
    "caption",
  ]) {
    assert.match(typesSource, new RegExp(`\\b${field}\\b`), `LoraTrainingRun should expose ${field}`);
  }

  const completedRun = fixtureSource.slice(
    fixtureSource.indexOf('id: "train-vela-v5"'),
    fixtureSource.indexOf('id: "train-azure-v4"'),
  );

  assert.match(completedRun, /finalLoraArtifactId/, "completed training run should point at the saved final LoRA artifact");
  assert.match(completedRun, /trainingConfig/, "completed training run should include a reproducible config snapshot");
  assert.match(completedRun, /trainingLogLines/, "completed training run should include a training log preview");
  assert.match(completedRun, /datasetSamples/, "completed training run should include frozen dataset samples");
  assert.match(fixtureSource, /caption:/, "dataset samples should carry frozen caption snapshots");
});

test("training detail page renders training samples, captions, log preview, and narrow preset creation gate", () => {
  const presetGateMatch = detailSource.match(/const canCreatePreset = [^;]+;/);
  assert.ok(presetGateMatch, "training detail should define a narrow preset creation gate");
  const presetGateSource = presetGateMatch[0];

  assert.match(detailSource, /训练集样本/, "training detail should render a dataset sample panel");
  assert.match(detailSource, /训练日志/, "training detail should render a training log panel");
  assert.match(detailSource, /ImagePreviewLarge/, "training samples should open with the shared lightbox preview");
  assert.match(detailSource, /activeSampleState/, "training detail should track the active sample for preview");
  assert.match(detailSource, /sample\.caption/, "training sample cards should show caption snapshots");
  assert.match(presetGateSource, /currentRun\.status === "completed"/, "preset creation should only be available after completed training runs");
  assert.match(presetGateSource, /currentRun\.finalLoraArtifactId/, "preset creation should depend on the final LoRA artifact");
  assert.match(presetGateSource, /!currentRun\.presetCreatedAt/, "preset creation should hide after a preset already exists");
});

test("training detail distinguishes missing artifacts by run lifecycle", () => {
  const artifactHelperStart = detailUtilsSource.indexOf("export function trainingArtifactLabel");
  const presetHelperStart = detailUtilsSource.indexOf("export function trainingPresetStatusLabel");
  const outputGridStart = detailSource.indexOf("function GenerationOutputGrid");
  assert.notEqual(artifactHelperStart, -1, "training detail should define an artifact label helper");
  assert.notEqual(presetHelperStart, -1, "training detail should define a preset status helper");
  assert.notEqual(outputGridStart, -1);

  const helperSource = detailUtilsSource.slice(artifactHelperStart);
  const detailPageSource = detailSource.slice(detailSource.indexOf("export function LoraTrainingRunDetailPage"));

  assert.match(helperSource, /run\.status === "failed"/, "artifact copy should branch on failed runs");
  assert.match(helperSource, /未生成模型文件/, "failed runs should say the model file was not generated");
  assert.match(helperSource, /尚未生成模型文件/, "queued or running runs should say the model file is not generated yet");
  assert.match(helperSource, /不可创建/, "failed runs without artifacts should not imply preset creation is waiting");
  assert.match(helperSource, /等待模型文件/, "queued or running runs should keep a waiting-for-model preset state");
  assert.match(detailPageSource, /trainingArtifactLabel\(currentRun\)/, "artifact stat should use the lifecycle-aware helper");
  assert.match(detailPageSource, /trainingPresetStatusLabel\(currentRun, canCreatePreset, presetCreatedAt\)/, "preset stat should use the lifecycle-aware helper");
  assert.doesNotMatch(detailPageSource, /等待 LoRA 文件/, "training detail should not use one generic missing-artifact preset state");
  assert.doesNotMatch(detailPageSource, /尚未生成 LoRA 文件/, "training detail should not use one generic missing-artifact model state");
});

test("completed image generation detail renders result thumbnails with review actions", () => {
  assert.match(typesSource, /outputResultIds\?:\s*string\[\]/, "generation runs should identify their concrete output results");
  assert.match(fixtureSource, /outputResultIds:\s*\["vela-neon-result-1"\]/, "completed image generation fixture should point at the result-pool output");
  assert.match(detailSource, /generationOutputResults/, "generation detail should derive concrete output results");
  assert.match(detailSource, /resultReviewState/, "generation output review state should be local to the detail page");
  assert.match(detailSource, /handleReviewGenerationOutput/, "generation output review actions should update local state");
  assert.match(detailSource, /setActiveGenerationResultId/, "generation result thumbnails should open a lightbox by result id");
  assert.match(detailSource, /ImageThumbMedium[\s\S]*image=\{result\.image\}[\s\S]*onOpen=\{\(\) => onActiveResultChange\(result\.id\)\}/, "generation image outputs should render as clickable thumbnails");
  assert.match(detailSource, /ImagePreviewLarge/, "generation image outputs should use the shared lightbox");
  assert.match(detailSource, /onReviewStatusChange=\{handleReviewGenerationOutput\}/, "generation output cards should wire keep/reject actions");
  assert.match(detailCss, /\.generationOutputGrid\b/, "generation outputs should have a dedicated thumbnail grid");
  assert.match(detailCss, /\.generationOutputCaption\b/, "generation output captions should be compact text below thumbnails");
});

test("completed image generation detail reviews outputs through the formal HTTP API on production routes", () => {
  assert.match(detailSource, /usePathname/, "generation output review should detect whether it is running under production \\/training routes");
  assert.match(detailSource, /fetch\(`\/api\/training\/image-results\/\$\{resultId\}\/review`/, "generation output review should call the formal training image review API");
  assert.match(detailSource, /method:\s*"POST"/, "generation output review should post review decisions");
  assert.match(detailSource, /reviewStatus === "kept" \? "keep" : "reject"|toTrainingImageReviewApiStatus\(reviewStatus\)/, "generation output review should map UI review states to the HTTP contract");
  assert.match(detailSource, /pushToast/, "generation output review should surface API success or failure through the shared feedback system");
});

test("completed image generation detail can apply outputs to project reference images through the formal HTTP API", () => {
  assert.match(detailSource, /appliedGenerationOutputState/, "generation detail should keep local state for outputs applied to reference images");
  assert.match(detailSource, /handleApplyGenerationOutput/, "generation detail should define an explicit apply-output handler");
  assert.match(detailSource, /fetch\(`\/api\/training\/generation-outputs\/\$\{resultId\}\/apply`/, "generation output apply should call the formal training generation-output API");
  assert.match(detailSource, /targetEntityType:\s*"reference_image"/, "generation output apply should target reference-image application");
  assert.match(detailSource, /targetEntityId:\s*currentRun\.projectId/, "generation output apply should scope the target to the current project");
  assert.match(detailSource, /已加入资料图/, "generation output apply should expose a visible applied state");
  assert.match(detailSource, /pushToast/, "generation output apply should surface API success or failure through the shared feedback system");
});

test("image generation detail prioritizes output before final input", () => {
  const detailGridStart = detailSource.indexOf(`<div className={s.detailGrid}>`);
  const evidenceGridStart = detailSource.indexOf(`<div className={s.trainingEvidenceGrid}>`, detailGridStart);
  assert.notEqual(detailGridStart, -1, "detail page should render the primary detail grid");
  assert.notEqual(evidenceGridStart, -1, "detail grid should end before training-only evidence panels");

  const detailGridSource = detailSource.slice(detailGridStart, evidenceGridStart);
  const outputPanelIndex = detailGridSource.indexOf(`title={isGeneration ? "输出" : "训练产物"}`);
  const inputPanelIndex = detailGridSource.indexOf(`title={isGeneration ? "最终输入" : "训练配置"}`);

  assert.notEqual(outputPanelIndex, -1, "detail grid should contain the output panel");
  assert.notEqual(inputPanelIndex, -1, "detail grid should contain the final input/config panel");
  assert.ok(outputPanelIndex < inputPanelIndex, "generation details should surface output thumbnails before final input copy");
});

test("training run detail repeated object actions include the acted-on object name", () => {
  const outputGridStart = detailSource.indexOf("function GenerationOutputGrid");
  const detailPageStart = detailSource.indexOf("export function LoraTrainingRunDetailPage");
  assert.notEqual(outputGridStart, -1);
  assert.notEqual(detailPageStart, -1);

  const outputGridSource = detailSource.slice(outputGridStart, detailPageStart);
  const detailPageSource = detailSource.slice(detailPageStart);

  assert.match(outputGridSource, /ariaLabel=\{`保留生成输出：\$\{activeResult\.sourceLabel\}`\}/, "keep action should name the active output");
  assert.match(outputGridSource, /ariaLabel=\{`拒绝生成输出：\$\{activeResult\.sourceLabel\}`\}/, "reject action should name the active output");
  assert.match(outputGridSource, /ariaLabel=\{`加入资料图：\$\{activeResult\.sourceLabel\}`\}/, "apply-to-reference action should name the active output");
  assert.match(detailPageSource, /ariaLabel=\{`打开生成任务小节：\$\{currentRun\.title\}`\}/, "section jump should name the run context");
  assert.match(detailPageSource, /ariaLabel=\{`查看生成任务结果：\$\{currentRun\.title\}`\}/, "results jump should name the run context");
  assert.doesNotMatch(detailPageSource, /ariaLabel=\{`打开任务项目：\$\{currentRun\.projectTitle\}`\}/, "project jump should be owned by the route header, not duplicated inside the detail page");
  assert.match(detailPageSource, /ariaLabel=\{`查看训练任务数据集版本：\$\{currentRun\.title\}`\}/, "dataset jump should name the run context");
  assert.match(detailPageSource, /ariaLabel=\{`从训练任务创建预制：\$\{currentRun\.title\}`\}/, "preset creation should name the source run");
  assert.match(detailPageSource, /ariaLabel=\{`重试任务：\$\{currentRun\.title\}`\}/, "retry action should name the run");
});

test("image generation detail header links back to its training section and section results", () => {
  assert.match(detailSource, /generationOutputSection/, "generation detail should derive the output section context from result-pool data");
  assert.match(detailSource, /generationSectionHref/, "generation detail should build a direct section href");
  assert.match(detailSource, /generationResultsHref/, "generation detail should build a direct section results href");
  assert.match(detailSource, /\/sections\/\$\{generationOutputSection\.sectionId\}/, "section href should point to the concrete training section");
  assert.match(detailSource, /`\$\{generationSectionHref\}#section-results`/, "results href should point to the result anchor inside the concrete training section");
  assert.doesNotMatch(detailSource, /\/sections\/\$\{generationOutputSection\.sectionId\}\/results/, "section results should not link to a removed independent route");
  assert.match(detailSource, /<ButtonLink[\s\S]*?>\s*跳转小节\s*<\/ButtonLink>/, "generation detail should expose the same section jump as generation run review pages");
  assert.match(detailSource, /<ButtonLink[\s\S]*?>\s*查看结果\s*<\/ButtonLink>/, "generation detail should expose the result surface linked from the output");
  assert.match(sectionDetailSource, /id="section-results"/, "section detail should expose a stable result anchor");
});

test("image generation detail renders task input attachments instead of project reference images", () => {
  assert.match(typesSource, /inputImages\?:\s*TrainingImage\[\]/, "generation runs should expose the final input image attachments");
  assert.match(fixtureSource, /inputImages:\s*pickImages\(images,\s*0,\s*2\)/, "completed image generation fixture should carry concrete task input images");
  assert.match(detailSource, /currentRun\.inputImages/, "generation detail should read attachments from the run itself");
  assert.match(detailSource, /最终输入附件/, "generation detail should label input images as final request attachments");
  assert.doesNotMatch(detailSource, /project\.images/, "generation detail should not use broad project images as task input attachments");
  assert.doesNotMatch(detailSource, /关联项目参考/, "generation detail should not describe task inputs as project reference provenance");
});

test("completed training run creates presets through the real training preset form route", () => {
  assert.match(detailSource, /createdPresetState/, "run detail should keep local created-preset state");
  assert.match(detailSource, /handleCreateTrainingPreset/, "run detail should define an explicit create-preset handler");
  assert.match(detailSource, /fetch\(`\/api\/training\/training-runs\/\$\{currentRun\.id\}\/create-preset`/, "preset creation should call the formal training run preset API");
  assert.match(detailSource, /presetName:\s*`\$\{currentRun\.projectTitle\} 训练预制`/, "preset creation should derive a default preset title from the source project");
  assert.match(detailSource, /category:\s*"训练产物"/, "preset creation should default the training preset category");
  assert.match(detailSource, /folder:\s*"LoRA 产物"/, "preset creation should default the training preset folder");
  assert.match(detailSource, /router\.push\(`\/training\/presets\/\$\{payload\.data\.id\}`\)/, "preset creation should navigate to the created preset detail after success");
  assert.match(detailSource, /pushToast/, "preset creation should surface API success or failure through the shared feedback system");
  assert.doesNotMatch(detailSource, /创建预制入口已预览/, "create preset action should not remain a preview-only placeholder");
});

test("failed training run detail retry creates a visible local queued-retry draft", () => {
  assert.match(detailSource, /retryDraft/, "run detail should track a structured local retry draft");
  assert.match(detailSource, /setRetryDraft/, "retry button should update the local retry draft");
  assert.match(detailSource, /handleQueueRetry/, "retry action should use an explicit handler");
  assert.match(detailSource, /重试队列草稿/, "retried detail should render a visible queued-retry draft panel");
  assert.match(detailSource, /queuedAt/, "retry draft should expose when the retry was queued");
  assert.doesNotMatch(detailSource, /onClick=\{\(\) => setRetryQueued\(true\)\}/, "retry should not remain a boolean-only inline action");
  assert.match(detailSource, /!isRetryQueued/, "retry button should hide once the run is queued for retry");
});

test("failed run detail retries through the formal HTTP API on production routes", () => {
  assert.match(detailSource, /usePathname/, "retry flow should detect whether it is running under production \\/training routes");
  assert.match(detailSource, /useRouter/, "retry flow should be able to navigate to the queued retry run on production routes");
  assert.match(detailSource, /fetch\(`\/api\/training\/sections\/\$\{currentRun\.sectionId\}\/runs`/, "generation retry should call the formal section run API");
  assert.match(detailSource, /fetch\(`\/api\/training\/projects\/\$\{currentRun\.projectId\}\/training-runs`/, "training retry should call the formal project training run API");
  assert.match(detailSource, /parentRunId:\s*currentRun\.id/, "generation retry should pass the failed run id as the parent run");
  assert.match(detailSource, /projectId:\s*currentRun\.projectId/, "generation retry should keep the project scope when section ids overlap");
  assert.match(detailSource, /revisionId:\s*currentRun\.datasetRevisionId/, "training retry should pass the original dataset revision id");
  assert.match(detailSource, /targetSteps:/, "training retry should map the existing target step count into the HTTP request config");
  assert.match(detailSource, /router\.push\(`/, "retry flow should navigate to the newly queued run after a successful API response");
  assert.match(detailSource, /pushToast/, "retry flow should surface API success or failure through the shared feedback system");
});

test("queued or running training detail cancels through the formal HTTP API on production routes", () => {
  assert.match(detailSource, /`\/api\/training\/generation-tasks\/\$\{currentRun\.id\}\/cancel`/, "generation detail should call the formal generation cancel API");
  assert.match(detailSource, /`\/api\/training\/training-runs\/\$\{currentRun\.id\}\/cancel`/, "training detail should call the formal training cancel API");
  assert.match(detailSource, /method:\s*"POST"/, "training detail should cancel runs through POST");
  assert.match(detailSource, /requestedBy:/, "training detail should identify the request source when cancelling");
  assert.match(detailSource, /pushToast/, "training detail should surface cancel API success or failure through the shared feedback system");
});

test("training sample lightbox copies captions through a real local action", () => {
  assert.match(detailSource, /copiedCaption/, "run detail should track the copied caption locally");
  assert.match(detailSource, /setCopiedCaption/, "copy action should update local copied-caption state");
  assert.match(detailSource, /handleCopyActiveCaption/, "run detail should define an explicit copy-caption handler");
  assert.match(detailSource, /navigator\.clipboard/, "copy-caption handler should use the browser Clipboard API when available");
  assert.match(detailSource, /copyTextWithFallback\(caption\)/, "copy-caption handler should write the active caption text through the fallback-capable helper");
  assert.match(detailSource, /onClick=\{handleCopyActiveCaption\}/, "copy caption button should call the local copy handler");
  assert.match(detailSource, /copiedCaption\?\.sampleId === activeSample\.id/, "copy caption button should reflect the copied active sample");
  assert.doesNotMatch(detailSource, /<Button\s+icon=\{Copy\}\s+feedback=\{\{ title: "caption 已复制"/, "copy caption should not remain feedback-only");
});

test("training sample caption copy falls back when clipboard permissions are unavailable", () => {
  assert.match(detailSource, /copyTextWithFallback/, "caption copy should share a fallback-capable copy helper");
  assert.match(detailSource, /document\.createElement\("textarea"\)/, "copy fallback should create a hidden textarea");
  assert.match(detailSource, /document\.execCommand\("copy"\)/, "copy fallback should use the selection API");
  assert.match(detailSource, /\.remove\(\)/, "copy fallback should remove its temporary textarea");
  assert.match(detailCss, /\.clipboardTextarea\b/, "copy fallback should keep the temporary textarea invisible");
});

test("training sample lightbox state stays scoped to the active run", () => {
  assert.match(detailSource, /type ActiveSampleState/, "run detail should type the active sample with run context");
  assert.match(detailSource, /runId:\s*string;/, "active sample and copied-caption state should store the source run id");
  assert.match(
    detailSource,
    /activeSampleState\?\.runId === currentRun\.id \? datasetSamples\[activeSampleState\.index\] \?\? null : null/,
    "active sample lookup should only reuse the index for the same run",
  );
  assert.match(
    detailSource,
    /onOpen=\{\(\) => setActiveSampleState\(\{ index, runId: currentRun\.id \}\)\}/,
    "sample cards should store the current run id when opening the lightbox",
  );
  assert.match(
    detailSource,
    /copiedCaption\?\.runId === currentRun\.id && copiedCaption\?\.sampleId === activeSample\.id/,
    "copied-caption state should only mark captions copied for the same run",
  );
  assert.doesNotMatch(
    detailSource,
    /const activeSample = activeSampleIndex === null \? null : datasetSamples\[activeSampleIndex\] \?\? null/,
    "a bare sample index should not leak the lightbox across run detail pages",
  );
});

test("training run detail page uses product-facing copy instead of internal implementation terms", () => {
  for (const term of [
    /不拆 provenance/i,
    /worker/i,
    /<dt>provider<\/dt>/i,
    /日志 artifact/i,
    /final LoRA/i,
    /\}\s*kept/,
    /冻结 revision/i,
    /caption 快照/i,
    /复制 caption/i,
    /caption 已/i,
    /来源脉络/,
  ]) {
    assert.doesNotMatch(detailSource, term, `training detail should not expose ${term}`);
  }
});

test("training run fixtures keep rendered sample and config copy product-facing", () => {
  for (const term of [
    /training caption snapshot/i,
    /RTX worker/i,
    /\bRTX\b/i,
    /显卡/i,
    /label:\s*"Base"/,
    /label:\s*"Network"/,
    /label:\s*"Runner"/,
    /kept 图片/i,
    /本地训练 worker/i,
    /final LoRA/i,
    /manifest 缺失/i,
    /缺失 caption/i,
    /provenance/i,
    /不拆解/,
  ]) {
    assert.doesNotMatch(fixtureSource, term, `training fixtures should not render ${term}`);
  }
});

test("training dataset sample cards keep captions compact without shrinking thumbnails", () => {
  assert.match(detailCss, /\.trainingSampleGrid\b/, "training detail should define a sample thumbnail grid");
  assert.match(detailCss, /\.trainingSampleCard\b/, "training detail should define sample card styling");
  assert.match(detailCss, /\.sampleCaption\b/, "training detail should style sample captions separately");
  assert.match(detailCss, /-webkit-line-clamp:\s*2/, "sample captions should default to a compact clipped summary");
});
