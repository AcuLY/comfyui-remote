import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSyncPresetVariantFlowPayload,
  extractSyncPresetVariantFlowError,
  parseSampleSectionNumbersInput,
  summarizeSyncPresetVariantFlowPlan,
} from "../src/lib/sync-preset-variant-flow-ui";

test("buildSyncPresetVariantFlowPayload trims titles, omits preset override fields, and keeps dryRun boolean", () => {
  const payload = buildSyncPresetVariantFlowPayload({
    sourceProjectTitle: " 西施 ",
    targetProjectTitle: " 尼可莱恩 ",
    expectedSourceProjectId: " source-project-id ",
    expectedTargetProjectId: " target-project-id ",
    sampleSectionNumbersText: "1, 33，65 65",
    dryRun: true,
  });

  assert.deepEqual(payload, {
    sourceProjectTitle: "西施",
    targetProjectTitle: "尼可莱恩",
    expectedSourceProjectId: "source-project-id",
    expectedTargetProjectId: "target-project-id",
    matchSectionsBy: "name",
    matchVariantsBy: "name",
    dryRun: true,
    sampleSectionNumbers: [1, 33, 65],
  });

  assert.equal(typeof payload.dryRun, "boolean");
});

test("parseSampleSectionNumbersInput rejects invalid section numbers", () => {
  assert.deepEqual(parseSampleSectionNumbersInput(""), null);
  assert.deepEqual(parseSampleSectionNumbersInput("1 2,3，2"), [1, 2, 3]);
  assert.throws(() => parseSampleSectionNumbersInput("1, 0"), /positive integers/);
  assert.throws(() => parseSampleSectionNumbersInput("1, abc"), /positive integers/);
});

test("summarizeSyncPresetVariantFlowPlan counts switch and skip actions", () => {
  const summary = summarizeSyncPresetVariantFlowPlan([
    { action: "switch", sectionName: "1", targetVariantName: "默认" },
    { action: "switch", sectionName: "2", targetVariantName: "半脱" },
    { action: "skip", sectionName: "3", reason: "Target variant already selected" },
    { action: "skip", sectionName: "4", reason: "No matching source section" },
    { action: "other" },
  ]);

  assert.deepEqual(summary, {
    switchCount: 2,
    skipCount: 2,
    otherCount: 1,
    skipReasons: {
      "Target variant already selected": 1,
      "No matching source section": 1,
    },
  });
});

test("extractSyncPresetVariantFlowError reads API error payloads", () => {
  assert.equal(
    extractSyncPresetVariantFlowError({ ok: false, error: { message: "PROJECT_TITLE_NOT_FOUND" } }, "fallback"),
    "PROJECT_TITLE_NOT_FOUND",
  );
  assert.equal(extractSyncPresetVariantFlowError(null, "fallback"), "fallback");
});
