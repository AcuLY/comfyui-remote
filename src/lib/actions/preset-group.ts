"use server";

import { revalidatePath } from "next/cache";
import { after as afterResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordPresetGroupChange } from "@/server/services/preset-change-history-service";
import { createBindingId } from "./_helpers";
import {
  canonicalPresetGroupBindingId,
  haveSamePresetGroupMemberSet,
  sortConcreteGroupMembersForSection,
  sortSectionPromptBlocksByCategoryOrder,
} from "./preset-group-sync";

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

type ConcreteGroupSyncMember = {
  presetId: string;
  variantId: string;
  categoryId: string;
  positivePromptOrder: number;
};

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

async function resolveConcreteGroupSyncMembers(groupId: string): Promise<ConcreteGroupSyncMember[]> {
  const members = await flattenGroup(groupId);
  if (members.length === 0) return [];

  const presets = await prisma.preset.findMany({
    where: {
      id: { in: [...new Set(members.map((member) => member.presetId))] },
    },
    select: {
      id: true,
      category: {
        select: {
          id: true,
          positivePromptOrder: true,
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      },
    },
  });
  const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
  const concreteMembers: ConcreteGroupSyncMember[] = [];

  for (const member of members) {
    const preset = presetsById.get(member.presetId);
    if (!preset) continue;

    const variant = member.variantId
      ? preset.variants.find((v) => v.id === member.variantId)
      : preset.variants[0];
    if (!variant) continue;

    concreteMembers.push({
      presetId: preset.id,
      variantId: variant.id,
      categoryId: preset.category.id,
      positivePromptOrder: preset.category.positivePromptOrder,
    });
  }

  return sortConcreteGroupMembersForSection(concreteMembers);
}

function groupMemberSignature(members: Array<{ presetId: string; variantId?: string | null }>) {
  return members.map((m) => `${m.presetId}:${m.variantId ?? ""}`).join("|");
}

function schedulePresetGroupInstanceSync(groupId: string, previousMembers: ConcreteGroupSyncMember[]) {
  afterResponse(async () => {
    try {
      await syncPresetGroupInstances(groupId, previousMembers);
    } catch (error) {
      console.error("Failed to sync preset group instances after member change", error);
    }
  });
}

async function syncPresetGroupInstances(
  groupId: string,
  previousMembers: ConcreteGroupSyncMember[],
) {
  const nextMembers = await resolveConcreteGroupSyncMembers(groupId);
  const previousSignature = groupMemberSignature(previousMembers);
  const nextSignature = groupMemberSignature(nextMembers);

  if (previousSignature === nextSignature) return;
  if (!previousSignature && nextMembers.length === 0) return;

  const groupBindingPrefix = `grp:${groupId}:`;
  const categories = await prisma.presetCategory.findMany({
    select: { id: true, positivePromptOrder: true },
  });
  const categoryOrderById = new Map(categories.map((category) => [category.id, category.positivePromptOrder]));
  const sections = await prisma.projectSection.findMany({
    where: {
      presetBindingRows: {
        some: { groupBindingKey: { not: null } },
      },
    },
    select: {
      id: true,
      projectId: true,
      presetBindingRows: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          categoryId: true,
          bindingKey: true,
          presetId: true,
          variantId: true,
          presetGroupId: true,
          groupBindingKey: true,
          sortOrder: true,
          createdAt: true,
        },
      },
      sectionPromptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sectionBindingId: true,
          type: true,
          sortOrder: true,
          createdAt: true,
          sectionBinding: {
            select: {
              id: true,
              categoryId: true,
              groupBindingKey: true,
            },
          },
        },
      },
    },
  });

  const touchedProjectIds = new Set<string>();

  for (const section of sections) {
    const bindingsByGroup = new Map<string, typeof section.presetBindingRows>();
    for (const binding of section.presetBindingRows) {
      if (!binding.groupBindingKey) continue;
      if (binding.presetGroupId || !binding.presetId) continue;
      const groupBindings = bindingsByGroup.get(binding.groupBindingKey) ?? [];
      groupBindings.push(binding);
      bindingsByGroup.set(binding.groupBindingKey, groupBindings);
    }

    for (const [groupBindingId, groupBindings] of bindingsByGroup) {
      const currentMembers = groupBindings
        .filter((binding) => binding.presetId && binding.variantId)
        .map((binding) => ({
          presetId: binding.presetId as string,
          variantId: binding.variantId as string,
        }));
      const isTrackedGroup = groupBindingId.startsWith(groupBindingPrefix);
      const isLegacyMatch = previousMembers.length > 0 && haveSamePresetGroupMemberSet(previousMembers, currentMembers);
      if (!isTrackedGroup && !isLegacyMatch) continue;

      const targetGroupBindingId = canonicalPresetGroupBindingId(groupId, groupBindingId);
      const nextBindingIds = nextMembers.map(() => createBindingId());
      const deletedBindingRowIds = new Set(groupBindings.map((binding) => binding.id));

      await prisma.$transaction(async (tx) => {
        if (deletedBindingRowIds.size > 0) {
          await tx.sectionManualLoraEntry.deleteMany({
            where: {
              projectSectionId: section.id,
              sectionBindingId: { in: [...deletedBindingRowIds] },
            },
          });
          await tx.sectionPromptBlock.deleteMany({
            where: {
              projectSectionId: section.id,
              sectionBindingId: { in: [...deletedBindingRowIds] },
            },
          });
          await tx.sectionPresetBinding.deleteMany({
            where: {
              projectSectionId: section.id,
              id: { in: [...deletedBindingRowIds] },
            },
          });
        }

        type ExistingSectionPromptRow = (typeof section.sectionPromptBlocks)[number];
        type SortableSectionPromptRow =
          | {
              kind: "existing";
              row: ExistingSectionPromptRow;
              categoryOrder: number | null;
              sortOrder: number;
            }
          | {
              kind: "create";
              member: ConcreteGroupSyncMember;
              bindingKey: string;
              categoryOrder: number | null;
              sortOrder: number;
            };

        const getCategoryOrderForRow = (row: {
          sortOrder: number;
          sectionBinding?: { categoryId: string } | null;
        }) =>
          row.sectionBinding?.categoryId
            ? categoryOrderById.get(row.sectionBinding.categoryId) ?? row.sortOrder
            : row.sortOrder;
        const fallbackGroupSortOrder = groupBindings.reduce(
          (min, binding) => Math.min(min, binding.sortOrder),
          Number.POSITIVE_INFINITY,
        );
        const groupSortOrder = Number.isFinite(fallbackGroupSortOrder) ? fallbackGroupSortOrder : 0;
        const usedAnchorIndexes = new Set<number>();
        const takeAnchorBlock = (member: ConcreteGroupSyncMember, index: number) => {
          const exactIndex = groupBindings.findIndex((binding, blockIndex) =>
            !usedAnchorIndexes.has(blockIndex) &&
            binding.presetId === member.presetId &&
            binding.variantId === member.variantId,
          );
          const categoryIndex = exactIndex >= 0
            ? exactIndex
            : groupBindings.findIndex((binding, blockIndex) =>
              !usedAnchorIndexes.has(blockIndex) && binding.categoryId === member.categoryId,
            );
          const anchorIndex = categoryIndex >= 0 ? categoryIndex : -1;
          if (anchorIndex >= 0) {
            usedAnchorIndexes.add(anchorIndex);
            return groupBindings[anchorIndex];
          }
          return { categoryId: member.categoryId, sortOrder: groupSortOrder + index };
        };

        const sortableRows: SortableSectionPromptRow[] = section.sectionPromptBlocks
          .filter((row) => !row.sectionBindingId || !deletedBindingRowIds.has(row.sectionBindingId))
          .map((row) => ({
            kind: "existing" as const,
            row,
            categoryOrder: getCategoryOrderForRow(row),
            sortOrder: row.sortOrder,
          }));

        nextMembers.forEach((member, index) => {
          const anchorBlock = takeAnchorBlock(member, index);
          sortableRows.push({
            kind: "create",
            member,
            bindingKey: nextBindingIds[index],
            categoryOrder: member.positivePromptOrder,
            sortOrder: anchorBlock.sortOrder,
          });
        });

        const sortedRows = sortSectionPromptBlocksByCategoryOrder(sortableRows);
        for (const [nextSortOrder, item] of sortedRows.entries()) {
          if (item.kind === "create") {
            const binding = await tx.sectionPresetBinding.create({
              data: {
                projectSectionId: section.id,
                bindingKey: item.bindingKey,
                categoryId: item.member.categoryId,
                presetId: item.member.presetId,
                variantId: item.member.variantId,
                groupBindingKey: targetGroupBindingId,
                sortOrder: nextSortOrder,
              },
              select: { id: true },
            });
            await tx.sectionPromptBlock.create({
              data: {
                projectSectionId: section.id,
                sectionBindingId: binding.id,
                type: "preset",
                sortOrder: nextSortOrder,
              },
            });
            continue;
          }

          if (item.row.sortOrder !== nextSortOrder) {
            await tx.sectionPromptBlock.update({
              where: { id: item.row.id },
              data: { sortOrder: nextSortOrder },
            });
            if (item.row.sectionBindingId) {
              await tx.sectionPresetBinding.update({
                where: { id: item.row.sectionBindingId },
                data: { sortOrder: nextSortOrder },
              });
            }
          }
        }
      });

      touchedProjectIds.add(section.projectId);
    }
  }

  if (touchedProjectIds.size > 0) {
    revalidatePath("/projects");
    for (const projectId of touchedProjectIds) {
      revalidatePath(`/projects/${projectId}`);
    }
  }
}

