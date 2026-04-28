"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordPresetGroupChange } from "@/server/services/preset-change-history-service";
import {
  parseSectionLoraConfig,
  serializeSectionLoraConfig,
  type LoraEntry,
} from "@/lib/lora-types";
import {
  createBindingId,
  makePresetLoraEntry,
  type ConcreteGroupMember,
} from "./_helpers";
import { resolveVariantContent } from "./preset-variant";

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

async function resolveConcreteGroupMembers(groupId: string): Promise<ConcreteGroupMember[]> {
  const members = await flattenGroup(groupId);
  const concreteMembers: ConcreteGroupMember[] = [];

  for (const member of members) {
    const preset = await prisma.preset.findUnique({
      where: { id: member.presetId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!preset) continue;

    const variant = member.variantId
      ? preset.variants.find((v) => v.id === member.variantId)
      : preset.variants[0];
    if (!variant) continue;

    const resolved = await resolveVariantContent(variant.id);
    concreteMembers.push({
      presetId: preset.id,
      variantId: variant.id,
      categoryId: preset.category.id,
      label: preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`,
      positive: resolved.prompt,
      negative: resolved.negativePrompt,
      presetName: preset.name,
      categoryName: preset.category.name,
      categoryColor: preset.category.color ?? undefined,
      lora1: resolved.lora1,
      lora2: resolved.lora2,
    });
  }

  return concreteMembers;
}

function groupMemberSignature(members: Array<{ presetId: string; variantId: string }>) {
  return members.map((m) => `${m.presetId}:${m.variantId}`).join("|");
}

async function syncPresetGroupInstances(
  groupId: string,
  previousMembers: ConcreteGroupMember[],
) {
  const nextMembers = await resolveConcreteGroupMembers(groupId);
  const previousSignature = groupMemberSignature(previousMembers);
  const nextSignature = groupMemberSignature(nextMembers);

  if (previousSignature === nextSignature) return;
  if (!previousSignature && nextMembers.length === 0) return;

  const groupBindingPrefix = `grp:${groupId}:`;
  const sections = await prisma.projectSection.findMany({
    where: {
      promptBlocks: {
        some: { groupBindingId: { not: null } },
      },
    },
    select: {
      id: true,
      projectId: true,
      loraConfig: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          sourceId: true,
          variantId: true,
          categoryId: true,
          bindingId: true,
          groupBindingId: true,
          label: true,
          positive: true,
          negative: true,
          sortOrder: true,
          createdAt: true,
        },
      },
    },
  });

  const touchedProjectIds = new Set<string>();

  for (const section of sections) {
    const blocksByGroup = new Map<string, typeof section.promptBlocks>();
    for (const block of section.promptBlocks) {
      if (!block.groupBindingId) continue;
      const groupBlocks = blocksByGroup.get(block.groupBindingId) ?? [];
      groupBlocks.push(block);
      blocksByGroup.set(block.groupBindingId, groupBlocks);
    }

    for (const [groupBindingId, groupBlocks] of blocksByGroup) {
      const currentSignature = groupMemberSignature(
        groupBlocks
          .filter((block) => block.type === "preset" && block.sourceId && block.variantId)
          .map((block) => ({
            presetId: block.sourceId as string,
            variantId: block.variantId as string,
          })),
      );
      const isTrackedGroup = groupBindingId.startsWith(groupBindingPrefix);
      const isLegacyMatch = Boolean(previousSignature && currentSignature === previousSignature);
      if (!isTrackedGroup && !isLegacyMatch) continue;

      const oldBindingIds = new Set(
        groupBlocks.map((block) => block.bindingId).filter((id): id is string => Boolean(id)),
      );
      const nextBindingIds = nextMembers.map(() => createBindingId());

      await prisma.$transaction(async (tx) => {
        await tx.promptBlock.deleteMany({
          where: {
            projectSectionId: section.id,
            groupBindingId,
          },
        });

        let nextSortOrder = 0;
        const createBlocks: Prisma.PromptBlockCreateManyInput[] = [];
        let insertedGroup = false;

        for (const block of section.promptBlocks) {
          if (block.groupBindingId === groupBindingId) {
            if (!insertedGroup) {
              nextMembers.forEach((member, index) => {
                createBlocks.push({
                  projectSectionId: section.id,
                  type: "preset",
                  sourceId: member.presetId,
                  variantId: member.variantId,
                  categoryId: member.categoryId,
                  bindingId: nextBindingIds[index],
                  groupBindingId,
                  label: member.label,
                  positive: member.positive,
                  negative: member.negative,
                  sortOrder: nextSortOrder,
                });
                nextSortOrder += 1;
              });
              insertedGroup = true;
            }
            continue;
          }

          if (block.sortOrder !== nextSortOrder) {
            await tx.promptBlock.update({
              where: { id: block.id },
              data: { sortOrder: nextSortOrder },
            });
          }
          nextSortOrder += 1;
        }

        if (createBlocks.length > 0) {
          await tx.promptBlock.createMany({ data: createBlocks });
        }

        const loraConfig = parseSectionLoraConfig(section.loraConfig);
        const shouldRemoveLora = (entry: LoraEntry) =>
          (entry.bindingId ? oldBindingIds.has(entry.bindingId) : false) ||
          entry.groupBindingId === groupBindingId;

        const replaceLoras = (
          existing: LoraEntry[],
          nextEntries: LoraEntry[],
        ) => {
          const insertAt = existing.findIndex(shouldRemoveLora);
          const filtered = existing.filter((entry) => !shouldRemoveLora(entry));
          filtered.splice(insertAt >= 0 ? insertAt : filtered.length, 0, ...nextEntries);
          return filtered;
        };

        const nextLora1 = nextMembers.flatMap((member, index) =>
          member.lora1.map((binding) =>
            makePresetLoraEntry(binding, member, nextBindingIds[index], groupBindingId),
          ),
        );
        const nextLora2 = nextMembers.flatMap((member, index) =>
          member.lora2.map((binding) =>
            makePresetLoraEntry(binding, member, nextBindingIds[index], groupBindingId),
          ),
        );

        await tx.projectSection.update({
          where: { id: section.id },
          data: {
            loraConfig: serializeSectionLoraConfig({
              lora1: replaceLoras(loraConfig.lora1, nextLora1),
              lora2: replaceLoras(loraConfig.lora2, nextLora2),
            }) as Prisma.InputJsonValue,
          },
        });
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
  const previousMembers = await resolveConcreteGroupMembers(input.groupId);
  const before = await groupMembersSnapshot(input.groupId);
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
  await syncPresetGroupInstances(input.groupId, previousMembers);
  revalidatePath("/assets/presets");
  return member;
}

export async function removeGroupMember(memberId: string) {
  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: { groupId: true },
  });
  if (!existing) return;
  const previousMembers = await resolveConcreteGroupMembers(existing.groupId);
  const before = await groupMembersSnapshot(existing.groupId);
  await prisma.presetGroupMember.delete({ where: { id: memberId } });
  const after = await groupMembersSnapshot(existing.groupId);
  await recordPresetGroupChange({
    groupId: existing.groupId,
    dimension: "members",
    title: "移除预制组成员",
    before,
    after,
  });
  await syncPresetGroupInstances(existing.groupId, previousMembers);
  revalidatePath("/assets/presets");
}

export async function reorderPresetGroups(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroup.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function reorderGroupMembers(groupId: string, ids: string[]) {
  const previousMembers = await resolveConcreteGroupMembers(groupId);
  const before = await groupMembersSnapshot(groupId);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroupMember.update({ where: { id }, data: { sortOrder: index } }),
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
  await syncPresetGroupInstances(groupId, previousMembers);
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
