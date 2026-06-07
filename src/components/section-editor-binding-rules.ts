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

export type SectionPresetBindingDisplaySource = SectionPresetBindingDisplayNameState & {
  bindingId: string;
  sourceId?: string | null;
  presetGroupId?: string | null;
  categoryId?: string | null;
  categoryName?: string;
  categoryColor?: string;
  blockCount: number;
  loraCount: number;
};

export type SectionPresetBindingDisplayLibrary = {
  categories: readonly {
    id: string;
    name: string;
    color: string | null;
    presets: readonly {
      id: string;
      name: string;
      variants: readonly { id: string; name: string }[];
    }[];
    groups?: readonly {
      id: string;
      name: string;
      members: readonly {
        id: string;
        presetId: string | null;
        variantId: string | null;
        subGroupId: string | null;
        presetName?: string;
        variantName?: string;
        subGroupName?: string;
      }[];
    }[];
  }[];
};

type SectionPresetBindingDisplayGroupMember =
  NonNullable<SectionPresetBindingDisplayLibrary["categories"][number]["groups"]>[number]["members"][number];

export type SectionPresetBindingDisplayRow<TBinding extends SectionPresetBindingDisplaySource> = {
  key: string;
  binding: TBinding;
  presetName: string;
  sourceId: string | null;
  variantId: string | null;
  categoryId: string | null;
  categoryName?: string;
  categoryColor?: string;
  blockCount: number;
  loraCount: number;
  availableVariants: readonly { id: string; name: string }[];
  isPresetGroupMember: boolean;
  parentPresetGroupName?: string;
  variantName?: string;
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

export function expandSectionPresetBindingDisplayRows<TBinding extends SectionPresetBindingDisplaySource>(
  bindings: readonly TBinding[],
  library?: SectionPresetBindingDisplayLibrary,
) {
  const presetInfoById = new Map<string, {
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
    variants: readonly { id: string; name: string }[];
  }>();
  const groupInfoById = new Map<string, {
    id: string;
    name: string;
    members: readonly SectionPresetBindingDisplayGroupMember[];
  }>();

  for (const category of library?.categories ?? []) {
    for (const preset of category.presets) {
      presetInfoById.set(preset.id, {
        id: preset.id,
        name: preset.name,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color ?? undefined,
        variants: preset.variants,
      });
    }
    for (const group of category.groups ?? []) {
      groupInfoById.set(group.id, {
        id: group.id,
        name: group.name,
        members: group.members,
      });
    }
  }

  const rows: Array<SectionPresetBindingDisplayRow<TBinding>> = [];

  const pushBindingRow = (binding: TBinding) => {
    rows.push({
      key: binding.bindingId,
      binding,
      presetName: getSectionPresetBindingDisplayName(binding),
      sourceId: binding.sourceId ?? null,
      variantId: binding.variantId ?? null,
      categoryId: binding.categoryId ?? null,
      categoryName: binding.categoryName,
      categoryColor: binding.categoryColor,
      blockCount: binding.blockCount,
      loraCount: binding.loraCount,
      availableVariants: binding.availableVariants,
      isPresetGroupMember: false,
    });
  };

  const collectGroupRows = (
    binding: TBinding,
    groupId: string,
    parentGroupName: string,
    visitedGroupIds: Set<string>,
  ) => {
    if (visitedGroupIds.has(groupId)) return;
    const group = groupInfoById.get(groupId);
    if (!group) return;
    visitedGroupIds.add(groupId);

    for (const member of group.members) {
      if (member.presetId) {
        const preset = presetInfoById.get(member.presetId);
        const variantName = member.variantName
          ?? preset?.variants.find((variant) => variant.id === member.variantId)?.name;
        rows.push({
          key: `${binding.bindingId}:${member.id}`,
          binding,
          presetName: member.presetName ?? preset?.name ?? binding.presetName,
          sourceId: member.presetId,
          variantId: member.variantId,
          categoryId: preset?.categoryId ?? binding.categoryId ?? null,
          categoryName: preset?.categoryName ?? binding.categoryName,
          categoryColor: preset?.categoryColor ?? binding.categoryColor,
          blockCount: 1,
          loraCount: 0,
          availableVariants: [],
          isPresetGroupMember: true,
          parentPresetGroupName: parentGroupName,
          variantName,
        });
        continue;
      }

      if (member.subGroupId) {
        collectGroupRows(
          binding,
          member.subGroupId,
          parentGroupName,
          new Set(visitedGroupIds),
        );
      }
    }
  };

  for (const binding of bindings) {
    if (!binding.presetGroupId) {
      pushBindingRow(binding);
      continue;
    }

    const beforeCount = rows.length;
    collectGroupRows(binding, binding.presetGroupId, binding.presetName, new Set());
    if (rows.length === beforeCount) pushBindingRow(binding);
  }

  return rows;
}
