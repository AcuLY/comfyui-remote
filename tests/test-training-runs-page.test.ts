import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const featureUiDir = resolve(testDir, "../src/features/training/ui");
const pageSource = readFileSync(resolve(featureUiDir, "training-runs-page.tsx"), "utf8");
const cssSource = readFileSync(resolve(featureUiDir, "training-runs-page.module.css"), "utf8");
const legacyPageSource = readFileSync(resolve(testDir, "../src/app/design-demos/features/lora-training/training-runs-page.tsx"), "utf8");

test("training runs page implementation is owned by the training feature layer", () => {
  assert.match(
    legacyPageSource,
    /export \{ LoraTrainingRunsPage \} from "@\/features\/training\/ui\/training-runs-page";/,
    "design-demos runs page file should re-export the feature-layer runs page",
  );
});

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
    /@container\s*\(max-width:\s*1020px\)\s*\{[\s\S]*?\.currentRunItem\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    "current-running card layout should collapse from the surface width before the two-column list crowds it",
  );
  assert.doesNotMatch(
    cssSource,
    /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.currentRunItem/,
    "current-running cards should not rely on viewport-only media queries inside desktop shells",
  );
});

test("training current-running cards keep real space between mobile rows", () => {
  const listBlockStart = cssSource.indexOf(".currentRunList {");
  const listBlockEnd = cssSource.indexOf("}", listBlockStart);
  const listBlock = cssSource.slice(listBlockStart, listBlockEnd);

  assert.notEqual(listBlockStart, -1, "current-running list styles should exist");
  assert.match(
    listBlock,
    /gap:\s*(?:8|9|10|11|12)px;/,
    "current-running task cards should have an actual list gap so mobile rows do not visually merge",
  );
});

test("training runs page keeps status counts only in status tabs", () => {
  assert.match(pageSource, /items=\{STATUS_ITEMS\.map\(\(item\) => \(\{ \.\.\.item, count: countFor\(kind, item\.value\) \}\)\)\}/, "status tabs should own the status counts");
  assert.doesNotMatch(pageSource, /modeSummary/, "runs page should not render a separate top status summary");
  assert.doesNotMatch(pageSource, /metricCard/, "runs page should not duplicate status counts in metric cards");
  assert.doesNotMatch(cssSource, /\.modeSummary\b/, "runs page styles should not keep the removed status summary surface");
  assert.doesNotMatch(cssSource, /\.metricCard\b/, "runs page styles should not keep duplicate status metric cards");
});

