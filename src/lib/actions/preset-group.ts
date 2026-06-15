"use server";

import { revalidatePath } from "next/cache";
import { after as afterResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordPresetGroupChange } from "@/server/services/preset-change-history-service";
import {
  assertOrdinaryPreset,
  assertOrdinaryPresetCategory,
  assertOrdinaryPresetFolder,
  assertOrdinaryPresetGroup,
  assertOrdinaryPresetVariant,
} from "./preset-resource-scope";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetGroupInput = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  sortOrder?: number;
};

export type PresetGroupMemberInput = {
  groupId: string;
  presetId?: string;
  variantId?: string;
  subGroupId?: string;
  slotCategoryId?: string;
};

export type PresetGroupMemberReplacementInput = {
  presetId: string;
  variantId: string;
};

type GroupMemberSnapshot = Awaited<ReturnType<typeof groupMembersSnapshot>>[number];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function groupMetaSnapshot(group: {
  name: string;
  slug: string;
  folderId: string | null;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    name: group.name,
    slug: group.slug,
    folderId: group.folderId,
    isActive: group.isActive,
    sortOrder: group.sortOrder,
  };
}

async function groupMembersSnapshot(groupId: string) {
  const members = await prisma.presetGroupMember.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      presetId: true,
      variantId: true,
      subGroupId: true,
      slotCategoryId: true,
      sortOrder: true,
    },
  });
  return members;
}