// ---------------------------------------------------------------------------
// PresetGroup CRUD
// ---------------------------------------------------------------------------

export async function createPresetGroup(input: PresetGroupInput) {
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

export async function updatePresetGroup(id: string, input: Partial<PresetGroupInput>) {
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
  return group;
}

export async function deletePresetGroup(id: string) {
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
  const [previousMembers, before] = await Promise.all([
    resolveConcreteGroupSyncMembers(input.groupId),
    groupMembersSnapshot(input.groupId),
  ]);
  const maxOrder = await prisma.presetGroupMember.aggregate({
    where: { groupId: input.groupId },
    _max: { sortOrder: true },
  });
  const member = await prisma.presetGroupMember.create({
    data: { ...input, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  const after = await groupMembersSnapshot(input.groupId);
  await recordPresetGroupChange({
    groupId: input.groupId,
    dimension: "members",
    title: "添加预制组成员",
    before,
    after,
  });
  schedulePresetGroupInstanceSync(input.groupId, previousMembers);
  revalidatePath("/assets/presets");
  return member;
}

export async function removeGroupMember(memberId: string) {
  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: { groupId: true },
  });
  if (!existing) return;
  const [previousMembers, before] = await Promise.all([
    resolveConcreteGroupSyncMembers(existing.groupId),
    groupMembersSnapshot(existing.groupId),
  ]);
  await prisma.presetGroupMember.delete({ where: { id: memberId } });
  const after = await groupMembersSnapshot(existing.groupId);
  await recordPresetGroupChange({
    groupId: existing.groupId,
    dimension: "members",
    title: "移除预制组成员",
    before,
    after,
  });
  schedulePresetGroupInstanceSync(existing.groupId, previousMembers);
  revalidatePath("/assets/presets");
  revalidatePath("/assets/preset-groups");
  revalidatePath(`/assets/preset-groups/${existing.groupId}`);
}

export async function updateGroupMember(memberId: string, input: PresetGroupMemberReplacementInput) {
  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: {
      groupId: true,
      presetId: true,
      subGroupId: true,
      slotCategoryId: true,
    },
  });
  if (!existing) return null;
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

  const [previousMembers, before] = await Promise.all([
    resolveConcreteGroupSyncMembers(existing.groupId),
    groupMembersSnapshot(existing.groupId),
  ]);
  const updated = await prisma.presetGroupMember.update({
    where: { id: memberId },
    data: {
      presetId: input.presetId,
      variantId: input.variantId,
      subGroupId: null,
    },
  });
  const after = await groupMembersSnapshot(existing.groupId);
  await recordPresetGroupChange({
    groupId: existing.groupId,
    dimension: "members",
    title: "替换预制组成员",
    before,
    after,
  });
  schedulePresetGroupInstanceSync(existing.groupId, previousMembers);
  revalidatePath("/assets/presets");
  revalidatePath("/assets/preset-groups");
  revalidatePath(`/assets/preset-groups/${existing.groupId}`);
  return updated;
}

export async function reorderPresetGroups(categoryId: string, ids: string[]) {
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