test("training run project groups keep the queue-demo latest-run context", () => {
  const groupStart = pageSource.indexOf("function groupRunsByProject");
  const previewStart = pageSource.indexOf("function runPreviewImages");
  const headerStart = pageSource.indexOf("className={s.runProjectHeaderToggle}");
  const checkboxStart = pageSource.indexOf("<Checkbox", headerStart);
  assert.notEqual(groupStart, -1, "runs page should define project grouping");
  assert.notEqual(previewStart, -1, "runs page should define the next helper after project grouping");
  assert.notEqual(headerStart, -1, "runs page should render a group header toggle");
  assert.notEqual(checkboxStart, -1, "runs page group header should include a selection control after the toggle");

  const groupSource = pageSource.slice(groupStart, previewStart);
  const headerSource = pageSource.slice(headerStart, checkboxStart);

  assert.match(groupSource, /latestTimestamp/, "training run groups should retain a latest timestamp summary like the queue demo");
  assert.match(groupSource, /\.sort\(/, "training run groups should sort by latest task time instead of insertion order");
  assert.match(groupSource, /timestampRank/, "training run groups should normalize the Chinese timestamp labels before sorting");
  assert.match(headerSource, /最新 \{group\.latestTimestamp\}/, "training run group headers should expose the latest task time");
});

test("training run status badges use task-specific running labels", () => {
  assert.match(
    pageSource,
    /run\.status === "running"[\s\S]*?run\.kind === "training" \? "训练中" : "生成中"/,
    "running training rows should say 训练中 while image-generation rows keep 生成中",
  );
});

test("completed training generation rows prioritize recent output thumbnails", () => {
  assert.match(pageSource, /ImageListSmall/, "completed generation rows should use the shared small thumbnail strip");
  assert.match(pageSource, /runPreviewImages/, "run rows should resolve preview images from project results or dataset samples");
  assert.match(pageSource, /\bresultPool\b/, "generation rows should source image previews from the project result pool");
  assert.match(pageSource, /run\.datasetSamples/, "training rows should fall back to frozen dataset samples");
  assert.match(cssSource, /\.runThumbs\b/, "run rows should style thumbnail strips separately from text content");
  assert.match(cssSource, /data-demo-ui-image-thumb-small/, "thumbnail sizing should target shared small image thumbs");
});

test("training run thumbnail layout queries the individual task card width", () => {
  assert.match(
    cssSource,
    /\.runRow\s*\{[\s\S]*?container-type:\s*inline-size/,
    "Each task card should be a container root so thumbnail/text layout does not key off the wider project group.",
  );
  assert.match(
    cssSource,
    /@container\s*\(min-width:\s*780px\)\s*\{[\s\S]*?\.runMainWithThumbs\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px,\s*0\.62fr\)\s*minmax\(180px,\s*1fr\)/,
    "Thumbnail/text split should only trigger when the individual card is wide enough.",
  );
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

test("failed training runs retry through the formal HTTP API on production routes", () => {
  assert.match(pageSource, /usePathname/, "runs page should detect whether it is running under production \\/training routes");
  assert.match(pageSource, /fetch\(`\/api\/training\/sections\/\$\{run\.sectionId\}\/runs`/, "failed generation rows should call the formal section run retry API");
  assert.match(pageSource, /fetch\(`\/api\/training\/projects\/\$\{run\.projectId\}\/training-runs`/, "failed training rows should call the formal project training retry API");
  assert.match(pageSource, /parentRunId:\s*run\.id/, "failed generation retries should pass the original run id as parentRunId");
  assert.match(pageSource, /projectId:\s*run\.projectId/, "failed generation retries should keep the project scope when section ids overlap");
  assert.match(pageSource, /revisionId:\s*run\.datasetRevisionId/, "failed training retries should pass the original dataset revision id");
  assert.match(pageSource, /targetSteps:/, "failed training retries should map the original target step count into the HTTP request config");
  assert.match(pageSource, /Promise\.all/, "runs page should persist all retry requests before updating local retry state");
  assert.match(pageSource, /pushToast/, "runs page should surface retry API success or failure through the shared feedback system");
});

test("queued or running training rows cancel through the formal HTTP API on production routes", () => {
  assert.match(pageSource, /`\/api\/training\/generation-tasks\/\$\{run\.id\}\/cancel`/, "generation rows should call the formal generation cancel API");
  assert.match(pageSource, /`\/api\/training\/training-runs\/\$\{run\.id\}\/cancel`/, "training rows should call the formal training cancel API");
  assert.match(pageSource, /requestedBy:/, "training row cancel requests should identify the request source");
  assert.match(pageSource, /cancelRuns/, "runs page should define a shared cancel handler");
  assert.match(pageSource, /cancelledRunIds/, "runs page should track locally cancelled run ids");
  assert.match(pageSource, /status === "queued" \|\| status === "running"/, "cancel actions should stay scoped to queued or running rows");
  assert.match(pageSource, /pushToast/, "runs page should surface cancel API success or failure through the shared feedback system");
});

test("queued or running generation selections use batch cancel instead of delete", () => {
  assert.match(
    pageSource,
    /canCancelSelectedRuns\s*=\s*status === "queued" \|\| status === "running"/,
    "batch cancel availability should depend on task status, not only on the training task kind",
  );
  assert.match(
    pageSource,
    /canCancelSelectedRuns \? \([\s\S]*?onClick=\{\(\) => cancelRuns\(selectedIds\)\}/,
    "queued or running selected generation tasks should use the same batch cancel handler as training tasks",
  );
  assert.doesNotMatch(
    pageSource,
    /kind === "training" && \(status === "queued" \|\| status === "running"\)/,
    "generation task batches must not fall through to delete actions while they are queued or running",
  );
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

test("failed training run row actions name the affected task", () => {
  assert.match(
    pageSource,
    /ariaLabel=\{`复制任务报错：\$\{run\.title\}`\}/,
    "failed-row copy actions should expose which task error is copied",
  );
  assert.match(
    pageSource,
    /ariaLabel=\{`重试任务：\$\{run\.title\}`\}/,
    "failed-row retry actions should expose which task is retried",
  );
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

test("training run row actions stay compact in the mobile shell", () => {
  assert.match(
    cssSource,
    /\.rowActions :where\(\[data-demo-ui-button="true"\]\)\s*\{[\s\S]*?width:\s*34px;[\s\S]*?height:\s*34px;/,
    "run row actions should keep a compact icon-button footprint by default",
  );
  assert.match(
    cssSource,
    /\.rowActions\s*\{[\s\S]*?justify-self:\s*end;[\s\S]*?width:\s*max-content;/,
    "run row action columns should shrink to their icon buttons instead of reserving a wide auto column",
  );
  assert.doesNotMatch(
    cssSource,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?\.rowActions :where\(\[data-demo-ui-button="true"\]\)\s*\{[\s\S]*?width:\s*100%/,
    "mobile run row actions should not stretch into full-width delete bars",
  );
});

test("training run rows stay visually separated instead of sharing one grouped card shell", () => {
  assert.match(cssSource, /\.runRows\s*\{[\s\S]*?gap:\s*(?:8|9|10|11|12)px;/, "run row grids should keep real spacing between task cards");
  assert.match(cssSource, /\.runRow\s*\{[\s\S]*?border:\s*1px solid var\(--demo-border\);/, "each run row should draw its own border");
  assert.match(cssSource, /\.runRow\s*\{[\s\S]*?border-radius:\s*(?:10|11|12)px;/, "each run row should own its own rounded corners");
  assert.doesNotMatch(cssSource, /\.runRows\s+\.runRow\s*\{[\s\S]*?border-right:/, "run rows should not share a table-like border grid");
  assert.doesNotMatch(cssSource, /\.runRows\s+\.runRow:nth-child/, "run rows should not depend on nth-child border merging");
});

test("training run delete actions persist through the formal HTTP API on production routes", () => {
  assert.match(pageSource, /hiddenRunIds/, "runs page should track locally removed runs");
  assert.match(pageSource, /isDeletingRuns/, "runs page should track the deletion request state");
  assert.match(pageSource, /handleDeleteRuns/, "runs page should define a shared delete handler");
  assert.match(pageSource, /fetch\(\s*run\.kind === "generation"\s*\?\s*`\/api\/training\/generation-tasks\/\$\{run\.id\}`\s*:\s*`\/api\/training\/training-runs\/\$\{run\.id\}`/, "delete actions should call the formal task detail routes");
  assert.match(pageSource, /method:\s*"DELETE"/, "run deletion should use DELETE requests");
  assert.match(pageSource, /Promise\.all/, "runs page should await every delete request before hiding rows locally");
  assert.match(pageSource, /onClick=\{\(\) => handleDeleteRuns\(selectedIds\)\}/, "batch delete should call the shared delete handler");
  assert.match(pageSource, /onClick=\{\(\) => handleDeleteRuns\(\[run\.id\]\)\}/, "row delete should call the shared delete handler");
  assert.match(pageSource, /任务已从列表移除/, "delete feedback should describe the local state change");
  assert.doesNotMatch(pageSource, /删除动作已预览/, "delete actions should not remain preview-only placeholders");
});
