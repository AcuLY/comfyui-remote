export type PresetGroupSlotDef = {
  categoryId: string;
  label?: string;
};

export type PresetGroupSlotLayoutRow<TMember> =
  | {
      kind: "slot";
      key: string;
      slot: PresetGroupSlotDef;
      slotIndex: number;
      member: TMember | null;
    }
  | {
      kind: "extra";
      key: string;
      member: TMember;
    };

type SlotLayoutMember = {
  id: string;
  sortOrder: number;
  slotCategoryId?: string | null;
  subGroupId?: string | null;
};

function sortMembers<TMember extends SlotLayoutMember>(members: readonly TMember[]) {
  return [...members].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

function memberMatchesSlot<TMember extends SlotLayoutMember>(
  member: TMember,
  slot: PresetGroupSlotDef,
  getMemberCategoryId: (member: TMember) => string | null | undefined,
) {
  if (member.subGroupId) return false;
  return getMemberCategoryId(member) === slot.categoryId;
}

function slotCandidateScore<TMember extends SlotLayoutMember>(
  member: TMember,
  slot: PresetGroupSlotDef,
) {
  return member.slotCategoryId === slot.categoryId ? 0 : 1;
}

export function buildPresetGroupMemberLayout<TMember extends SlotLayoutMember>(input: {
  slots: readonly PresetGroupSlotDef[];
  members: readonly TMember[];
  getMemberCategoryId: (member: TMember) => string | null | undefined;
}): PresetGroupSlotLayoutRow<TMember>[] {
  const orderedMembers = sortMembers(input.members);

  if (input.slots.length === 0) {
    return orderedMembers.map((member) => ({
      kind: "extra" as const,
      key: `member:${member.id}`,
      member,
    }));
  }

  const unusedMemberIds = new Set(orderedMembers.map((member) => member.id));
  const rows: PresetGroupSlotLayoutRow<TMember>[] = [];

  input.slots.forEach((slot, slotIndex) => {
    const member = orderedMembers
      .filter((candidate) =>
        unusedMemberIds.has(candidate.id) &&
        memberMatchesSlot(candidate, slot, input.getMemberCategoryId)
      )
      .sort((left, right) =>
        slotCandidateScore(left, slot) - slotCandidateScore(right, slot) ||
        left.sortOrder - right.sortOrder ||
        left.id.localeCompare(right.id)
      )[0] ?? null;

    if (member) unusedMemberIds.delete(member.id);

    rows.push({
      kind: "slot",
      key: `slot:${slot.categoryId}:${slotIndex}`,
      slot,
      slotIndex,
      member,
    });
  });

  for (const member of orderedMembers) {
    if (!unusedMemberIds.has(member.id)) continue;
    rows.push({
      kind: "extra",
      key: `member:${member.id}`,
      member,
    });
  }

  return rows;
}
