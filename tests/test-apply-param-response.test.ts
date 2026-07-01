import test from "node:test";
import assert from "node:assert/strict";
import { readApplyParamResponse } from "../src/app/projects/[projectId]/edit/apply-param-response";

test("apply param response reads count from shared API envelope", () => {
  assert.deepEqual(
    readApplyParamResponse({ ok: true, data: { ok: true, count: 3 } }),
    { ok: true, count: 3 },
  );
});

test("apply param response keeps flat success payload compatibility", () => {
  assert.deepEqual(
    readApplyParamResponse({ ok: true, count: 2 }),
    { ok: true, count: 2 },
  );
});

test("apply param response reads shared API error message", () => {
  assert.deepEqual(
    readApplyParamResponse({ ok: false, error: { message: "Apply failed" } }),
    { ok: false, error: "Apply failed" },
  );
});
