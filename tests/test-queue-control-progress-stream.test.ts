import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

test("bulk queue control API routes expose opt-in progress streams", () => {
  for (const routePath of [
    "src/app/api/queue/clear-active/route.ts",
    "src/app/api/queue/pause-active/route.ts",
    "src/app/api/queue/resume-paused/route.ts",
  ]) {
    const source = readSource(routePath);
    assert.match(source, /wantsQueueControlStream/, `${routePath} should detect streaming requests`);
    assert.match(source, /createQueueControlProgressStream/, `${routePath} should return a streaming response`);
    assert.match(source, /onProgress/, `${routePath} should pass progress into the queue action`);
  }
});

test("queue page bulk controls consume streaming progress events", () => {
  const source = readSource("src/app/queue/queue-page-client.tsx");

  assert.match(
    source,
    /readQueueControlProgressStream/,
    "queue page should read progress chunks instead of waiting for final JSON",
  );
  assert.match(
    source,
    /\/api\/queue\/clear-active\?stream=1/,
    "clear active should use the streaming route",
  );
  assert.match(
    source,
    /\/api\/queue\/pause-active\?stream=1/,
    "pause all should use the streaming route",
  );
  assert.match(
    source,
    /\/api\/queue\/resume-paused\?stream=1/,
    "resume all should use the streaming route",
  );
  assert.match(
    source,
    /processedRuns[\s\S]*totalRuns[\s\S]*batchSize[\s\S]*elapsedMs/,
    "progress UI should include counts, batch size, and elapsed timing",
  );
});
