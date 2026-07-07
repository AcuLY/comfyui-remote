import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const reviewGridPath = "src/app/queue/[runId]/review-grid.tsx";
const imageCardPath = "src/app/queue/[runId]/queue-review-image-card.tsx";

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
