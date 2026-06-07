import { prisma } from "@/lib/prisma";
import { buildFolderScopedItemOrder } from "@/lib/folder-navigation";
import { normalizeCivitaiLinks } from "@/lib/utils";
import {
  groupPresetGroupHistory,
  groupPresetHistory,
  type PresetChangeDimension,
  type PresetGroupChangeDimension,
  type PresetHistoryEntry,
} from "@/server/services/preset-change-history-service";

// ---------------------------------------------------------------------------
// Shared helper: resolve display names for group members
// ---------------------------------------------------------------------------

type MemberLike = {
  presetId?: string | null;
  variantId?: string | null;
  subGroupId?: string | null;
};

type ResolvedNameMaps = {
  presetMap: Map<string, string>;
  variantMap: Map<string, string>;
  groupMap: Map<string, string>;
};

type LinkedVariantSource = {
  outgoingLinks: Array<{
    linkedVariantId: string;
    linkedVariant: { presetId: string };
  }>;
};

function linkedVariantRefs(variant: LinkedVariantSource): LinkedVariantRef[] {
  return variant.outgoingLinks.map((link) => ({
    presetId: link.linkedVariant.presetId,
    variantId: link.linkedVariantId,
  }));
}

function slotTemplateFromRows(
  slots: Array<{ slotCategoryId: string; label: string | null }>,
): SlotTemplateDef[] {
  return slots.map((slot) => ({
    categoryId: slot.slotCategoryId,
    ...(slot.label ? { label: slot.label } : {}),
  }));
}

function emptyPresetHistory(): Record<PresetChangeDimension, PresetHistoryEntry<PresetChangeDimension>[]> {
  return {
    variants: [],
    content: [],
  };
}

function emptyPresetGroupHistory(): Record<PresetGroupChangeDimension, PresetHistoryEntry<PresetGroupChangeDimension>[]> {
  return {
    meta: [],
    members: [],
  };
}

/**
 * Collect member IDs from groups, batch-fetch preset/variant/group names,
 * and return lookup maps for display name resolution.
 */
async function resolveMemberNames(
  groups: Array<{ members: MemberLike[] }>,
): Promise<ResolvedNameMaps> {
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allGroupIds = new Set<string>();

  for (const g of groups) {
    for (const m of g.members) {
      if (m.presetId) allPresetIds.add(m.presetId);
      if (m.variantId) allVariantIds.add(m.variantId);
      if (m.subGroupId) allGroupIds.add(m.subGroupId);
    }
  }

  const [presetNames, variantNames, groupNames] = await Promise.all([
    allPresetIds.size > 0
      ? prisma.preset.findMany({ where: { id: { in: [...allPresetIds] } }, select: { id: true, name: true } })
      : [],
    allVariantIds.size > 0
      ? prisma.presetVariant.findMany({ where: { id: { in: [...allVariantIds] } }, select: { id: true, name: true } })
      : [],
    allGroupIds.size > 0
      ? prisma.presetGroup.findMany({ where: { id: { in: [...allGroupIds] } }, select: { id: true, name: true } })
      : [],
  ]);

  return {
    presetMap: new Map(presetNames.map((p) => [p.id, p.name])),
    variantMap: new Map(variantNames.map((v) => [v.id, v.name])),
    groupMap: new Map(groupNames.map((g) => [g.id, g.name])),
  };
}

// ---------------------------------------------------------------------------
// Preset Categories & Presets — 预制管理
// ---------------------------------------------------------------------------

export type SlotTemplateDef = { categoryId: string; label?: string };

export type PresetCategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  type: string; // "preset" | "group"
  slotTemplate: SlotTemplateDef[];
  positivePromptOrder: number;
  negativePromptOrder: number;
  lora1Order: number;
  lora2Order: number;
  sortOrder: number;
  presetCount: number;
  groupCount: number;
};

export type PresetItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  civitaiLinks: string[];
  folderId: string | null;
  variantCount: number;
};

