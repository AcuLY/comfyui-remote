import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(testDir, "training-runs-page.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-runs-page.module.css"), "utf8");

test("training runs page keeps the queue-demo compact header", () => {
  const headerStart = pageSource.indexOf("<PageHeader");
  const headerEnd = pageSource.indexOf("/>", headerStart);
  assert.notEqual(headerStart, -1, "runs page should render a PageHeader");
  assert.notEqual(headerEnd, -1, "runs page PageHeader should be a compact self-closing header");

  const headerSource = pageSource.slice(headerStart, headerEnd);

  assert.match(headerSource, /title="运行"/, "runs page title should stay compact");
  assert.doesNotMatch(headerSource, /eyebrow=/, "runs page should not add a redundant LoRA Training eyebrow");
  assert.doesNotMatch(headerSource, /subtitle=/, "runs page should not add explanatory header copy above the task tabs");
});

test("training runs page keeps the generated-run workbench hierarchy", () => {
  assert.match(pageSource, /currentRunSurface/, "runs page should expose a current-running progress surface");
  assert.match(pageSource, /runningRunsForKind/, "current-running surface should be derived from the active task kind");
  assert.match(pageSource, /progressLabel/, "running cards should render a concrete progress label");
  assert.match(cssSource, /\.currentRunSurface\b/, "current-running surface should have dedicated styling");
  assert.match(cssSource, /\.currentRunProgressTrack\b/, "current-running cards should use a compact progress bar");
});

