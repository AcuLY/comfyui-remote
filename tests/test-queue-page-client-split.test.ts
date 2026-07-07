import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const queueClientPath = "src/app/queue/queue-page-client.tsx";
const pendingTabPath = "src/app/queue/queue-pending-tab.tsx";
const runningTabPath = "src/app/queue/queue-running-tab.tsx";
const censoringProgressCardPath = "src/app/queue/queue-censoring-progress-card.tsx";
const trashTabPath = "src/app/queue/queue-trash-tab.tsx";

test("queue page delegates pending review groups and pagination to a focused tab component", () => {
  assert.ok(existsSync(pendingTabPath), `${pendingTabPath} should own pending review-group rendering`);

  const clientSource = readFileSync(queueClientPath, "utf8");
  const pendingTabSource = readFileSync(pendingTabPath, "utf8");

  assert.match(pendingTabSource, /export function QueuePendingTab/);
  assert.match(pendingTabSource, /<HardNavigationLink/);
  assert.match(pendingTabSource, /href=\{`\/queue\/\$\{run\.id\}`\}/);
  assert.match(pendingTabSource, /visiblePages\.map/);
  assert.match(pendingTabSource, /queuePagination\.totalPages > 1/);

  assert.match(clientSource, /from "\.\/queue-pending-tab";/);
  assert.match(clientSource, /<QueuePendingTab/);
  assert.doesNotMatch(clientSource, /<HardNavigationLink/);
  assert.doesNotMatch(clientSource, /visiblePages\.map/);
});

test("queue page delegates active run progress and controls to a focused running tab", () => {
  assert.ok(existsSync(runningTabPath), `${runningTabPath} should own active run progress rendering`);
  assert.ok(existsSync(censoringProgressCardPath), `${censoringProgressCardPath} should own reusable censoring progress cards`);

  const clientSource = readFileSync(queueClientPath, "utf8");
  const runningTabSource = readFileSync(runningTabPath, "utf8");
  const censoringProgressCardSource = readFileSync(censoringProgressCardPath, "utf8");

  assert.match(runningTabSource, /export function QueueRunningTab/);
  assert.match(runningTabSource, /function RunProgressView/);
  assert.match(runningTabSource, /runningRuns\.map/);
  assert.match(runningTabSource, /全部暂停/);
  assert.match(runningTabSource, /全部恢复/);
  assert.match(runningTabSource, /清空运行中队列/);
  assert.match(runningTabSource, /onPauseRun/);
  assert.match(runningTabSource, /onResumeRun/);
  assert.match(runningTabSource, /onCancelRun/);
  assert.match(censoringProgressCardSource, /export function CensoringProgressCard/);

  assert.match(clientSource, /from "\.\/queue-running-tab";/);
  assert.match(clientSource, /<QueueRunningTab/);
  assert.doesNotMatch(clientSource, /function RunProgressView/);
  assert.doesNotMatch(clientSource, /runningRuns\.map/);
});

test("queue page delegates trash list and pagination rendering to a focused tab component", () => {
  assert.ok(existsSync(trashTabPath), `${trashTabPath} should own trash list and pagination rendering`);

  const clientSource = readFileSync(queueClientPath, "utf8");
  const trashTabSource = readFileSync(trashTabPath, "utf8");

  assert.match(trashTabSource, /export function QueueTrashTab/);
  assert.match(trashTabSource, /trashItems\.map/);
  assert.match(trashTabSource, /trashVisiblePages\.map/);
  assert.match(trashTabSource, /onRestore/);
  assert.match(trashTabSource, /onTrashPageChange/);
  assert.match(trashTabSource, /onClearTrash/);

  assert.match(clientSource, /from "\.\/queue-trash-tab";/);
  assert.match(clientSource, /<QueueTrashTab/);
  assert.doesNotMatch(clientSource, /trashItems\.map/);
  assert.doesNotMatch(clientSource, /trashVisiblePages\.map/);
});