export type LinkedVariantRef = { presetId: string; variantId: string };

export type PresetVariantItem = {
  id: string;
  presetId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
  linkedVariants: LinkedVariantRef[];
  sortOrder: number;
  isActive: boolean;
};

export type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type PresetFolderItem = FolderItem & {
  categoryId: string;
  presetCount: number;
  groupCount: number;
  childCount: number;
};

export type PresetCategoryFull = PresetCategoryItem & {
  presets: PresetFull[];
  groups: PresetGroupItem[];
  folders: FolderItem[];
};

export type PresetFull = PresetItem & {
  variants: PresetVariantItem[];
  changeHistory: Record<PresetChangeDimension, PresetHistoryEntry<PresetChangeDimension>[]>;
};

export async function getPresetCategoriesWithPresets(): Promise<PresetCategoryFull[]> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          presets: { where: { isActive: true } },
          groups: { where: { isActive: true } },
        },
      },
      ownedSlots: {
        orderBy: { sortOrder: "asc" },
        select: {
          slotCategoryId: true,
          label: true,
        },
      },
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { variants: true } },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              outgoingLinks: {
                orderBy: { sortOrder: "asc" },
                select: {
                  linkedVariantId: true,
                  linkedVariant: { select: { presetId: true } },
                },
              },
            },
          },
          changeLogs: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 20,
          },
        },
      },
      groups: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          members: { orderBy: { sortOrder: "asc" } },
          changeLogs: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 20,
          },
        },
      },
      folders: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Resolve display names for group members (batch)
  const { presetMap: pMap, variantMap: vMap, groupMap: gMap } = await resolveMemberNames(
    categories.flatMap((c) => c.groups),
  );

  return categories.map((c) => {
    const orderedPresets = buildFolderScopedItemOrder(c.folders, c.presets);
    const orderedGroups = buildFolderScopedItemOrder(c.folders, c.groups);

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      type: c.type,
      slotTemplate: slotTemplateFromRows(c.ownedSlots),
      positivePromptOrder: c.positivePromptOrder,
      negativePromptOrder: c.negativePromptOrder,
      lora1Order: c.lora1Order,
      lora2Order: c.lora2Order,
      sortOrder: c.sortOrder,
      presetCount: c._count.presets,
      groupCount: c._count.groups,
      presets: orderedPresets.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
        notes: p.notes,
        civitaiLinks: normalizeCivitaiLinks(p.civitaiLinks),
        folderId: p.folderId,
        variantCount: p._count.variants,
        changeHistory: groupPresetHistory(p.changeLogs),
        variants: p.variants.map((v) => ({
          id: v.id,
          presetId: v.presetId,
          name: v.name,
          slug: v.slug,
          prompt: v.prompt,
          negativePrompt: v.negativePrompt,
          lora1: v.lora1,
          lora2: v.lora2,
          linkedVariants: linkedVariantRefs(v),
          sortOrder: v.sortOrder,
          isActive: v.isActive,
        })),
      })),
      groups: orderedGroups.map((g) => ({
        id: g.id,
        categoryId: g.categoryId,
        name: g.name,
        slug: g.slug,
        sortOrder: g.sortOrder,
        folderId: g.folderId,
        changeHistory: groupPresetGroupHistory(g.changeLogs),
        members: g.members.map((m) => ({
          id: m.id,
          presetId: m.presetId,
          variantId: m.variantId,
          subGroupId: m.subGroupId,
          slotCategoryId: m.slotCategoryId,
          sortOrder: m.sortOrder,
          presetName: m.presetId ? pMap.get(m.presetId) : undefined,
          variantName: m.variantId ? vMap.get(m.variantId) : undefined,
          subGroupName: m.subGroupId ? gMap.get(m.subGroupId) : undefined,
        })),
      })),
      folders: c.folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        sortOrder: f.sortOrder,
      })),
    };
  });
}

