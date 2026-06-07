export type SectionPresetVariantSwitchState = {
  presetGroupId?: string | null;
  resolvedOnly: boolean;
  availableVariants: readonly { id: string; name: string }[];
};

export function canSwitchSectionPresetVariant(binding: SectionPresetVariantSwitchState) {
  return !binding.presetGroupId && binding.availableVariants.length > 1;
}
