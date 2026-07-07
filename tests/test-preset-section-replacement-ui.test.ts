import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractApiErrorMessage } from "../src/lib/api-error-message";
import {
  buildPresetSectionReplacementPayload,
  extractPresetSectionReplacementError,
  summarizePresetSectionReplacementPlan,
} from "../src/lib/preset-section-replacement-ui";

const repoRoot = process.cwd();

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

test("extractApiErrorMessage reads the shared UI API error payload shape", () => {
  assert.equal(
    extractApiErrorMessage({ ok: false, error: { message: "SHARED_ERROR" } }, "fallback"),
    "SHARED_ERROR",
  );
  assert.equal(extractApiErrorMessage({ ok: false, error: { message: "   " } }, "fallback"), "fallback");
  assert.equal(extractApiErrorMessage({ ok: true, data: {} }, "fallback"), "fallback");
});

test("preset replacement and sync flow error helpers delegate to the shared API error extractor", () => {
  const presetReplacementSource = readFileSync(resolve(repoRoot, "src/lib/preset-section-replacement-ui.ts"), "utf8");
  const syncPresetVariantSource = readFileSync(resolve(repoRoot, "src/lib/sync-preset-variant-flow-ui.ts"), "utf8");

  assert.match(presetReplacementSource, /from "\.\/api-error-message"/);
  assert.match(syncPresetVariantSource, /from "\.\/api-error-message"/);
  assert.doesNotMatch(presetReplacementSource, /const error = \(payload as Record<string, unknown>\)\.error/);
  assert.doesNotMatch(syncPresetVariantSource, /const error = record\.error/);
});
