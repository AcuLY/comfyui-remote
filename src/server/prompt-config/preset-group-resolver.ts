import {
  isOrdinaryPresetCategoryType,
  isOrdinaryPresetLibraryCategoryType,
} from "@/lib/actions/preset-resource-scope";
import { dedupeLoraBindingsByPath, joinPromptParts, sortBySortOrder } from "./order";
import {
  loadReachablePresetVariantGraph,
  resolvePresetVariantContentFromRows,
} from "./preset-resolver";
import type {
  MissingReference,
  PresetCategoryRow,
  PresetVariantLinkRow,
  PresetVariantRow,
  ResolvedPresetGroupContent,
  ResolvedPresetGroupMemberContent,
} from "./types";

type PresetGroupMemberRow = {
  id: string;
  presetId: string | null;
  variantId: string | null;
  subGroupId: string | null;
  sortOrder: number;
};

type PresetGroupRow = {
  id: string;
  categoryId: string;
  name: string;
  isActive?: boolean | null;
  category: PresetCategoryRow;
  members: PresetGroupMemberRow[];
};

type PresetForGroupRow = {
  id: string;
  categoryId: string;
  name: string;
  category: PresetCategoryRow;
  variants: Array<{
    id: string;
    presetId: string;
    name?: string | null;
    sortOrder?: number | null;
    isActive?: boolean | null;
  }>;
};

