import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(testDir, "training-runs-page.tsx"), "utf8");
const cssSource = readFileSync(resolve(testDir, "training-runs-page.module.css"), "utf8");

test("training runs page keeps the generated-run workbench hierarchy", () => {
  assert.match(pageSource, /currentRunSurface/, "runs page should expose a current-running progress surface");
  assert.match(pageSource, /runningRunsForKind/, "current-running surface should be derived from the active task kind");
  assert.match(pageSource, /progressLabel/, "running cards should render a concrete progress label");
  assert.match(cssSource, /\.currentRunSurface\b/, "current-running surface should have dedicated styling");
  assert.match(cssSource, /\.currentRunProgressTrack\b/, "current-running cards should use a compact progress bar");
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

test("training run delete actions remove runs locally instead of previewing a placeholder", () => {
  assert.match(pageSource, /hiddenRunIds/, "runs page should track locally removed runs");
  assert.match(pageSource, /hideRuns/, "runs page should define a shared local delete handler");
  assert.match(pageSource, /onClick=\{\(\) => hideRuns\(selectedIds\)\}/, "batch delete should call the local delete handler");
  assert.match(pageSource, /onClick=\{\(\) => hideRuns\(\[run\.id\]\)\}/, "row delete should call the local delete handler");
  assert.match(pageSource, /任务已从列表移除/, "delete feedback should describe the local state change");
  assert.doesNotMatch(pageSource, /删除动作已预览/, "delete actions should not remain preview-only placeholders");
});
