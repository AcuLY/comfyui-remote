import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { VariantDraft } from "../src/app/assets/presets/preset-types";
import {
  applyLoraToPresetVariants,
  applyPromptToPresetVariants,
  cloneLinkedVariants,
  cloneLoraBindings,
  hasIncompletePresetVariantLoraDraft,
} from "../src/app/assets/presets/preset-variant-bulk-apply";

const formPath = "src/app/assets/presets/preset-form.tsx";
const utilityPath = "src/app/assets/presets/preset-variant-bulk-apply.ts";

function variant(input: Partial<VariantDraft> & Pick<VariantDraft, "clientId" | "name">): VariantDraft {
  return {
    slug: input.name.toLowerCase(),
    prompt: "",
    negativePrompt: "",
    lora1: [],
    lora2: [],
    linkedVariants: [],
    ...input,
  };
}

test("preset variant bulk prompt apply copies the selected prompt field to every variant", () => {
  const variants = [
    variant({ clientId: "a", name: "A", prompt: "source", negativePrompt: "source negative" }),
    variant({ clientId: "b", name: "B", prompt: "old", negativePrompt: "old negative" }),
  ];

  assert.deepEqual(
    applyPromptToPresetVariants(variants, variants[0], "prompt").map((item) => item.prompt),
    ["source", "source"],
  );
  assert.deepEqual(
    applyPromptToPresetVariants(variants, variants[0], "negativePrompt").map((item) => item.negativePrompt),
    ["source negative", "source negative"],
  );
  assert.equal(variants[1].prompt, "old", "bulk prompt apply must not mutate source variants");
});

test("preset variant bulk LoRA apply updates existing paths and appends missing paths", () => {
  const variants = [
    variant({
      clientId: "a",
      name: "A",
      lora1: [{ path: "character/a.safetensors", weight: 0.3, enabled: false }],
    }),
    variant({
      clientId: "b",
      name: "B",
      lora1: [{ path: "other.safetensors", weight: 0.8, enabled: true }],
    }),
  ];

  const updated = applyLoraToPresetVariants(variants, "lora1", {
    path: "character/a.safetensors",
    weight: 0.65,
    enabled: true,
  });

  assert.ok(updated, "non-empty LoRA paths should produce an updated variant list");
  assert.deepEqual(updated.map((item) => item.lora1), [
    [{ path: "character/a.safetensors", weight: 0.65, enabled: true }],
    [
      { path: "other.safetensors", weight: 0.8, enabled: true },
      { path: "character/a.safetensors", weight: 0.65, enabled: true },
    ],
  ]);
  assert.deepEqual(variants[0].lora1, [{ path: "character/a.safetensors", weight: 0.3, enabled: false }]);
});

test("preset variant bulk LoRA apply ignores blank paths and detects incomplete drafts", () => {
  const variants = [
    variant({
      clientId: "a",
      name: "A",
      lora2: [{ path: "", weight: 1, enabled: true }],
    }),
  ];

  assert.equal(applyLoraToPresetVariants(variants, "lora2", { path: " ", weight: 1, enabled: true }), null);
  assert.equal(hasIncompletePresetVariantLoraDraft(variants), true);
  assert.equal(
    hasIncompletePresetVariantLoraDraft([
      variant({ clientId: "b", name: "B", lora1: [{ path: "ok.safetensors", weight: 1, enabled: true }] }),
    ]),
    false,
  );
});

test("preset variant clone helpers copy nested LoRA and linked variant arrays", () => {
  const loras: VariantDraft["lora1"] = [{ path: "a.safetensors", weight: 1, enabled: true }];
  const linkedVariants: VariantDraft["linkedVariants"] = [{ presetId: "preset-a", variantId: "variant-a" }];

  const clonedLoras = cloneLoraBindings(loras);
  const clonedLinks = cloneLinkedVariants(linkedVariants);
  clonedLoras[0].path = "changed.safetensors";
  clonedLinks[0].variantId = "variant-b";

  assert.equal(loras[0].path, "a.safetensors");
  assert.equal(linkedVariants[0].variantId, "variant-a");
});

test("preset form delegates apply-to-all copy loops to focused bulk utilities", () => {
  assert.ok(existsSync(utilityPath), `${utilityPath} should own preset variant bulk apply helpers`);

  const formSource = readFileSync(formPath, "utf8");
  const utilitySource = readFileSync(utilityPath, "utf8");

  assert.match(utilitySource, /export function applyPromptToPresetVariants/);
  assert.match(utilitySource, /export function applyLoraToPresetVariants/);
  assert.match(formSource, /from "\.\/preset-variant-bulk-apply";/);
  assert.doesNotMatch(formSource, /variants\.map\(\(variant\) => \(\{ \.\.\.variant, \[key\]: value \}\)\)/);
  assert.doesNotMatch(formSource, /bindings\.findIndex\(\(item\) => item\.path\.trim\(\) === path\)/);
});