export type PresetGroupEditData = {
  categories: PresetCategoryFull[];
  category: PresetCategoryFull;
  group: PresetGroupItem;
  groups: PresetGroupItem[];
};

export async function getPresetGroupEditData(groupId: string): Promise<PresetGroupEditData | null> {
  const currentGroup = await prisma.presetGroup.findFirst({
    where: { id: groupId, isActive: true },
    include: {
      members: { orderBy: { sortOrder: "asc" } },
      changeLogs: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
  });

  if (!currentGroup) return null;

  const contentVariantIds = currentGroup.members
    .filter((member) => member.variantId && !member.subGroupId)
    .map((member) => member.variantId as string);

  const [categories, contentVariants] = await Promise.all([
    prisma.presetCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            presets: { where: { isActive: true } },
            groups: { where: { isActive: true } },
          },
        },
        ownedSlots: {
          orderBy: { sortOrder: "asc" },
          select: {
            slotCategoryId: true,
            label: true,
          },
        },
        presets: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            categoryId: true,
            name: true,
            slug: true,
            isActive: true,
            sortOrder: true,
            notes: true,
            civitaiLinks: true,
            folderId: true,
            _count: { select: { variants: true } },
            variants: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                presetId: true,
                name: true,
                slug: true,
                sortOrder: true,
                isActive: true,
              },
            },
          },
        },
        groups: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            categoryId: true,
            name: true,
            slug: true,
            sortOrder: true,
            folderId: true,
          },
        },
        folders: {
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    contentVariantIds.length > 0
      ? prisma.presetVariant.findMany({
          where: { id: { in: [...new Set(contentVariantIds)] }, isActive: true },
          include: {
            outgoingLinks: {
              orderBy: { sortOrder: "asc" },
              select: {
                linkedVariantId: true,
                linkedVariant: { select: { presetId: true } },
              },
            },
          },
        })
      : [],
  ]);

  const contentByVariantId = new Map(contentVariants.map((variant) => [variant.id, variant]));
  const presetNameMap = new Map<string, string>();
  const variantNameMap = new Map<string, string>();
  const groupNameMap = new Map<string, string>();

  for (const category of categories) {
    for (const preset of category.presets) {
      presetNameMap.set(preset.id, preset.name);
      for (const variant of preset.variants) {
        variantNameMap.set(variant.id, variant.name);
      }
    }
    for (const group of category.groups) {
      groupNameMap.set(group.id, group.name);
    }
  }

  const mappedCategories: PresetCategoryFull[] = categories.map((category) => {
    const orderedPresets = buildFolderScopedItemOrder(category.folders, category.presets);
    const orderedGroups = buildFolderScopedItemOrder(category.folders, category.groups);

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      color: category.color,
      type: category.type,
      slotTemplate: slotTemplateFromRows(category.ownedSlots),
      positivePromptOrder: category.positivePromptOrder,
      negativePromptOrder: category.negativePromptOrder,
      lora1Order: category.lora1Order,
      lora2Order: category.lora2Order,
      sortOrder: category.sortOrder,
      presetCount: category._count.presets,
      groupCount: category._count.groups,
      presets: orderedPresets.map((preset) => ({
        id: preset.id,
        categoryId: preset.categoryId,
        name: preset.name,
        slug: preset.slug,
        isActive: preset.isActive,
        sortOrder: preset.sortOrder,
        notes: preset.notes,
        civitaiLinks: normalizeCivitaiLinks(preset.civitaiLinks),
        folderId: preset.folderId,
        variantCount: preset._count.variants,
        changeHistory: emptyPresetHistory(),
        variants: preset.variants.map((variant) => {
          const content = contentByVariantId.get(variant.id);
          return {
            id: variant.id,
            presetId: variant.presetId,
            name: variant.name,
            slug: variant.slug,
            prompt: content?.prompt ?? "",
            negativePrompt: content?.negativePrompt ?? null,
            lora1: content?.lora1 ?? null,
            lora2: content?.lora2 ?? null,
            linkedVariants: content ? linkedVariantRefs(content) : [],
            sortOrder: variant.sortOrder,
            isActive: variant.isActive,
          };
        }),
      })),
      groups: orderedGroups.map((group) => ({
        id: group.id,
        categoryId: group.categoryId,
        name: group.name,
        slug: group.slug,
        sortOrder: group.sortOrder,
        folderId: group.folderId,
        changeHistory: group.id === currentGroup.id
          ? groupPresetGroupHistory(currentGroup.changeLogs)
          : emptyPresetGroupHistory(),
        members: group.id === currentGroup.id
          ? currentGroup.members.map((member) => ({
              id: member.id,
              presetId: member.presetId,
              variantId: member.variantId,
              subGroupId: member.subGroupId,
              slotCategoryId: member.slotCategoryId,
              sortOrder: member.sortOrder,
              presetName: member.presetId ? presetNameMap.get(member.presetId) : undefined,
              variantName: member.variantId ? variantNameMap.get(member.variantId) : undefined,
              subGroupName: member.subGroupId ? groupNameMap.get(member.subGroupId) : undefined,
            }))
          : [],
      })),
      folders: category.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        sortOrder: folder.sortOrder,
      })),
    };
  });

  const category = mappedCategories.find((item) => item.id === currentGroup.categoryId);
  const group = category?.groups.find((item) => item.id === groupId) ?? null;

  if (!category || !group) return null;

  return {
    categories: mappedCategories,
    category,
    group,
    groups: mappedCategories.flatMap((item) => item.groups),
  };
}

