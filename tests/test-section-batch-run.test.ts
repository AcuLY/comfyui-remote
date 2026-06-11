import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBatchRunBatchSize } from "../src/lib/section-batch-run";

test("normalizeBatchRunBatchSize treats blank input as inheriting each section batch size", () => {
  assert.deepEqual(normalizeBatchRunBatchSize(""), {
    isValid: true,
    overrideBatchSize: undefined,
  });
});

test("normalizeBatchRunBatchSize accepts positive integer overrides", () => {
  assert.deepEqual(normalizeBatchRunBatchSize(" 8 "), {
    isValid: true,
    overrideBatchSize: 8,
  });
});

test("normalizeBatchRunBatchSize rejects invalid overrides", () => {
  assert.deepEqual(normalizeBatchRunBatchSize("0"), {
    isValid: false,
    overrideBatchSize: undefined,
  });
  assert.deepEqual(normalizeBatchRunBatchSize("2.5"), {
    isValid: false,
    overrideBatchSize: undefined,
  });
  assert.deepEqual(normalizeBatchRunBatchSize("abc"), {
    isValid: false,
    overrideBatchSize: undefined,
  });
});
