import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVariantBulkTextPlan,
  countTextOccurrences,
  type VariantBulkTextVariant,
} from "../src/app/assets/presets/preset-variant-bulk-text";

const variants: VariantBulkTextVariant[] = [
  {
    key: "front",
    name: "Front",
    prompt: "black hair, blue eyes, white shirt",
    negativePrompt: "lowres, bad hands",
  },
  {
    key: "side",
    name: "Side",
    prompt: "black hair, blue eyes, side view",
    negativePrompt: null,
  },
  {
    key: "extra",
    name: "Extra",
    prompt: "silver hair, green eyes",
    negativePrompt: "lowres",
  },
];

test("buildVariantBulkTextPlan replaces matching text for selected variants", () => {
  const plan = buildVariantBulkTextPlan({
    variants,
    selectedVariantKeys: ["front", "side"],
    field: "prompt",
    findText: "black hair, blue eyes",
    replaceText: "black hair, long hair, blue eyes",
  });

  assert.equal(plan.summary.canApply, true);
  assert.equal(plan.summary.planned, 2);
  assert.equal(plan.summary.unselected, 1);
  assert.equal(plan.items.find((item) => item.key === "front")?.after, "black hair, long hair, blue eyes, white shirt");
  assert.equal(plan.items.find((item) => item.key === "side")?.after, "black hair, long hair, blue eyes, side view");
  assert.equal(plan.items.find((item) => item.key === "extra")?.status, "unselected");
});

test("buildVariantBulkTextPlan marks selected variants without matches as no-match", () => {
  const plan = buildVariantBulkTextPlan({
    variants,
    selectedVariantKeys: ["front", "extra"],
    field: "prompt",
    findText: "blue eyes",
    replaceText: "blue eyes, bright eyes",
  });

  assert.equal(plan.summary.planned, 1);
  assert.equal(plan.summary.noMatch, 1);
  assert.equal(plan.items.find((item) => item.key === "extra")?.status, "no-match");
});

test("buildVariantBulkTextPlan blocks empty find text", () => {
  const plan = buildVariantBulkTextPlan({
    variants,
    selectedVariantKeys: ["front"],
    field: "prompt",
    findText: "",
    replaceText: "long hair",
  });

  assert.equal(plan.summary.canApply, false);
  assert.deepEqual(plan.blockers, ["查找文本不能为空"]);
  assert.equal(plan.summary.planned, 0);
});

test("buildVariantBulkTextPlan replaces all occurrences and counts matches", () => {
  const plan = buildVariantBulkTextPlan({
    variants: [{
      key: "repeat",
      name: "Repeat",
      prompt: "blue eyes, black hair, blue eyes",
      negativePrompt: "",
    }],
    selectedVariantKeys: ["repeat"],
    field: "prompt",
    findText: "blue eyes",
    replaceText: "bright blue eyes",
  });

  const item = plan.items[0];
  assert.equal(item.matchCount, 2);
  assert.equal(plan.summary.totalMatches, 2);
  assert.equal(item.after, "bright blue eyes, black hair, bright blue eyes");
});

test("buildVariantBulkTextPlan handles negative prompts and null as empty text", () => {
  const plan = buildVariantBulkTextPlan({
    variants,
    selectedVariantKeys: ["front", "side"],
    field: "negativePrompt",
    findText: "lowres",
    replaceText: "low quality",
  });

  assert.equal(plan.items.find((item) => item.key === "front")?.after, "low quality, bad hands");
  assert.equal(plan.items.find((item) => item.key === "side")?.before, "");
  assert.equal(plan.items.find((item) => item.key === "side")?.status, "no-match");
});

test("buildVariantBulkTextPlan marks same-text replacements as unchanged", () => {
  const plan = buildVariantBulkTextPlan({
    variants,
    selectedVariantKeys: ["front"],
    field: "prompt",
    findText: "black hair",
    replaceText: "black hair",
  });

  assert.equal(plan.summary.canApply, false);
  assert.equal(plan.summary.unchanged, 1);
  assert.equal(plan.items[0].status, "unchanged");
});

test("countTextOccurrences uses non-overlapping exact text matches", () => {
  assert.equal(countTextOccurrences("aaaa", "aa"), 2);
  assert.equal(countTextOccurrences("Black hair, black hair", "black hair"), 1);
  assert.equal(countTextOccurrences("anything", ""), 0);
});
