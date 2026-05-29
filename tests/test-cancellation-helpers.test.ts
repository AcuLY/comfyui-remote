import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  CENSORING_CANCELLABLE_STATUSES,
  RUN_CANCELLABLE_STATUSES,
  extractCensoringPromptId,
  selectCensoringPromptIds,
} from "../src/lib/actions/cancellation-helpers";

test("run bulk cancellation treats paused runs as cancellable active work", () => {
  assert.deepEqual(RUN_CANCELLABLE_STATUSES, ["queued", "running", "paused"]);
});

test("censoring cancellation includes running prompts and paused queued work", () => {
  assert.deepEqual(CENSORING_CANCELLABLE_STATUSES, ["queued", "running", "paused"]);
});

test("extractCensoringPromptId reads the prompt id persisted on running censoring tasks", () => {
  assert.equal(
    extractCensoringPromptId("promptId:3dfd087c-ef60-464f-908e-f84a20833da9"),
    "3dfd087c-ef60-464f-908e-f84a20833da9",
  );
  assert.equal(extractCensoringPromptId("用户取消"), null);
  assert.equal(extractCensoringPromptId(null), null);
});

test("selectCensoringPromptIds de-duplicates active prompt ids before queue deletion", () => {
  assert.deepEqual(
    selectCensoringPromptIds([
      { errorMessage: "promptId:a" },
      { errorMessage: "promptId:b" },
      { errorMessage: "promptId:a" },
      { errorMessage: null },
    ]),
    ["a", "b"],
  );
});