export type PresetGroupResolverDbClient = {
  presetGroup: {
    findUnique(args: unknown): Promise<PresetGroupRow | null>;
  };
  preset: {
    findUnique(args: unknown): Promise<PresetForGroupRow | null>;
  };
  presetVariant: {
    findUnique(args: unknown): Promise<PresetVariantRow | null>;
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  presetVariantLink: {
    findMany(args: unknown): Promise<PresetVariantLinkRow[]>;
  };
};

type ConcreteGroupMember = {
  presetId: string;
  variantId: string;
  presetName: string;
  category: PresetCategoryRow;
  variantName: string | null;
  variantCount: number;
};

function isOrdinaryPresetLibraryCategoryRow(category: PresetCategoryRow | null | undefined) {
  const categoryType = category?.type;
  return categoryType === undefined || categoryType === null || isOrdinaryPresetLibraryCategoryType(categoryType);
}

function isOrdinaryPresetCategoryRow(category: PresetCategoryRow | null | undefined) {
  const categoryType = category?.type;
  return categoryType === undefined || categoryType === null || isOrdinaryPresetCategoryType(categoryType);
}

async function loadPresetGroup(
  groupId: string,
  client: PresetGroupResolverDbClient,
) {
  return client.presetGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      categoryId: true,
      name: true,
      isActive: true,
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          positivePromptOrder: true,
          negativePromptOrder: true,
          lora1Order: true,
          lora2Order: true,
          type: true,
        },
      },
      members: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          presetId: true,
          variantId: true,
          subGroupId: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function loadConcreteGroupMembers(
  groupId: string,
  client: PresetGroupResolverDbClient,
  missingReferences: MissingReference[],
  visited = new Set<string>(),
): Promise<ConcreteGroupMember[]> {
  if (visited.has(groupId)) return [];
  visited.add(groupId);

  const group = await loadPresetGroup(groupId, client);
  if (!group || group.isActive === false || !isOrdinaryPresetLibraryCategoryRow(group.category)) {
    missingReferences.push({ kind: "presetGroup", id: groupId });
    return [];
  }

  const members: ConcreteGroupMember[] = [];
  for (const member of group.members) {
    if (member.subGroupId) {
      members.push(...await loadConcreteGroupMembers(member.subGroupId, client, missingReferences, visited));
      continue;
    }
    if (!member.presetId) continue;

    const preset = await client.preset.findUnique({
      where: { id: member.presetId },
      select: {
        id: true,
        categoryId: true,
        name: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            positivePromptOrder: true,
            negativePromptOrder: true,
            lora1Order: true,
            lora2Order: true,
            type: true,
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            presetId: true,
            name: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });
    if (!preset || !isOrdinaryPresetCategoryRow(preset.category)) {
      missingReferences.push({ kind: "preset", id: member.presetId, ownerId: groupId });
      continue;
    }

    const activeVariants = sortBySortOrder(preset.variants.filter((variant) => variant.isActive !== false));
    const variant = member.variantId
      ? activeVariants.find((item) => item.id === member.variantId) ?? null
      : activeVariants[0] ?? null;
    if (!variant) {
      missingReferences.push({
        kind: "presetVariant",
        id: member.variantId ?? `${preset.id}:default`,
        ownerId: groupId,
      });
      continue;
    }

    members.push({
      presetId: preset.id,
      variantId: variant.id,
      presetName: preset.name,
      category: preset.category,
      variantName: variant.name ?? null,
      variantCount: activeVariants.length,
    });
  }

  return members;
}

function buildMemberLabel(member: ConcreteGroupMember) {
  return member.variantCount <= 1 || !member.variantName
    ? member.presetName
    : `${member.presetName} / ${member.variantName}`;
}

function normalizeCategoryOrder(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 999;
}

function sortConcreteMembersByPresetCategory(members: readonly ConcreteGroupMember[]) {
  return [...members]
    .map((member, index) => ({ member, index }))
    .sort((left, right) =>
      normalizeCategoryOrder(left.member.category.positivePromptOrder) -
        normalizeCategoryOrder(right.member.category.positivePromptOrder) ||
      left.index - right.index,
    )
    .map(({ member }) => member);
}

function resolveMemberContent(
  members: readonly ConcreteGroupMember[],
  variants: readonly PresetVariantRow[],
  variantLinks: readonly PresetVariantLinkRow[],
) {
  const resolvedMembers: ResolvedPresetGroupMemberContent[] = [];
  const missingReferences: MissingReference[] = [];

  for (const member of members) {
    const resolved = resolvePresetVariantContentFromRows(member.variantId, {
      variants: [...variants],
      variantLinks: [...variantLinks],
    });
    missingReferences.push(...resolved.missingReferences);
    resolvedMembers.push({
      presetId: member.presetId,
      variantId: member.variantId,
      presetName: member.presetName,
      label: buildMemberLabel(member),
      categoryId: member.category.id,
      categoryName: member.category.name,
      categoryColor: member.category.color,
      positivePromptOrder: normalizeCategoryOrder(member.category.positivePromptOrder),
      negativePromptOrder: normalizeCategoryOrder(member.category.negativePromptOrder),
      lora1Order: normalizeCategoryOrder(member.category.lora1Order),
      lora2Order: normalizeCategoryOrder(member.category.lora2Order),
      prompt: resolved.prompt,
      negativePrompt: resolved.negativePrompt,
      lora1: resolved.lora1,
      lora2: resolved.lora2,
    });
  }

  return { resolvedMembers, missingReferences };
}

export async function resolvePresetGroupContent(
  groupId: string,
  client: PresetGroupResolverDbClient,
): Promise<ResolvedPresetGroupContent | null> {
  const group = await loadPresetGroup(groupId, client);
  if (!group || group.isActive === false) return null;

  const missingReferences: MissingReference[] = [];
  const concreteMembers = sortConcreteMembersByPresetCategory(
    await loadConcreteGroupMembers(groupId, client, missingReferences),
  );
  const { variants, variantLinks } = await loadReachablePresetVariantGraph(
    concreteMembers.map((member) => member.variantId),
    client,
  );
  const { resolvedMembers, missingReferences: memberMissingReferences } = resolveMemberContent(
    concreteMembers,
    variants,
    variantLinks ?? [],
  );
  missingReferences.push(...memberMissingReferences);

  const lora1 = dedupeLoraBindingsByPath(resolvedMembers.flatMap((member) => member.lora1));
  const lora2 = dedupeLoraBindingsByPath(resolvedMembers.flatMap((member) => member.lora2));

  return {
    groupId: group.id,
    categoryId: group.categoryId,
    name: group.name,
    prompt: joinPromptParts(resolvedMembers.map((member) => member.prompt), " BREAK "),
    negativePrompt: joinPromptParts(resolvedMembers.map((member) => member.negativePrompt), " BREAK ") || null,
    lora1,
    lora2,
    members: resolvedMembers,
    missingReferences,
  };
}

export async function resolvePresetGroupContents(
  groupIds: readonly string[],
  client: PresetGroupResolverDbClient,
) {
  const resolvedGroups: ResolvedPresetGroupContent[] = [];
  const seen = new Set<string>();

  for (const groupId of groupIds) {
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    const resolved = await resolvePresetGroupContent(groupId, client);
    if (resolved) resolvedGroups.push(resolved);
  }

  return resolvedGroups;
}