function sortGroupMemberSnapshots(members: GroupMemberSnapshot[]): GroupMemberSnapshot[] {
  return [...members].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function schedulePresetGroupMemberChangeEffects(input: {
  groupId: string;
  title: string;
  buildBefore: (after: GroupMemberSnapshot[]) => GroupMemberSnapshot[];
}) {
  afterResponse(async () => {
    try {
      const after = await groupMembersSnapshot(input.groupId);
      const before = sortGroupMemberSnapshots(input.buildBefore(after));
      await recordPresetGroupChange({
        groupId: input.groupId,
        dimension: "members",
        title: input.title,
        before,
        after,
      });
    } catch (error) {
      console.error("Failed to process preset group member change after response", error);
    }
  });
}

// ---------------------------------------------------------------------------
// PresetGroup CRUD
// ---------------------------------------------------------------------------

export async function createPresetGroup(input: PresetGroupInput) {
  await assertOrdinaryPresetCategory(input.categoryId);
  if (input.folderId) {
    const folder = await assertOrdinaryPresetFolder(input.folderId);
    if (folder.categoryId !== input.categoryId) {
      throw new Error("Ordinary preset group folder does not belong to the selected category");
    }
  }

  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.presetGroup.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  // Check for soft-deleted group with same slug in same category
  const existing = await prisma.presetGroup.findUnique({
    where: {
      categoryId_slug: { categoryId: input.categoryId, slug: input.slug },
    },
  });

  let group;
  if (existing && !existing.isActive) {
    // Reactivate and update the soft-deleted record, clearing old members
    await prisma.presetGroupMember.deleteMany({ where: { groupId: existing.id } });
    group = await prisma.presetGroup.update({
      where: { id: existing.id },
      data: { ...input, isActive: true },
    });
  } else {
    group = await prisma.presetGroup.create({ data: input });
  }

  await recordPresetGroupChange({
    groupId: group.id,
    dimension: "meta",
    title: existing && !existing.isActive ? "恢复预制组" : "创建预制组",
    before: null,
    after: groupMetaSnapshot(group),
  });

  revalidatePath("/assets/presets");
  return group;
}

export async function copyPresetGroup(groupId: string) {
  await assertOrdinaryPresetGroup(groupId);
  const source = await prisma.presetGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        orderBy: { sortOrder: "asc" },
        select: {
          presetId: true,
          variantId: true,
          subGroupId: true,
          slotCategoryId: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!source || !source.isActive) {
    throw new Error("Preset group not found");
  }

  let copyIdentity: { name: string; slug: string } | null = null;
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const copySuffix = attempt === 1 ? "Copy" : `Copy ${attempt}`;
    const slugSuffix = attempt === 1 ? "copy" : `copy-${attempt}`;
    const candidateSlug = `${source.slug}-${slugSuffix}`;
    const existing = await prisma.presetGroup.findUnique({
      where: {
        categoryId_slug: {
          categoryId: source.categoryId,
          slug: candidateSlug,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      copyIdentity = { name: `${source.name} ${copySuffix}`, slug: candidateSlug };
      break;
    }
  }

  if (!copyIdentity) {
    throw new Error("Unable to generate a unique preset group copy slug");
  }

  const copied = await prisma.$transaction(async (tx) => {
    const insertSortOrder = source.sortOrder + 1;
    await tx.presetGroup.updateMany({
      where: {
        categoryId: source.categoryId,
        sortOrder: { gt: source.sortOrder },
      },
      data: { sortOrder: { increment: 1 } },
    });

    const newGroup = await tx.presetGroup.create({
      data: {
        categoryId: source.categoryId,
        folderId: source.folderId,
        name: copyIdentity.name,
        slug: copyIdentity.slug,
        isActive: true,
        sortOrder: insertSortOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        folderId: true,
      },
    });

    if (source.members.length > 0) {
      await tx.presetGroupMember.createMany({
        data: source.members.map((member) => ({
          groupId: newGroup.id,
          presetId: member.presetId,
          variantId: member.variantId,
          subGroupId: member.subGroupId,
          slotCategoryId: member.slotCategoryId,
          sortOrder: member.sortOrder,
        })),
      });
    }

    return newGroup;
  });

  revalidatePath("/assets/presets");
  revalidatePath(`/assets/preset-groups/${copied.id}`);
  return copied;
}

export async function updatePresetGroup(id: string, input: Partial<PresetGroupInput>) {
  const current = await assertOrdinaryPresetGroup(id);
  if (input.categoryId) {
    await assertOrdinaryPresetCategory(input.categoryId);
  }
  if (input.folderId) {
    const folder = await assertOrdinaryPresetFolder(input.folderId);
    if (folder.categoryId !== (input.categoryId ?? current.categoryId)) {
      throw new Error("Ordinary preset group folder does not belong to the selected category");
    }
  }

  const before = await prisma.presetGroup.findUnique({ where: { id } });
  const group = await prisma.presetGroup.update({ where: { id }, data: input });
  if (before) {
    await recordPresetGroupChange({
      groupId: id,
      dimension: "meta",
      title: "更新预制组信息",
      before: groupMetaSnapshot(before),
      after: groupMetaSnapshot(group),
    });
  }
  revalidatePath("/assets/presets");
  revalidatePath(`/assets/preset-groups/${id}`);
  return group;
}

export async function deletePresetGroup(id: string) {
  await assertOrdinaryPresetGroup(id);
  const before = await prisma.presetGroup.findUnique({ where: { id } });
  const group = await prisma.presetGroup.update({ where: { id }, data: { isActive: false } });
  if (before) {
    await recordPresetGroupChange({
      groupId: id,
      dimension: "meta",
      title: "删除预制组",
      before: groupMetaSnapshot(before),
      after: groupMetaSnapshot(group),
    });
  }
  revalidatePath("/assets/presets");
}

export async function addGroupMember(input: PresetGroupMemberInput) {
  await assertOrdinaryPresetGroup(input.groupId);
  if (input.presetId) await assertOrdinaryPreset(input.presetId);
  if (input.variantId) await assertOrdinaryPresetVariant(input.variantId);
  if (input.subGroupId) await assertOrdinaryPresetGroup(input.subGroupId);
  if (input.slotCategoryId) await assertOrdinaryPresetCategory(input.slotCategoryId);

  const maxOrder = await prisma.presetGroupMember.aggregate({
    where: { groupId: input.groupId },
    _max: { sortOrder: true },
  });
  const member = await prisma.presetGroupMember.create({
    data: { ...input, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  schedulePresetGroupMemberChangeEffects({
    groupId: input.groupId,
    title: "添加预制组成员",
    buildBefore: (after) => after.filter((item) => item.id !== member.id),
  });
  revalidatePath("/assets/presets");
  revalidatePath("/assets/preset-groups");
  revalidatePath(`/assets/preset-groups/${input.groupId}`);
  return member;
}

export async function removeGroupMember(memberId: string) {
  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      groupId: true,
      presetId: true,
      variantId: true,
      subGroupId: true,
      slotCategoryId: true,
      sortOrder: true,
    },
  });
  if (!existing) return;
  await assertOrdinaryPresetGroup(existing.groupId);
  await prisma.presetGroupMember.delete({ where: { id: memberId } });
  const deletedMember: GroupMemberSnapshot = {
    id: existing.id,
    presetId: existing.presetId,
    variantId: existing.variantId,
    subGroupId: existing.subGroupId,
    slotCategoryId: existing.slotCategoryId,
    sortOrder: existing.sortOrder,
  };
  schedulePresetGroupMemberChangeEffects({
    groupId: existing.groupId,
    title: "移除预制组成员",
    buildBefore: (after) => [...after, deletedMember],
  });
  revalidatePath("/assets/presets");
  revalidatePath("/assets/preset-groups");
  revalidatePath(`/assets/preset-groups/${existing.groupId}`);
}

export async function updateGroupMember(memberId: string, input: PresetGroupMemberReplacementInput) {
  await assertOrdinaryPreset(input.presetId);
  await assertOrdinaryPresetVariant(input.variantId);

  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      groupId: true,
      presetId: true,
      variantId: true,
      subGroupId: true,
      slotCategoryId: true,
      sortOrder: true,
    },
  });
  if (!existing) return null;
  await assertOrdinaryPresetGroup(existing.groupId);
  if (!existing.presetId || existing.subGroupId) {
    throw new Error("只能替换普通预制成员");
  }

  const [existingPreset, replacementVariant] = await Promise.all([
    prisma.preset.findUnique({
      where: { id: existing.presetId },
      select: { categoryId: true },
    }),
    prisma.presetVariant.findFirst({
      where: {
        id: input.variantId,
        presetId: input.presetId,
        isActive: true,
      },
      include: { preset: { select: { categoryId: true } } },
    }),
  ]);

  if (!existingPreset || !replacementVariant) {
    throw new Error("替换预制或变体无效");
  }
  if (existingPreset.categoryId !== replacementVariant.preset.categoryId) {
    throw new Error("只能替换为同分类预制");
  }
  if (existing.slotCategoryId && existing.slotCategoryId !== replacementVariant.preset.categoryId) {
    throw new Error("只能替换为槽位分类内的预制");
  }

  const updated = await prisma.presetGroupMember.update({
    where: { id: memberId },
    data: {
      presetId: input.presetId,
      variantId: input.variantId,
      subGroupId: null,
    },
  });
  const previousMember: GroupMemberSnapshot = {
    id: existing.id,
    presetId: existing.presetId,
    variantId: existing.variantId,
    subGroupId: existing.subGroupId,
    slotCategoryId: existing.slotCategoryId,
    sortOrder: existing.sortOrder,
  };
  schedulePresetGroupMemberChangeEffects({
    groupId: existing.groupId,
    title: "替换预制组成员",
    buildBefore: (after) => {
      const hasChangedMember = after.some((item) => item.id === memberId);
      if (!hasChangedMember) return [...after, previousMember];
      return after.map((item) => item.id === memberId ? previousMember : item);
    },
  });
  revalidatePath("/assets/presets");
  revalidatePath("/assets/preset-groups");
  revalidatePath(`/assets/preset-groups/${existing.groupId}`);
  return updated;
}