/** V2 prompt library: dynamic categories for the block editor import panel */
export type PresetLibraryV2 = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
    type: string; // "preset" | "group"
    positivePromptOrder?: number;
    lora1Order?: number;
    lora2Order?: number;
    folders: Array<{ id: string; name: string; parentId: string | null; sortOrder: number }>;
    presets: Array<{
      id: string;
      name: string;
      folderId: string | null;
      variants: Array<{
        id: string;
        name: string;
        prompt: string;
        negativePrompt: string | null;
        lora1: unknown;
        lora2: unknown;
        linkedVariants: unknown;
      }>;
    }>;
    groups: Array<{
      id: string;
      name: string;
      slug: string;
      folderId: string | null;
      members: Array<{
        id: string;
        presetId: string | null;
        variantId: string | null;
        subGroupId: string | null;
        presetName?: string;
        variantName?: string;
        subGroupName?: string;
      }>;
    }>;
  }>;
};

export async function getPresetLibraryV2(): Promise<PresetLibraryV2> {
  const categories = await prisma.presetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      folders: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, parentId: true, sortOrder: true },
      },
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          folderId: true,
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              prompt: true,
              negativePrompt: true,
              lora1: true,
              lora2: true,
              outgoingLinks: {
                orderBy: { sortOrder: "asc" },
                select: {
                  linkedVariantId: true,
                  linkedVariant: { select: { presetId: true } },
                },
              },
            },
          },
        },
      },
      groups: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          members: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  // Resolve member display names for groups
  const { presetMap: presetNameMap, variantMap: variantNameMap, groupMap: groupNameMap } = await resolveMemberNames(
    categories.flatMap((c) => c.groups),
  );

  return {
    categories: categories.map((c) => {
      const orderedPresets = buildFolderScopedItemOrder(c.folders, c.presets);
      const orderedGroups = buildFolderScopedItemOrder(c.folders, c.groups);

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        color: c.color,
        icon: c.icon,
        type: c.type,
        positivePromptOrder: c.positivePromptOrder,
        lora1Order: c.lora1Order,
        lora2Order: c.lora2Order,
        folders: c.folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          sortOrder: f.sortOrder,
        })),
        presets: orderedPresets.map((p) => ({
          id: p.id,
          name: p.name,
          folderId: p.folderId,
          variants: p.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            prompt: variant.prompt,
            negativePrompt: variant.negativePrompt,
            lora1: variant.lora1,
            lora2: variant.lora2,
            linkedVariants: linkedVariantRefs(variant),
          })),
        })),
        groups: orderedGroups.map((g) => ({
          id: g.id,
          name: g.name,
          slug: g.slug,
          folderId: g.folderId,
          members: g.members.map((m) => ({
            id: m.id,
            presetId: m.presetId,
            variantId: m.variantId,
            subGroupId: m.subGroupId,
            presetName: m.presetId ? presetNameMap.get(m.presetId) : undefined,
            variantName: m.variantId ? variantNameMap.get(m.variantId) : undefined,
            subGroupName: m.subGroupId ? groupNameMap.get(m.subGroupId) : undefined,
          })),
        })),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Preset Groups — 预制组
