import { buildPresetGroupMemberLayout } from "@/lib/preset-group-slot-layout";

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
    positivePromptOrder?: number | null;
    slotTemplate?: readonly { categoryId: string; label?: string }[];
    presets: readonly {
      id: string;
      name: string;
      folderId?: string | null;
      variants: readonly { id: string; name: string }[];
    }[];
    groups?: readonly {
      id: string;
      name: string;
      folderId?: string | null;
      members: readonly {
        id: string;
        presetId: string | null;
        variantId: string | null;
        subGroupId: string | null;
        slotCategoryId?: string | null;
        sortOrder?: number;
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
  return binding.availableVariants.length > 1;
}

export function getSectionPresetBindingDisplayName(binding: SectionPresetBindingDisplayNameState) {
  const selectedVariant = binding.availableVariants.find((variant) => variant.id === binding.variantId);
  if (!selectedVariant?.name) return binding.presetName;

  const selectedVariantSuffix = ` / ${selectedVariant.name}`;
  if (!binding.presetName.endsWith(selectedVariantSuffix)) return binding.presetName;

  return binding.presetName.slice(0, -selectedVariantSuffix.length);
}

export function getSectionPresetManagerHref(
  binding: Pick<SectionPresetBindingDisplaySource, "sourceId" | "variantId" | "presetGroupId" | "categoryId">,
  library?: SectionPresetBindingDisplayLibrary,
) {
  const params = new URLSearchParams();

  if (binding.sourceId) {
    if (binding.categoryId) params.set("category", binding.categoryId);
    if (binding.variantId) params.set("variant", binding.variantId);

    const preset = library?.categories
      .find((cat) => cat.id === binding.categoryId)
      ?.presets.find((item) => item.id === binding.sourceId);
    if (preset?.folderId) params.set("folder", preset.folderId);

    const query = params.toString();
    return query ? `/assets/presets/${binding.sourceId}?${query}` : `/assets/presets/${binding.sourceId}`;
  }

  if (binding.presetGroupId) {
    let groupCategoryId: string | null = null;
    let groupFolderId: string | null = null;

    for (const category of library?.categories ?? []) {
      const group = category.groups?.find((item) => item.id === binding.presetGroupId);
      if (!group) continue;
      groupCategoryId = category.id;
      groupFolderId = group.folderId ?? null;
      break;
    }

    if (groupCategoryId) params.set("category", groupCategoryId);
    if (groupFolderId) params.set("folder", groupFolderId);

    const query = params.toString();
    return query
      ? `/assets/preset-groups/${binding.presetGroupId}?${query}`
      : `/assets/preset-groups/${binding.presetGroupId}`;
  }

  if (binding.categoryId) params.set("category", binding.categoryId);
  if (binding.variantId) params.set("variant", binding.variantId);

  const query = params.toString();
  return query ? `/assets/presets?${query}` : "/assets/presets";
}

export function getSectionPresetRowCardHref<TBinding extends SectionPresetBindingDisplaySource>(
  row: Pick<SectionPresetBindingDisplayRow<TBinding>, "binding" | "isPresetGroupMember">,
  library?: SectionPresetBindingDisplayLibrary,
) {
  if (row.isPresetGroupMember) {
    if (!row.binding.presetGroupId) return null;
    return getSectionPresetManagerHref(row.binding, library);
  }

  if (!row.binding.sourceId) return null;
  return getSectionPresetManagerHref(row.binding, library);
}

export function getSectionPresetMemberPresetHref<TBinding extends SectionPresetBindingDisplaySource>(
  row: Pick<SectionPresetBindingDisplayRow<TBinding>, "sourceId" | "variantId" | "categoryId" | "isPresetGroupMember">,
  library?: SectionPresetBindingDisplayLibrary,
) {
  if (!row.isPresetGroupMember || !row.sourceId) return null;

  return getSectionPresetManagerHref(
    {
      sourceId: row.sourceId,
      variantId: row.variantId,
      presetGroupId: null,
      categoryId: row.categoryId,
    },
    library,
  );
}

export function getSectionPresetBindingGroupName(
  binding: Pick<SectionPresetBindingDisplaySource, "presetGroupId">,
  library?: SectionPresetBindingDisplayLibrary,
) {
  if (!binding.presetGroupId) return null;

  const presetInfoById = new Map<string, { categoryId: string; name: string }>();
  let groupCategory: SectionPresetBindingDisplayLibrary["categories"][number] | null = null;
  let group: NonNullable<SectionPresetBindingDisplayLibrary["categories"][number]["groups"]>[number] | null = null;

  for (const category of library?.categories ?? []) {
    for (const preset of category.presets) {
      presetInfoById.set(preset.id, { categoryId: category.id, name: preset.name });
    }

    const candidate = category.groups?.find((item) => item.id === binding.presetGroupId);
    if (candidate) {
      groupCategory = category;
      group = candidate;
    }
  }

  if (!group) return null;

  const members = group.members.map((member, index) => ({
    ...member,
    sortOrder: member.sortOrder ?? index,
    categoryId: member.presetId ? presetInfoById.get(member.presetId)?.categoryId ?? null : null,
  }));
  const rows = buildPresetGroupMemberLayout({
    slots: groupCategory?.slotTemplate ?? [],
    members,
    getMemberCategoryId: (member) => member.categoryId,
  });
  const names = rows
    .map((row) => row.member)
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
    .map((member) =>
      member.subGroupName ??
      member.presetName ??
      (member.presetId ? presetInfoById.get(member.presetId)?.name : undefined)
    )
    .filter((name): name is string => Boolean(name?.trim()));

  return names.length > 0 ? names.join(" · ") : null;
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
    categoryOrder: number;
    variants: readonly { id: string; name: string }[];
  }>();
  const categoryOrderById = new Map<string, number>();
  const groupInfoById = new Map<string, {
    id: string;
    name: string;
    members: readonly SectionPresetBindingDisplayGroupMember[];
  }>();

  let categoryOrder = 0;
  for (const category of library?.categories ?? []) {
    const currentCategoryOrder = categoryOrder;
    categoryOrder += 1;
    const currentPositivePromptOrder = category.positivePromptOrder ?? currentCategoryOrder;
    categoryOrderById.set(category.id, currentPositivePromptOrder);

    for (const preset of category.presets) {
      presetInfoById.set(preset.id, {
        id: preset.id,
        name: preset.name,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color ?? undefined,
        categoryOrder: currentPositivePromptOrder,
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
  type SortableGroupRow = SectionPresetBindingDisplayRow<TBinding> & {
    categoryOrder: number;
    groupOrder: number;
  };

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
    groupRows: SortableGroupRow[],
    groupOrder: { value: number },
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
        groupRows.push({
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
          categoryOrder: preset?.categoryOrder ?? Number.MAX_SAFE_INTEGER,
          groupOrder: groupOrder.value,
        });
        groupOrder.value += 1;
        continue;
      }

      if (member.subGroupId) {
        collectGroupRows(
          binding,
          member.subGroupId,
          parentGroupName,
          new Set(visitedGroupIds),
          groupRows,
          groupOrder,
        );
      }
    }
  };

  for (const binding of bindings) {
    if (!binding.presetGroupId || binding.sourceId) {
      pushBindingRow(binding);
      continue;
    }

    const groupRows: SortableGroupRow[] = [];
    collectGroupRows(binding, binding.presetGroupId, binding.presetName, new Set(), groupRows, { value: 0 });
    if (groupRows.length === 0) {
      pushBindingRow(binding);
      continue;
    }

    rows.push(
      ...groupRows
        .sort((left, right) => left.categoryOrder - right.categoryOrder || left.groupOrder - right.groupOrder)
        .map((row) => {
          const { categoryOrder, groupOrder, ...displayRow } = row;
          void categoryOrder;
          void groupOrder;
          return displayRow;
        }),
    );
  }

  return rows
    .map((row, index) => ({
      row,
      index,
      categoryOrder: row.categoryId
        ? categoryOrderById.get(row.categoryId) ?? Number.MAX_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) =>
      left.categoryOrder - right.categoryOrder ||
      left.index - right.index
    )
    .map(({ row }) => row);
}
