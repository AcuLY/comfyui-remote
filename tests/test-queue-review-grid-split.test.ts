import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const reviewGridPath = "src/app/queue/[runId]/review-grid.tsx";
const imageCardPath = "src/app/queue/[runId]/queue-review-image-card.tsx";
const selectionToolbarPath = "src/app/queue/[runId]/queue-review-selection-toolbar.tsx";
const selectionHookPath = "src/app/queue/[runId]/use-queue-review-selection.ts";
const batchActionsPath = "src/app/queue/[runId]/queue-review-batch-actions.tsx";
const keyboardShortcutsHookPath = "src/app/queue/[runId]/use-queue-review-keyboard-shortcuts.ts";

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

test("queue review grid delegates selection state helpers to a focused hook", () => {
  assert.ok(existsSync(selectionHookPath), `${selectionHookPath} should own queue review selection state helpers`);

  const reviewGridSource = readFileSync(reviewGridPath, "utf8");
  const selectionHookSource = readFileSync(selectionHookPath, "utf8");

  assert.match(selectionHookSource, /export function useQueueReviewSelection/);
  assert.match(selectionHookSource, /useState<Set<string>>/);
  assert.match(selectionHookSource, /selectedCount/);
  assert.match(selectionHookSource, /selectedIds/);
  assert.match(selectionHookSource, /toggleSelect/);
  assert.match(selectionHookSource, /selectAll/);
  assert.match(selectionHookSource, /selectPending/);
  assert.match(selectionHookSource, /removeSelectedIds/);
  assert.match(selectionHookSource, /addSelectedIds/);
  assert.match(selectionHookSource, /remainingPendingIds/);

  assert.match(reviewGridSource, /from "\.\/use-queue-review-selection";/);
  assert.match(reviewGridSource, /useQueueReviewSelection\(/);
  assert.doesNotMatch(reviewGridSource, /const \[selected, setSelected\]/);
  assert.doesNotMatch(reviewGridSource, /function toggleSelect/);
  assert.doesNotMatch(reviewGridSource, /function selectAll/);
  assert.doesNotMatch(reviewGridSource, /function removeSelectedIds/);
});

test("queue review grid delegates batch action strip and rest navigation to a focused component", () => {
  assert.ok(existsSync(batchActionsPath), `${batchActionsPath} should own queue review batch actions`);

  const reviewGridSource = readFileSync(reviewGridPath, "utf8");
  const batchActionsSource = readFileSync(batchActionsPath, "utf8");

  assert.match(batchActionsSource, /export function QueueReviewBatchActions/);
  assert.match(batchActionsSource, /function handleKeep/);
  assert.match(batchActionsSource, /function handleTrash/);
  assert.match(batchActionsSource, /function handleRestAndNext/);
  assert.match(batchActionsSource, /pendingAfterAction/);
  assert.match(batchActionsSource, /批量保留/);
  assert.match(batchActionsSource, /批量删除/);
  assert.match(batchActionsSource, /保留剩余/);
  assert.match(batchActionsSource, /删除剩余/);
  assert.match(batchActionsSource, /Trash2/);
  assert.match(batchActionsSource, /ChevronRight/);

  assert.match(reviewGridSource, /from "\.\/queue-review-batch-actions";/);
  assert.match(reviewGridSource, /<QueueReviewBatchActions/);
  assert.doesNotMatch(reviewGridSource, /function handleKeep/);
  assert.doesNotMatch(reviewGridSource, /function handleTrash/);
  assert.doesNotMatch(reviewGridSource, /function handleRestAndNext/);
  assert.doesNotMatch(reviewGridSource, /批量保留/);
  assert.doesNotMatch(reviewGridSource, /保留剩余/);
});

test("queue review grid delegates page-level keyboard shortcuts to a focused hook", () => {
  assert.ok(existsSync(keyboardShortcutsHookPath), `${keyboardShortcutsHookPath} should own queue review keyboard shortcuts`);

  const reviewGridSource = readFileSync(reviewGridPath, "utf8");
  const keyboardShortcutsSource = readFileSync(keyboardShortcutsHookPath, "utf8");

  assert.match(keyboardShortcutsSource, /export function useQueueReviewKeyboardShortcuts/);
  assert.match(keyboardShortcutsSource, /window\.addEventListener\("keydown"/);
  assert.match(keyboardShortcutsSource, /data-nav-editor/);
  assert.match(keyboardShortcutsSource, /data-batch-size/);
  assert.match(keyboardShortcutsSource, /data-queue-run-section/);
  assert.match(keyboardShortcutsSource, /toast\.dismiss\("batch-size"\)/);
  assert.match(keyboardShortcutsSource, /onUndoTrash/);
  assert.match(keyboardShortcutsSource, /onTrashCurrentRun/);
  assert.match(keyboardShortcutsSource, /openLightbox/);

  assert.match(reviewGridSource, /from "\.\/use-queue-review-keyboard-shortcuts";/);
  assert.match(reviewGridSource, /useQueueReviewKeyboardShortcuts\(/);
  assert.doesNotMatch(reviewGridSource, /Page-level shortcuts/);
  assert.doesNotMatch(reviewGridSource, /window\.addEventListener\("keydown"/);
  assert.doesNotMatch(reviewGridSource, /data-batch-size/);
});
