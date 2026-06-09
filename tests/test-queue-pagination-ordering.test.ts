import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("queue pagination orders visible runs with a unique tie breaker", () => {
  const source = readSource("src/server/repositories/queue-data-repository.ts");
  const match = source.match(/const VISIBLE_QUEUE_RUN_ORDER_BY = \[([\s\S]*?)\] satisfies/);

  assert.ok(match, "VISIBLE_QUEUE_RUN_ORDER_BY should be defined as the shared queue page sort");

  const orderBySource = match[1];
  assert.match(orderBySource, /\{\s*finishedAt:\s*"desc"\s*\}/);
  assert.match(orderBySource, /\{\s*createdAt:\s*"desc"\s*\}/);
  assert.match(
    orderBySource,
    /\{\s*id:\s*"desc"\s*\}/,
    "offset pagination must end with a unique order key so adjacent pages cannot overlap when timestamps tie",
  );
});