test("training current-running cards adapt from their own surface width", () => {
  assert.match(
    cssSource,
    /\.currentRunSurface\s*\{[\s\S]*?container-type:\s*inline-size/,
    "current-running surface should be a container query root like the generated-run demo",
  );
  assert.match(
    cssSource,
    /@container\s*\(max-width:\s*860px\)\s*\{[\s\S]*?\.currentRunItem\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    "current-running card layout should collapse from the surface width, not the viewport width",
  );
  assert.doesNotMatch(
    cssSource,
    /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.currentRunItem/,
    "current-running cards should not rely on viewport-only media queries inside desktop shells",
  );
});

test("training runs page keeps status counts only in status tabs", () => {
  assert.match(pageSource, /items=\{STATUS_ITEMS\.map\(\(item\) => \(\{ \.\.\.item, count: countFor\(kind, item\.value\) \}\)\)\}/, "status tabs should own the status counts");
  assert.doesNotMatch(pageSource, /modeSummary/, "runs page should not render a separate top status summary");
  assert.doesNotMatch(pageSource, /metricCard/, "runs page should not duplicate status counts in metric cards");
  assert.doesNotMatch(cssSource, /\.modeSummary\b/, "runs page styles should not keep the removed status summary surface");
  assert.doesNotMatch(cssSource, /\.metricCard\b/, "runs page styles should not keep duplicate status metric cards");
});

test("completed training generation rows prioritize recent output thumbnails", () => {
  assert.match(pageSource, /ImageListSmall/, "completed generation rows should use the shared small thumbnail strip");
  assert.match(pageSource, /runPreviewImages/, "run rows should resolve preview images from project results or dataset samples");
  assert.match(pageSource, /\bresultPool\b/, "generation rows should source image previews from the project result pool");
  assert.match(pageSource, /run\.datasetSamples/, "training rows should fall back to frozen dataset samples");
  assert.match(cssSource, /\.runThumbs\b/, "run rows should style thumbnail strips separately from text content");
  assert.match(cssSource, /data-demo-ui-image-thumb-small/, "thumbnail sizing should target shared small image thumbs");
});

test("failed training runs can be retried in local front-end state", () => {
  assert.match(pageSource, /retriedRunIds/, "runs page should track retried failed runs locally");
  assert.match(pageSource, /setRetriedRunIds/, "retry actions should update retried run state");
  assert.match(pageSource, /retryRuns/, "runs page should define a shared retry handler");
  assert.match(pageSource, /onClick=\{\(\) => retryRuns\(selectedIds\)\}/, "batch retry should call the local retry handler");
  assert.match(pageSource, /onClick=\{\(\) => retryRuns\(\[run\.id\]\)\}/, "row retry should call the local retry handler");
  assert.match(pageSource, /retried \? " · 已重试" : ""/, "retried rows should show inline retry state");
  assert.match(pageSource, /已排队重试/, "retried rows should show queued-retry status");
});

test("failed training run rows use a structured failure block instead of single-line text", () => {
  assert.match(pageSource, /TrainingRunFailureBlock/, "failed run rows should render a dedicated failure block");
  assert.match(pageSource, /run\.errorMessage \?\?/, "failed run rows should derive a fallback error message");
  assert.match(pageSource, /copyRunMessage/, "failed run rows should expose a local copy action for the error");
  assert.doesNotMatch(pageSource, /className=\{s\.runError\}/, "failed run rows should not keep errors as a single inline text span");
  assert.match(cssSource, /\.runRowFailed\b/, "failed run rows should have a dedicated grid layout");
  assert.match(cssSource, /\.runSecondary\b/, "failed run rows should have a secondary failure area");
  assert.match(cssSource, /\.runFailureToolbar\b/, "failed run rows should keep copy and retry actions in a compact toolbar");
});

test("failed training run errors clamp long text with an expand affordance", () => {
  assert.match(pageSource, /const ERROR_CLAMP_LINES = 3;/, "failed error copy should use the same compact clamp depth as the generated-run demo");
  assert.match(pageSource, /useRef<HTMLParagraphElement>/, "failure block should measure the rendered paragraph");
  assert.match(pageSource, /setOverflows\(node\.scrollHeight > node\.clientHeight \+ 2\)/, "failure block should detect whether the clamped text overflows");
  assert.match(pageSource, /!expanded && s\.runFailureTextClamped/, "failure text should stay clamped until expanded");
  assert.match(pageSource, /展开/, "overflowing failure text should expose an expand control");
  assert.match(pageSource, /收起/, "expanded failure text should expose a collapse control");
  assert.match(cssSource, /\.runFailureTextClamped\b/, "failed run errors should have a dedicated clamped text style");
  assert.match(cssSource, /-webkit-line-clamp:\s*var\(--error-clamp-lines,\s*3\)/, "failed run errors should clamp to the shared line count variable");
});

test("failed training run copy action falls back when clipboard permissions are unavailable", () => {
  assert.match(pageSource, /document\.createElement\("textarea"\)/, "copy action should create a hidden textarea fallback");
  assert.match(pageSource, /document\.execCommand\("copy"\)/, "copy action should use the selection API fallback");
  assert.match(pageSource, /\.remove\(\)/, "copy fallback should remove its temporary textarea");
  assert.match(cssSource, /\.clipboardTextarea\b/, "copy fallback should keep the temporary textarea invisible");
});

test("failed training run toolbar keeps text buttons wider than row icon actions", () => {
  const rowActionButtonIndex = cssSource.indexOf(".rowActions :where([data-demo-ui-button=\"true\"])");
  const failureToolbarButtonIndex = cssSource.indexOf(".runFailureToolbar :where([data-demo-ui-button=\"true\"])");

  assert.notEqual(rowActionButtonIndex, -1, "row action icon button styles should exist");
  assert.notEqual(failureToolbarButtonIndex, -1, "failure toolbar button styles should exist");
  assert.ok(
    failureToolbarButtonIndex > rowActionButtonIndex,
    "failure toolbar button styles must appear after row action icon styles so copy/retry stay text buttons",
  );
  assert.match(
    cssSource.slice(failureToolbarButtonIndex, failureToolbarButtonIndex + 220),
    /width:\s*auto;/,
    "failure toolbar buttons should not inherit icon-only square width",
  );
});

test("training run delete actions remove runs locally instead of previewing a placeholder", () => {
  assert.match(pageSource, /hiddenRunIds/, "runs page should track locally removed runs");
  assert.match(pageSource, /hideRuns/, "runs page should define a shared local delete handler");
  assert.match(pageSource, /onClick=\{\(\) => hideRuns\(selectedIds\)\}/, "batch delete should call the local delete handler");
  assert.match(pageSource, /onClick=\{\(\) => hideRuns\(\[run\.id\]\)\}/, "row delete should call the local delete handler");
  assert.match(pageSource, /任务已从列表移除/, "delete feedback should describe the local state change");
  assert.doesNotMatch(pageSource, /删除动作已预览/, "delete actions should not remain preview-only placeholders");
});
