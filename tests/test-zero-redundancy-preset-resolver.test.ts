import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  resolvePresetVariantContent,
  resolvePresetVariantContentFromRows,
} from "../src/server/prompt-config/preset-resolver";

const active = true;

function variant(input: {
  id: string;
  prompt?: string;
  negativePrompt?: string | null;
  linkedVariants?: unknown;
  lora1?: unknown;
  lora2?: unknown;
  categoryType?: string | null;
  presetNotes?: string | null;
}) {
  return {
    id: input.id,
    presetId: `preset-${input.id}`,
    preset: {
      category: { type: input.categoryType ?? "preset" },
      notes: input.presetNotes ?? null,
    },
    name: input.id,
    prompt: input.prompt ?? input.id,
    negativePrompt: input.negativePrompt ?? null,
    lora1: input.lora1 ?? [],
    lora2: input.lora2 ?? [],
    linkedVariants: input.linkedVariants ?? null,
    sortOrder: 0,
    isActive: active,
  };
}

test("relation rows take precedence over legacy linkedVariants JSON", () => {
  const resolved = resolvePresetVariantContentFromRows("root", {
    variants: [
      variant({
        id: "root",
        prompt: "root prompt",
        linkedVariants: [{ presetId: "legacy-preset", variantId: "legacy" }],
      }),
      variant({ id: "relation", prompt: "relation prompt" }),
      variant({ id: "legacy", prompt: "legacy prompt" }),
    ],
    variantLinks: [
      { sourceVariantId: "root", linkedVariantId: "relation", sortOrder: 0 },
    ],
  });

  assert.equal(resolved.prompt, "root prompt, relation prompt");
});

test("legacy linkedVariants JSON is ignored when a variant has no relation rows", () => {
  const resolved = resolvePresetVariantContentFromRows("root", {
    variants: [
      variant({
        id: "root",
        prompt: "root prompt",
        negativePrompt: "root negative",
        linkedVariants: [{ presetId: "legacy-preset", variantId: "legacy" }],
      }),
      variant({ id: "legacy", prompt: "legacy prompt", negativePrompt: "legacy negative" }),
    ],
    variantLinks: [],
  });

  assert.equal(resolved.prompt, "root prompt");
  assert.equal(resolved.negativePrompt, "root negative");
});

test("linked variant cycles are ignored with visited variant ids", () => {
  const resolved = resolvePresetVariantContentFromRows("root", {
    variants: [
      variant({ id: "root", prompt: "root prompt" }),
      variant({ id: "child", prompt: "child prompt" }),
    ],
    variantLinks: [
      { sourceVariantId: "root", linkedVariantId: "child", sortOrder: 0 },
      { sourceVariantId: "child", linkedVariantId: "root", sortOrder: 0 },
    ],
  });

  assert.equal(resolved.prompt, "root prompt, child prompt");
});

test("LoRA entries are de-duplicated by path while preserving the first entry", () => {
  const resolved = resolvePresetVariantContentFromRows("root", {
    variants: [
      variant({
        id: "root",
        lora1: [{ path: "/models/shared.safetensors", weight: 0.7, enabled: true }],
        lora2: [{ path: "/models/upscale.safetensors", weight: 0.4, enabled: true }],
      }),
      variant({
        id: "child",
        lora1: [
          { path: "/models/shared.safetensors", weight: 1.2, enabled: false },
          { path: "/models/child.safetensors", weight: 0.8, enabled: true },
        ],
        lora2: [{ path: "/models/upscale.safetensors", weight: 1.1, enabled: false }],
      }),
    ],
    variantLinks: [
      { sourceVariantId: "root", linkedVariantId: "child", sortOrder: 0 },
    ],
  });

  assert.deepEqual(resolved.lora1, [
    { path: "/models/shared.safetensors", weight: 0.7, enabled: true },
    { path: "/models/child.safetensors", weight: 0.8, enabled: true },
  ]);
  assert.deepEqual(resolved.lora2, [
    { path: "/models/upscale.safetensors", weight: 0.4, enabled: true },
  ]);
});

test("DB wrapper loads only reachable variants and per-source relation rows", async () => {
  const variants = new Map([
    ["root", variant({ id: "root", prompt: "root prompt" })],
    ["child", variant({ id: "child", prompt: "child prompt" })],
  ]);
  const variantFindManyCalls: unknown[] = [];
  const variantFindUniqueIds: string[] = [];
  const linkFindManySources: string[] = [];
  const client = {
    presetVariant: {
      async findMany(args: unknown) {
        variantFindManyCalls.push(args);
        throw new Error("preset resolver should not load all variants");
      },
      async findUnique(args: { where: { id: string } }) {
        variantFindUniqueIds.push(args.where.id);
        return variants.get(args.where.id) ?? null;
      },
    },
    presetVariantLink: {
      async findMany(args: { where: { sourceVariantId: string } }) {
        linkFindManySources.push(args.where.sourceVariantId);
        if (args.where.sourceVariantId === "root") {
          return [{ sourceVariantId: "root", linkedVariantId: "child", sortOrder: 0 }];
        }
        return [];
      },
    },
  };

  const resolved = await resolvePresetVariantContent("root", client);

  assert.equal(resolved.prompt, "root prompt, child prompt");
  assert.deepEqual(variantFindUniqueIds, ["root", "child"]);
  assert.deepEqual(linkFindManySources, ["root", "child"]);
  assert.equal(variantFindManyCalls.length, 0);
});

test("DB wrapper treats reserved training linked variants as out of scope", async () => {
  const variants = new Map([
    ["root", variant({ id: "root", prompt: "ordinary prompt" })],
    [
      "reserved-training",
      variant({
        id: "reserved-training",
        prompt: "training prompt must not leak",
        lora1: [{ path: "/training/hidden.safetensors", weight: 1, enabled: true }],
        presetNotes: JSON.stringify({
          temporary: true,
          purpose: "training_benchmark",
        }),
      }),
    ],
  ]);
  const client = {
    presetVariant: {
      async findUnique(args: { where: { id: string } }) {
        return variants.get(args.where.id) ?? null;
      },
    },
    presetVariantLink: {
      async findMany(args: { where: { sourceVariantId: string } }) {
        if (args.where.sourceVariantId === "root") {
          return [{ sourceVariantId: "root", linkedVariantId: "reserved-training", sortOrder: 0 }];
        }
        return [];
      },
    },
  };

  const resolved = await resolvePresetVariantContent("root", client);

  assert.equal(resolved.prompt, "ordinary prompt");
  assert.deepEqual(resolved.lora1, []);
  assert.deepEqual(resolved.missingReferences, [{ kind: "presetVariant", id: "reserved-training" }]);
});
