export const PRESET_GROUP_PLACEHOLDER_LABEL = "__preset_group_placeholder__";

export function canonicalPresetGroupBindingId(groupId: string, groupBindingId: string) {
  const prefix = `grp:${groupId}:`;
  return groupBindingId.startsWith(prefix) ? groupBindingId : `${prefix}${groupBindingId}`;
}

export type PresetGroupPlaceholderBlock = {
  projectSectionId: string;
  type: "custom";
  sourceId: null;
  variantId: null;
  categoryId: null;
  bindingId: null;
  groupBindingId: string;
  label: typeof PRESET_GROUP_PLACEHOLDER_LABEL;
  positive: "";
  negative: null;
  sortOrder: number;
};

type MaybePresetGroupPlaceholderBlock = {
  type?: string | null;
  sourceId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  bindingId?: string | null;
  groupBindingId?: string | null;
  label?: string | null;
  positive?: string | null;
  negative?: string | null;
};

export function buildPresetGroupPlaceholderCreateInput(input: {
  sectionId: string;
  groupBindingId: string;
  sortOrder: number;
}): PresetGroupPlaceholderBlock {
  return {
    projectSectionId: input.sectionId,
    type: "custom",
    sourceId: null,
    variantId: null,
    categoryId: null,
    bindingId: null,
    groupBindingId: input.groupBindingId,
    label: PRESET_GROUP_PLACEHOLDER_LABEL,
    positive: "",
    negative: null,
    sortOrder: input.sortOrder,
  };
}

export function isPresetGroupPlaceholderBlock(block: MaybePresetGroupPlaceholderBlock) {
  return Boolean(block.groupBindingId) &&
    block.type === "custom" &&
    block.label === PRESET_GROUP_PLACEHOLDER_LABEL &&
    !block.sourceId &&
    !block.variantId &&
    !block.categoryId &&
    !block.bindingId &&
    !(block.positive ?? "").trim() &&
    !(block.negative ?? "").trim();
}

type PresetGroupMemberIdentity = {
  presetId: string;
  variantId?: string | null;
};

function presetGroupMemberSetSignature(members: readonly PresetGroupMemberIdentity[]) {
  return members
    .map((member) => `${member.presetId}:${member.variantId ?? ""}`)
    .sort()
    .join("|");
}

export function haveSamePresetGroupMemberSet(
  a: readonly PresetGroupMemberIdentity[],
  b: readonly PresetGroupMemberIdentity[],
) {
  return a.length === b.length && presetGroupMemberSetSignature(a) === presetGroupMemberSetSignature(b);
}

const UNKNOWN_CATEGORY_ORDER = 999_000;

type SectionOrderedGroupMember = {
  positivePromptOrder?: number | null;
};

function normalizeCategoryOrder(order: number | null | undefined) {
  return typeof order === "number" && Number.isFinite(order) ? order : UNKNOWN_CATEGORY_ORDER;
}

export function sortConcreteGroupMembersForSection<T extends SectionOrderedGroupMember>(members: readonly T[]): T[] {
  return members
    .map((member, index) => ({ member, index }))
    .sort((a, b) =>
      normalizeCategoryOrder(a.member.positivePromptOrder) - normalizeCategoryOrder(b.member.positivePromptOrder) ||
      a.index - b.index,
    )
    .map(({ member }) => member);
}
