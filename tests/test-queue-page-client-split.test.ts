import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const queueClientPath = "src/app/queue/queue-page-client.tsx";
const pendingTabPath = "src/app/queue/queue-pending-tab.tsx";

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
