import type { VariantDraft } from "./preset-types";

export function cloneLoraBindings(bindings: VariantDraft["lora1"]) {
  return bindings.map((entry) => ({ ...entry }));
}

export function cloneLinkedVariants(linkedVariants: VariantDraft["linkedVariants"]) {
  return linkedVariants.map((entry) => ({ ...entry }));
}

export function hasIncompletePresetVariantLoraDraft(variantDrafts: VariantDraft[]) {
  return variantDrafts.some((variant) =>
    [...variant.lora1, ...variant.lora2].some((entry) => !entry.path.trim()),
  );
}

export function applyPromptToPresetVariants(
  variants: VariantDraft[],
  sourceVariant: VariantDraft,
  key: "prompt" | "negativePrompt",
) {
  const value = sourceVariant[key];
  return variants.map((variant) => ({ ...variant, [key]: value }));
}

export function applyLoraToPresetVariants(
  variants: VariantDraft[],
  key: "lora1" | "lora2",
  entry: VariantDraft["lora1"][number],
) {
  const path = entry.path.trim();
  if (!path) return null;

  const appliedEntry = {
    path,
    weight: entry.weight,
    enabled: entry.enabled,
  };

  return variants.map((variant) => {
    const bindings = cloneLoraBindings(variant[key]);
    const existingIdx = bindings.findIndex((item) => item.path.trim() === path);
    if (existingIdx >= 0) {
      bindings[existingIdx] = appliedEntry;
    } else {
      bindings.push(appliedEntry);
    }

    return { ...variant, [key]: bindings };
  });
}
