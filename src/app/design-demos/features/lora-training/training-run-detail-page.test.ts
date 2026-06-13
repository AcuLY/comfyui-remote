import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(resolve(testDir, "training-run-detail-page.tsx"), "utf8");
const detailCss = readFileSync(resolve(testDir, "training-run-detail-page.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(testDir, "../../data/lora-training.ts"), "utf8");
const typesSource = readFileSync(resolve(testDir, "../../data/lora-training-types.ts"), "utf8");

test("training run detail keeps the compact detail header", () => {
  const headerStart = detailSource.indexOf("<PageHeader");
  const headerEnd = detailSource.indexOf("/>", headerStart);
  assert.notEqual(headerStart, -1, "training run detail should render a PageHeader");
  assert.notEqual(headerEnd, -1, "training run detail PageHeader should be self-closing");

  const headerSource = detailSource.slice(headerStart, headerEnd);

  assert.match(headerSource, /back=\{\{ href: "\/training\/runs", label: "返回运行" \}\}/, "detail header should keep the back link");
  assert.match(headerSource, /title=\{`\$\{currentRun\.projectTitle\} \/ \$\{currentRun\.title\}`\}/, "detail header should use the task object title");
  assert.match(headerSource, /actions=/, "detail header should keep direct object actions");
  assert.doesNotMatch(headerSource, /eyebrow=/, "detail header should not duplicate the task kind above the title");
  assert.doesNotMatch(headerSource, /subtitle=/, "detail header should keep summary and timestamp inside the page body");
});

test("training run detail route helper does not replace invalid ids with first fixtures", () => {
  const helperStart = detailSource.indexOf("function findRun");
  const helperEnd = detailSource.indexOf("function progressPercent", helperStart);
  assert.notEqual(helperStart, -1, "run detail should define a route helper");
  assert.notEqual(helperEnd, -1, "run detail helper should end before progress helper");

  const helperSource = detailSource.slice(helperStart, helperEnd);
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
  assert.match(detailSource, /训练集样本/, "training detail should render a dataset sample panel");
  assert.match(detailSource, /训练日志/, "training detail should render a training log panel");
  assert.match(detailSource, /ImagePreviewLarge/, "training samples should open with the shared lightbox preview");
  assert.match(detailSource, /activeSampleState/, "training detail should track the active sample for preview");
  assert.match(detailSource, /sample\.caption/, "training sample cards should show caption snapshots");
  assert.match(detailSource, /currentRun\.finalLoraArtifactId/, "preset creation should depend on the final LoRA artifact");
  assert.match(detailSource, /!currentRun\.presetCreatedAt/, "preset creation should hide after a preset already exists");
});

test("completed image generation detail renders result thumbnails with review actions", () => {
  assert.match(typesSource, /outputResultIds\?:\s*string\[\]/, "generation runs should identify their concrete output results");
  assert.match(fixtureSource, /outputResultIds:\s*\["vela-neon-result-1"\]/, "completed image generation fixture should point at the result-pool output");
  assert.match(detailSource, /generationOutputResults/, "generation detail should derive concrete output results");
  assert.match(detailSource, /resultReviewState/, "generation output review state should be local to the detail page");
  assert.match(detailSource, /handleReviewGenerationOutput/, "generation output review actions should update local state");
  assert.match(detailSource, /setActiveGenerationResultId/, "generation result thumbnails should open a lightbox by result id");
  assert.match(detailSource, /ImagePreviewFrame image=\{result\.image\}/, "generation image outputs should render as clickable thumbnails");
  assert.match(detailSource, /ImagePreviewLarge/, "generation image outputs should use the shared lightbox");
  assert.match(detailSource, /onReviewStatusChange=\{handleReviewGenerationOutput\}/, "generation output cards should wire keep/reject actions");
  assert.match(detailCss, /\.generationOutputGrid\b/, "generation outputs should have a dedicated thumbnail grid");
  assert.match(detailCss, /\.generationOutputCaption\b/, "generation output captions should be compact text below thumbnails");
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
  assert.match(detailPageSource, /ariaLabel=\{`打开生成任务小节：\$\{currentRun\.title\}`\}/, "section jump should name the run context");
  assert.match(detailPageSource, /ariaLabel=\{`查看生成任务结果：\$\{currentRun\.title\}`\}/, "results jump should name the run context");
  assert.match(detailPageSource, /ariaLabel=\{`打开任务项目：\$\{currentRun\.projectTitle\}`\}/, "project jump should name the target project");
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
  assert.match(readFileSync(resolve(testDir, "training-project-pages.tsx"), "utf8"), /id="section-results"/, "section detail should expose a stable result anchor");
});

test("image generation detail renders task input attachments instead of project reference images", () => {
  assert.match(typesSource, /inputImages\?:\s*DemoImage\[\]/, "generation runs should expose the final input image attachments");
  assert.match(fixtureSource, /inputImages:\s*pickImages\(images,\s*0,\s*2\)/, "completed image generation fixture should carry concrete task input images");
  assert.match(detailSource, /currentRun\.inputImages/, "generation detail should read attachments from the run itself");
  assert.match(detailSource, /最终输入附件/, "generation detail should label input images as final request attachments");
  assert.doesNotMatch(detailSource, /project\.images/, "generation detail should not use broad project images as task input attachments");
  assert.doesNotMatch(detailSource, /关联项目参考/, "generation detail should not describe task inputs as project reference provenance");
});

test("completed training run creates presets through the real training preset form route", () => {
  assert.match(detailSource, /function createTrainingPresetHref/, "run detail should build a concrete preset creation href");
  assert.match(detailSource, /\/training\/presets\/new/, "preset creation should navigate to the new training preset route");
  assert.match(detailSource, /sourceRun/, "preset creation should pass the source training run id");
  assert.match(detailSource, /artifact/, "preset creation should pass the final LoRA artifact name");
  assert.match(detailSource, /<ButtonLink[\s\S]*?href=\{createTrainingPresetHref\(currentRun\)\}[\s\S]*?>\s*创建预制\s*<\/ButtonLink>/, "create preset action should be a link, not feedback-only UI");
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
    /onClick=\{\(\) => setActiveSampleState\(\{ index, runId: currentRun\.id \}\)\}/,
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
