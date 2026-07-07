import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const reviewGridPath = "src/app/queue/[runId]/review-grid.tsx";
const imageCardPath = "src/app/queue/[runId]/queue-review-image-card.tsx";
const selectionToolbarPath = "src/app/queue/[runId]/queue-review-selection-toolbar.tsx";

test("queue review grid delegates image card labels and markers to a focused component", () => {
  assert.ok(existsSync(imageCardPath), `${imageCardPath} should own queue review image card rendering`);

  const reviewGridSource = readFileSync(reviewGridPath, "utf8");
  const imageCardSource = readFileSync(imageCardPath, "utf8");

  assert.match(imageCardSource, /export function QueueReviewImageCard/);
  assert.match(imageCardSource, /image\.label/);
  assert.match(imageCardSource, /image\.status/);
  assert.match(imageCardSource, /image\.featured/);
  assert.match(imageCardSource, /image\.featured2/);
  assert.match(imageCardSource, /image\.cover/);
  assert.match(imageCardSource, /onToggleSelect\(image\.id\)/);
  assert.match(imageCardSource, /onOpen\(index\)/);

  assert.match(reviewGridSource, /from "\.\/queue-review-image-card";/);
  assert.match(reviewGridSource, /<QueueReviewImageCard/);
  assert.doesNotMatch(reviewGridSource, /image\.label/);
  assert.doesNotMatch(reviewGridSource, /image\.featured/);
  assert.doesNotMatch(reviewGridSource, /image\.status === "kept"/);
});

test("queue review grid delegates selection toolbar rendering to a focused component", () => {
  assert.ok(existsSync(selectionToolbarPath), `${selectionToolbarPath} should own queue review selection toolbar rendering`);

  const reviewGridSource = readFileSync(reviewGridPath, "utf8");
  const selectionToolbarSource = readFileSync(selectionToolbarPath, "utf8");

  assert.match(selectionToolbarSource, /export function QueueReviewSelectionToolbar/);
  assert.match(selectionToolbarSource, /selectedCount/);
  assert.match(selectionToolbarSource, /pendingCount/);
  assert.match(selectionToolbarSource, /allSelected/);
  assert.match(selectionToolbarSource, /onToggleSelectAll/);
  assert.match(selectionToolbarSource, /onSelectPending/);
  assert.match(selectionToolbarSource, /选中待审核/);

  assert.match(reviewGridSource, /from "\.\/queue-review-selection-toolbar";/);
  assert.match(reviewGridSource, /<QueueReviewSelectionToolbar/);
  assert.doesNotMatch(reviewGridSource, /取消全选/);
  assert.doesNotMatch(reviewGridSource, /选中待审核/);
  assert.doesNotMatch(reviewGridSource, /已选 \{selectedCount\} 张/);
});
