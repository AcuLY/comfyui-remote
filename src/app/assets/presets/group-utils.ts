// ---------------------------------------------------------------------------
// toSlug
// ---------------------------------------------------------------------------

/** Simple slug generator */
export function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}

export type PresetGroupNameMember = {
  displayName?: string | null;
  presetId?: string | null;
  variantId?: string | null;
  subGroupId?: string | null;
  slotCategoryId?: string | null;
};

export function buildPresetGroupNameFromMembers(members: readonly PresetGroupNameMember[]) {
  return members
    .filter((member) => Boolean(member.presetId || member.subGroupId))
    .map((member) => toSlug(member.displayName ?? ""))
    .filter(Boolean)
    .join("-");
}