// ---------------------------------------------------------------------------

export type PresetGroupItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  folderId: string | null;
  changeHistory: Record<PresetGroupChangeDimension, PresetHistoryEntry<PresetGroupChangeDimension>[]>;
  members: Array<{
    id: string;
    presetId: string | null;
    variantId: string | null;
    subGroupId: string | null;
    slotCategoryId: string | null;
    sortOrder: number;
    presetName?: string;
    variantName?: string;
    subGroupName?: string;
  }>;
};

export async function getPresetGroups(): Promise<PresetGroupItem[]> {
  const groups = await prisma.presetGroup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      members: {
        orderBy: { sortOrder: "asc" },
      },
      changeLogs: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
  });

  // Resolve display names for members
  const { presetMap: pMap, variantMap: vMap, groupMap: gMap } = await resolveMemberNames(groups);


  return groups.map((g) => ({
    id: g.id,
    categoryId: g.categoryId,
    name: g.name,
    slug: g.slug,
    sortOrder: g.sortOrder,
    folderId: g.folderId,
    changeHistory: groupPresetGroupHistory(g.changeLogs),
    members: g.members.map((m) => ({
      id: m.id,
      presetId: m.presetId,
      variantId: m.variantId,
      subGroupId: m.subGroupId,
      slotCategoryId: m.slotCategoryId,
      sortOrder: m.sortOrder,
      presetName: m.presetId ? pMap.get(m.presetId) : undefined,
      variantName: m.variantId ? vMap.get(m.variantId) : undefined,
      subGroupName: m.subGroupId ? gMap.get(m.subGroupId) : undefined,
    })),
  }));
}

export async function getPresetGroup(groupId: string): Promise<PresetGroupItem | null> {
  const groups = await getPresetGroups();
  return groups.find((group) => group.id === groupId) ?? null;
}

export async function getPresetFolders(filters: {
  categoryId?: string;
  parentId?: string | null;
} = {}): Promise<PresetFolderItem[]> {
  const folders = await prisma.presetFolder.findMany({
    where: {
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.parentId !== undefined ? { parentId: filters.parentId } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          presets: true,
          groups: true,
          children: true,
        },
      },
    },
  });

  return folders.map((folder) => ({
    id: folder.id,
    categoryId: folder.categoryId,
    name: folder.name,
    parentId: folder.parentId,
    sortOrder: folder.sortOrder,
    presetCount: folder._count.presets,
    groupCount: folder._count.groups,
    childCount: folder._count.children,
  }));
}

export async function getPresetFolder(folderId: string): Promise<PresetFolderItem | null> {
  const folder = await prisma.presetFolder.findUnique({
    where: { id: folderId },
    include: {
      _count: {
        select: {
          presets: true,
          groups: true,
          children: true,
        },
      },
    },
  });
  if (!folder) return null;

  return {
    id: folder.id,
    categoryId: folder.categoryId,
    name: folder.name,
    parentId: folder.parentId,
    sortOrder: folder.sortOrder,
    presetCount: folder._count.presets,
    groupCount: folder._count.groups,
    childCount: folder._count.children,
  };
}
