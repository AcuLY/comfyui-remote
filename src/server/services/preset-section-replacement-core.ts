export type PresetSectionReplacementRule = {
  fromPresetId: string;
  toPresetId: string;
  toVariantId?: string | null;
};

export type PresetReplacementPreset = {
  id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
  variants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
  }>;
};

export type PresetReplacementBinding = {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerSortOrder: number;
  bindingKey: string;
  categoryId: string;
  presetId: string | null;
  variantId: string | null;
  presetGroupId: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
};

export type PresetReplacementBlocker = {
  code: string;
  message: string;
};

export type PresetReplacementUpdate = {
  bindingRowId: string;
  ownerId: string;
  ownerName: string;
  bindingKey: string;
  fromPresetId: string;
  fromVariantId: string | null;
  toPresetId: string;
  toVariantId: string;
};

export type PresetReplacementRulePlan = {
  index: number;
  fromPresetId: string;
  toPresetId: string;
  toVariantId: string | null;
  fromPresetName: string | null;
  toPresetName: string | null;
  status: "planned" | "noop" | "blocked";
  blockers: PresetReplacementBlocker[];
  updates: PresetReplacementUpdate[];
};

export type PresetReplacementPlan = {
  rules: PresetReplacementRulePlan[];
  globalBlockers: PresetReplacementBlocker[];
  hasBlockers: boolean;
  totalPlannedUpdateCount: number;
};

function cleanId(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function activeVariants(preset: PresetReplacementPreset) {
  return preset.variants
    .filter((variant) => variant.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

function duplicateSourceBlockers(rules: readonly PresetSectionReplacementRule[]) {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    const fromPresetId = cleanId(rule.fromPresetId);
    if (!fromPresetId) continue;
    counts.set(fromPresetId, (counts.get(fromPresetId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([fromPresetId]) => ({
      code: "DUPLICATE_SOURCE_PRESET",
      message: `重复的来源预制：${fromPresetId}`,
    }));
}

function ordinaryPresetBinding(binding: PresetReplacementBinding, fromPresetId: string) {
  return (
    binding.presetId === fromPresetId &&
    !binding.presetGroupId &&
    !binding.groupBindingKey
  );
}

export function planPresetSectionReplacements(input: {
  presets: readonly PresetReplacementPreset[];
  bindings: readonly PresetReplacementBinding[];
  rules: readonly PresetSectionReplacementRule[];
}): PresetReplacementPlan {
  const presetById = new Map(input.presets.map((preset) => [preset.id, preset]));
  const globalBlockers = duplicateSourceBlockers(input.rules);

  const rules: PresetReplacementRulePlan[] = input.rules.map((rawRule, index) => {
    const fromPresetId = cleanId(rawRule.fromPresetId);
    const toPresetId = cleanId(rawRule.toPresetId);
    const requestedVariantId = cleanId(rawRule.toVariantId);
    const blockers: PresetReplacementBlocker[] = [];
    const fromPreset = presetById.get(fromPresetId) ?? null;
    const toPreset = presetById.get(toPresetId) ?? null;

    if (!fromPresetId) {
      blockers.push({ code: "FROM_PRESET_REQUIRED", message: "请选择来源预制" });
    } else if (!fromPreset || !fromPreset.isActive) {
      blockers.push({ code: "FROM_PRESET_NOT_FOUND", message: `来源预制不可用：${fromPresetId}` });
    }

    if (!toPresetId) {
      blockers.push({ code: "TO_PRESET_REQUIRED", message: "请选择目标预制" });
    } else if (!toPreset || !toPreset.isActive) {
      blockers.push({ code: "TO_PRESET_NOT_FOUND", message: `目标预制不可用：${toPresetId}` });
    }

    if (fromPreset && toPreset && fromPreset.categoryId !== toPreset.categoryId) {
      blockers.push({ code: "CATEGORY_MISMATCH", message: "A 和 B 必须属于同分类预制" });
    }

    const variants = toPreset ? activeVariants(toPreset) : [];
    const targetVariant = requestedVariantId
      ? variants.find((variant) => variant.id === requestedVariantId) ?? null
      : variants[0] ?? null;
    if (toPreset && !targetVariant) {
      blockers.push({
        code: requestedVariantId ? "TARGET_VARIANT_NOT_FOUND" : "TARGET_VARIANT_REQUIRED",
        message: requestedVariantId ? "目标变体不可用" : "目标预制没有可用变体",
      });
    }

    if (blockers.length > 0 || !fromPreset || !toPreset || !targetVariant) {
      return {
        index,
        fromPresetId,
        toPresetId,
        toVariantId: requestedVariantId || null,
        fromPresetName: fromPreset?.name ?? null,
        toPresetName: toPreset?.name ?? null,
        status: "blocked",
        blockers,
        updates: [],
      };
    }

    const updates = input.bindings
      .filter((binding) => ordinaryPresetBinding(binding, fromPreset.id))
      .filter((binding) => binding.presetId !== toPreset.id || binding.variantId !== targetVariant.id)
      .sort((left, right) =>
        left.ownerSortOrder - right.ownerSortOrder ||
        left.sortOrder - right.sortOrder ||
        left.ownerName.localeCompare(right.ownerName),
      )
      .map((binding) => ({
        bindingRowId: binding.id,
        ownerId: binding.ownerId,
        ownerName: binding.ownerName,
        bindingKey: binding.bindingKey,
        fromPresetId: fromPreset.id,
        fromVariantId: binding.variantId,
        toPresetId: toPreset.id,
        toVariantId: targetVariant.id,
      }));

    return {
      index,
      fromPresetId,
      toPresetId,
      toVariantId: targetVariant.id,
      fromPresetName: fromPreset.name,
      toPresetName: toPreset.name,
      status: updates.length > 0 ? "planned" : "noop",
      blockers: [],
      updates,
    };
  });

  const totalPlannedUpdateCount = rules.reduce((sum, rule) => sum + rule.updates.length, 0);
  const hasBlockers = globalBlockers.length > 0 || rules.some((rule) => rule.blockers.length > 0);

  return {
    rules,
    globalBlockers,
    hasBlockers,
    totalPlannedUpdateCount,
  };
}
