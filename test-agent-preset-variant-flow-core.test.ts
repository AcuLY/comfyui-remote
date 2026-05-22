import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSyncPresetVariantFlowVerification,
  parseSyncPresetVariantFlowInput,
  pickLatestProjectByExactTitle,
} from "./src/server/services/agent-preset-variant-flow-core";

test("parseSyncPresetVariantFlowInput defaults to dry-run and can infer preset names", () => {
  const input = parseSyncPresetVariantFlowInput({
    sourceProjectTitle: " 西施 ",
    targetProjectTitle: " 尼可莱恩 ",
  });

  assert.equal(input.sourceProjectTitle, "西施");
  assert.equal(input.targetProjectTitle, "尼可莱恩");
  assert.equal(input.expectedSourceProjectId, null);
  assert.equal(input.expectedTargetProjectId, null);
  assert.equal(input.sourcePresetName, null);
  assert.equal(input.targetPresetName, null);
  assert.equal(input.dryRun, true);
  assert.deepEqual(input.matchSectionsBy, "name");
  assert.deepEqual(input.matchVariantsBy, "name");
});

test("parseSyncPresetVariantFlowInput only applies when dryRun is explicitly false", () => {
  const applyInput = parseSyncPresetVariantFlowInput({
    sourceProjectTitle: "西施",
    targetProjectTitle: "尼可莱恩",
    sourcePresetName: "西施",
    targetPresetName: "尼可·莱恩",
    expectedSourceProjectId: "source-project-id",
    expectedTargetProjectId: "target-project-id",
    dryRun: false,
    sampleSectionNumbers: [1, 33, 65, 33],
  });

  assert.equal(applyInput.dryRun, false);
  assert.equal(applyInput.expectedSourceProjectId, "source-project-id");
  assert.equal(applyInput.expectedTargetProjectId, "target-project-id");
  assert.deepEqual(applyInput.sampleSectionNumbers, [1, 33, 65]);
  assert.throws(
    () => parseSyncPresetVariantFlowInput({ sourceProjectTitle: "西施", targetProjectTitle: "尼可莱恩", dryRun: "false" }),
    /dryRun must be a boolean/,
  );
  assert.throws(
    () => parseSyncPresetVariantFlowInput({ sourceProjectTitle: "西施", targetProjectTitle: "尼可莱恩", dryRun: false }),
    /dryRun:false requires expectedSourceProjectId and expectedTargetProjectId/,
  );
});

test("pickLatestProjectByExactTitle requires exact title and chooses newest updatedAt", () => {
  const picked = pickLatestProjectByExactTitle(
    [
      { id: "old", title: "尼可莱恩", updatedAt: new Date("2026-05-17T00:00:00Z") },
      { id: "contains", title: "尼可莱恩2", updatedAt: new Date("2026-05-19T00:00:00Z") },
      { id: "new", title: "尼可莱恩", updatedAt: new Date("2026-05-18T00:00:00Z") },
    ],
    "尼可莱恩",
  );

  assert.equal(picked.id, "new");
});

test("buildSyncPresetVariantFlowVerification reports planned update pass, distribution, lora config, and samples", () => {
  const verification = buildSyncPresetVariantFlowVerification({
    targetPresetName: "尼可·莱恩",
    verificationDryRun: {
      plannedUpdateCount: 0,
      plan: [
        { sectionId: "s1", sectionName: "1", action: "skip", reason: "Target variant already selected" },
        { sectionId: "s2", sectionName: "2", action: "skip", reason: "Target variant already selected" },
        { sectionId: "s3", sectionName: "3", action: "skip", reason: "Target variant already selected" },
      ],
    },
    sections: [
      {
        id: "s1",
        name: "1",
        sortOrder: 1,
        loraConfig: { lora1: [{ id: "l1", path: "a.safetensors", weight: 1, enabled: true, source: "preset", bindingId: "b1", sourceName: "尼可·莱恩" }], lora2: [] },
        promptBlocks: [{ id: "pb1", bindingId: "b1", sourceId: "p1", variantId: "v-default", label: "尼可·莱恩 / 默认", sortOrder: 1 }],
      },
      {
        id: "s2",
        name: "2",
        sortOrder: 2,
        loraConfig: { lora1: [], lora2: [{ id: "l2", path: "b.safetensors", weight: 1, enabled: true, source: "preset", bindingId: "b2", sourceName: "尼可·莱恩" }] },
        promptBlocks: [{ id: "pb2", bindingId: "b2", sourceId: "p1", variantId: "v-half", label: "尼可·莱恩 / 半脱", sortOrder: 1 }],
      },
      {
        id: "s3",
        name: "3",
        sortOrder: 3,
        loraConfig: { lora1: [], lora2: [] },
        promptBlocks: [{ id: "pb3", bindingId: "b3", sourceId: "p1", variantId: "v-half", label: "尼可·莱恩 / 半脱", sortOrder: 1 }],
      },
    ],
    targetPreset: {
      id: "p1",
      name: "尼可·莱恩",
      variants: [
        { id: "v-default", name: "默认" },
        { id: "v-half", name: "半脱" },
      ],
    },
    sampleSectionNumbers: [1, 2, 3],
  });

  assert.equal(verification.passed, false);
  assert.equal(verification.plannedUpdateCount, 0);
  assert.deepEqual(verification.variantDistribution, { "默认": 1, "半脱": 2 });
  assert.equal(verification.loraConfig.totalSections, 3);
  assert.equal(verification.loraConfig.okCount, 2);
  assert.deepEqual(verification.loraConfig.missing.map((item) => item.sectionId), ["s3"]);
  assert.deepEqual(verification.sampleBlocks.map((sample) => sample.label), ["尼可·莱恩 / 默认", "尼可·莱恩 / 半脱", "尼可·莱恩 / 半脱"]);
});
