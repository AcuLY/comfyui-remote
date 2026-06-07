export type SectionPresetVariantSwitchState = {
  presetGroupId?: string | null;
  resolvedOnly: boolean;
  availableVariants: readonly { id: string; name: string }[];
};

export type SectionPresetBindingDisplayNameState = {
  presetName: string;
  variantId?: string | null;
  availableVariants: readonly { id: string; name: string }[];
};

export function canSwitchSectionPresetVariant(binding: SectionPresetVariantSwitchState) {
  return !binding.presetGroupId && binding.availableVariants.length > 1;
}

export function getSectionPresetBindingDisplayName(binding: SectionPresetBindingDisplayNameState) {
  const selectedVariant = binding.availableVariants.find((variant) => variant.id === binding.variantId);
  if (!selectedVariant?.name) return binding.presetName;

  const selectedVariantSuffix = ` / ${selectedVariant.name}`;
  if (!binding.presetName.endsWith(selectedVariantSuffix)) return binding.presetName;

  return binding.presetName.slice(0, -selectedVariantSuffix.length);
}
