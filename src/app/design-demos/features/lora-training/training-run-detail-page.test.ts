import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(resolve(testDir, "training-run-detail-page.tsx"), "utf8");
const detailCss = readFileSync(resolve(testDir, "training-run-detail-page.module.css"), "utf8");
const fixtureSource = readFileSync(resolve(testDir, "fixtures.ts"), "utf8");
const typesSource = readFileSync(resolve(testDir, "types.ts"), "utf8");

test("training run detail keeps the compact detail header", () => {
  const headerStart = detailSource.indexOf("<PageHeader");
  const headerEnd = detailSource.indexOf("/>", headerStart);
  assert.notEqual(headerStart, -1, "training run detail should render a PageHeader");
  assert.notEqual(headerEnd, -1, "training run detail PageHeader should be self-closing");

  const headerSource = detailSource.slice(headerStart, headerEnd);

  assert.match(headerSource, /back=\{\{ href: "\/training\/runs", label: "返回运行" \}\}/, "detail header should keep the back link");
  assert.match(headerSource, /title=\{`\$\{run\.projectTitle\} \/ \$\{run\.title\}`\}/, "detail header should use the task object title");
  assert.match(headerSource, /actions=/, "detail header should keep direct object actions");
  assert.doesNotMatch(headerSource, /eyebrow=/, "detail header should not duplicate the task kind above the title");
  assert.doesNotMatch(headerSource, /subtitle=/, "detail header should keep summary and timestamp inside the page body");
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
  assert.match(detailSource, /run\.finalLoraArtifactId/, "preset creation should depend on the final LoRA artifact");
  assert.match(detailSource, /!run\.presetCreatedAt/, "preset creation should hide after a preset already exists");
});

test("completed training run creates presets through the real training preset form route", () => {
  assert.match(detailSource, /function createTrainingPresetHref/, "run detail should build a concrete preset creation href");
  assert.match(detailSource, /\/training\/presets\/new/, "preset creation should navigate to the new training preset route");
  assert.match(detailSource, /sourceRun/, "preset creation should pass the source training run id");
  assert.match(detailSource, /artifact/, "preset creation should pass the final LoRA artifact name");
  assert.match(detailSource, /<ButtonLink href=\{createTrainingPresetHref\(run\)\} icon=\{ImagePlus\} tone="primary">创建预制<\/ButtonLink>/, "create preset action should be a link, not feedback-only UI");
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
  assert.match(detailSource, /writeText\(caption\)/, "copy-caption handler should write the active caption text");
  assert.match(detailSource, /onClick=\{handleCopyActiveCaption\}/, "copy caption button should call the local copy handler");
  assert.match(detailSource, /copiedCaption\?\.sampleId === activeSample\.id/, "copy caption button should reflect the copied active sample");
  assert.doesNotMatch(detailSource, /<Button\s+icon=\{Copy\}\s+feedback=\{\{ title: "caption 已复制"/, "copy caption should not remain feedback-only");
});

test("training sample lightbox state stays scoped to the active run", () => {
  assert.match(detailSource, /type ActiveSampleState/, "run detail should type the active sample with run context");
  assert.match(detailSource, /runId:\s*string;/, "active sample and copied-caption state should store the source run id");
  assert.match(
    detailSource,
    /activeSampleState\?\.runId === run\.id \? datasetSamples\[activeSampleState\.index\] \?\? null : null/,
    "active sample lookup should only reuse the index for the same run",
  );
  assert.match(
    detailSource,
    /onClick=\{\(\) => setActiveSampleState\(\{ index, runId: run\.id \}\)\}/,
    "sample cards should store the current run id when opening the lightbox",
  );
  assert.match(
    detailSource,
    /copiedCaption\?\.runId === run\.id && copiedCaption\?\.sampleId === activeSample\.id/,
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
  ]) {
    assert.doesNotMatch(detailSource, term, `training detail should not expose ${term}`);
  }
});

test("training run fixtures keep rendered sample and config copy product-facing", () => {
  for (const term of [
    /training caption snapshot/i,
    /RTX worker/i,
    /label:\s*"Base"/,
    /label:\s*"Network"/,
    /label:\s*"Runner"/,
    /kept 图片/i,
    /本地训练 worker/i,
    /final LoRA/i,
    /manifest 缺失/i,
    /缺失 caption/i,
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