export async function reorderPresetGroups(categoryId: string, ids: string[]) {
  await assertOrdinaryPresetCategory(categoryId);
  await Promise.all(ids.map((id) => assertOrdinaryPresetGroup(id)));
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroup.update({
        where: { id, categoryId },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function reorderGroupMembers(groupId: string, ids: string[]) {
  await assertOrdinaryPresetGroup(groupId);
  const before = await groupMembersSnapshot(groupId);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroupMember.update({
        where: { id, groupId },
        data: { sortOrder: index },
      }),
    ),
  );
  const after = await groupMembersSnapshot(groupId);
  await recordPresetGroupChange({
    groupId,
    dimension: "members",
    title: "调整成员顺序",
    before,
    after,
  });
  revalidatePath("/assets/presets");
}

/** Recursively flatten a group into preset+variant pairs, preventing cycles. */
export async function flattenGroup(
  groupId: string,
  visited = new Set<string>(),
): Promise<Array<{ presetId: string; variantId?: string }>> {
  await assertOrdinaryPresetGroup(groupId);
  if (visited.has(groupId)) return [];
  visited.add(groupId);

  const members = await prisma.presetGroupMember.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
  });

  const result: Array<{ presetId: string; variantId?: string }> = [];
  for (const m of members) {
    if (m.subGroupId) {
      const sub = await flattenGroup(m.subGroupId, visited);
      result.push(...sub);
    } else if (m.presetId) {
      result.push({ presetId: m.presetId, variantId: m.variantId ?? undefined });
    }
  }
  return result;
}
