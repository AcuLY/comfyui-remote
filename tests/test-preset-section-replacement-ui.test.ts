import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPresetSectionReplacementPayload,
  extractPresetSectionReplacementError,
  summarizePresetSectionReplacementPlan,
} from "../src/lib/preset-section-replacement-ui";

test("buildPresetSectionReplacementPayload trims ids and preserves dryRun", () => {
  assert.deepEqual(buildPresetSectionReplacementPayload({
    dryRun: true,
    rules: [{ fromPresetId: " a ", toPresetId: " b ", toVariantId: " " }],
  }), {
    dryRun: true,
    rules: [{ fromPresetId: "a", toPresetId: "b" }],
  });
});

test("summarizePresetSectionReplacementPlan counts updates, noops, and blockers", () => {
  const summary = summarizePresetSectionReplacementPlan({
    totalPlannedUpdateCount: 2,
    hasBlockers: true,
    rules: [
      { status: "planned", updates: [{}, {}], blockers: [] },
      { status: "noop", updates: [], blockers: [] },
      { status: "blocked", updates: [], blockers: [{ message: "bad" }] },
    ],
    globalBlockers: [],
  });

  assert.deepEqual(summary, {
    planned: 2,
    noopRules: 1,
    blockedRules: 1,
    blockers: 1,
  });
});

test("extractPresetSectionReplacementError reads API error payloads", () => {
  assert.equal(
    extractPresetSectionReplacementError({ ok: false, error: { message: "CATEGORY_MISMATCH" } }, "fallback"),
    "CATEGORY_MISMATCH",
  );
  assert.equal(extractPresetSectionReplacementError(null, "fallback"), "fallback");
});
