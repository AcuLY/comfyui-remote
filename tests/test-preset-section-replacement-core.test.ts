import test from "node:test";
import assert from "node:assert/strict";
import { planPresetSectionReplacements } from "../src/server/services/preset-section-replacement-core";

const presets = [
  {
    id: "a",
    name: "A",
    categoryId: "cat-1",
    isActive: true,
    variants: [{ id: "a-v1", name: "A1", isActive: true, sortOrder: 0 }],
  },
  {
    id: "b",
    name: "B",
    categoryId: "cat-1",
    isActive: true,
    variants: [
      { id: "b-v1", name: "B1", isActive: true, sortOrder: 0 },
      { id: "b-v2", name: "B2", isActive: true, sortOrder: 1 },
    ],
  },
  {
    id: "c",
    name: "C",
    categoryId: "cat-2",
    isActive: true,
    variants: [{ id: "c-v1", name: "C1", isActive: true, sortOrder: 0 }],
  },
  {
    id: "no-variant",
    name: "No Variant",
    categoryId: "cat-1",
    isActive: true,
    variants: [],
  },
];

const bindings = [
  {
    id: "bind-row-1",
    ownerId: "s1",
    ownerName: "小节 1",
    ownerSortOrder: 0,
    bindingKey: "bind-1",
    categoryId: "cat-1",
    presetId: "a",
    variantId: "a-v1",
    presetGroupId: null,
    groupBindingKey: null,
    sortOrder: 0,
  },
  {
    id: "bind-row-2",
    ownerId: "s2",
    ownerName: "小节 2",
    ownerSortOrder: 1,
    bindingKey: "bind-2",
    categoryId: "cat-1",
    presetId: "b",
    variantId: "b-v1",
    presetGroupId: null,
    groupBindingKey: null,
    sortOrder: 1,
  },
  {
    id: "group-row",
    ownerId: "s3",
    ownerName: "小节 3",
    ownerSortOrder: 2,
    bindingKey: "group-bind",
    categoryId: "cat-1",
    presetId: null,
    variantId: null,
    presetGroupId: "group-1",
    groupBindingKey: "group-key",
    sortOrder: 2,
  },
];

test("plans ordinary same-category preset replacement with default target variant", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [{ fromPresetId: "a", toPresetId: "b" }],
  });

  assert.equal(result.hasBlockers, false);
  assert.equal(result.totalPlannedUpdateCount, 1);
  assert.deepEqual(result.rules[0].updates.map((item) => ({
    bindingRowId: item.bindingRowId,
    toVariantId: item.toVariantId,
  })), [
    { bindingRowId: "bind-row-1", toVariantId: "b-v1" },
  ]);
});

test("honors explicit target variant", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [{ fromPresetId: "a", toPresetId: "b", toVariantId: "b-v2" }],
  });

  assert.equal(result.rules[0].updates[0].toVariantId, "b-v2");
});

test("reports no-op source matches without blocking", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [{ fromPresetId: "c", toPresetId: "c" }],
  });

  assert.equal(result.hasBlockers, false);
  assert.equal(result.totalPlannedUpdateCount, 0);
  assert.equal(result.rules[0].status, "noop");
});

test("blocks cross-category replacements", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [{ fromPresetId: "a", toPresetId: "c" }],
  });

  assert.equal(result.hasBlockers, true);
  assert.match(result.rules[0].blockers[0].message, /同分类/);
});

test("blocks target preset without active variants", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [{ fromPresetId: "a", toPresetId: "no-variant" }],
  });

  assert.equal(result.hasBlockers, true);
  assert.match(result.rules[0].blockers[0].message, /可用变体/);
});

test("blocks duplicate source rules", () => {
  const result = planPresetSectionReplacements({
    presets,
    bindings,
    rules: [
      { fromPresetId: "a", toPresetId: "b" },
      { fromPresetId: "a", toPresetId: "b", toVariantId: "b-v2" },
    ],
  });

  assert.equal(result.hasBlockers, true);
  assert.match(result.globalBlockers[0].message, /重复/);
});
