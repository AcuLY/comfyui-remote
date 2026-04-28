import { prisma } from "@/lib/prisma";
import {
  groupPresetGroupHistory,
  groupPresetHistory,
  type PresetChangeDimension,
  type PresetGroupChangeDimension,
  type PresetHistoryEntry,
} from "@/server/services/preset-change-history-service";

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
  defaultParams: unknown;
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
      presets: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { variants: true } },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
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
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allGroupIds = new Set<string>();
  for (const c of categories) {
    for (const g of c.groups) {
      for (const m of g.members) {
        if (m.presetId) allPresetIds.add(m.presetId);
        if (m.variantId) allVariantIds.add(m.variantId);
        if (m.subGroupId) allGroupIds.add(m.subGroupId);
      }
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
  const pMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const vMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const gMap = new Map(groupNames.map((g) => [g.id, g.name]));

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    color: c.color,
    type: c.type,
    slotTemplate: (Array.isArray(c.slotTemplate) ? c.slotTemplate : []) as SlotTemplateDef[],
    positivePromptOrder: c.positivePromptOrder,
    negativePromptOrder: c.negativePromptOrder,
    lora1Order: c.lora1Order,
    lora2Order: c.lora2Order,
    sortOrder: c.sortOrder,
    presetCount: c._count.presets,
    groupCount: c._count.groups,
    presets: c.presets.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      notes: p.notes,
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
        defaultParams: v.defaultParams,
        linkedVariants: (Array.isArray(v.linkedVariants) ? v.linkedVariants : []) as LinkedVariantRef[],
        sortOrder: v.sortOrder,
        isActive: v.isActive,
      })),
    })),
    groups: c.groups.map((g) => ({
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
  }));
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
            select: { id: true, name: true, prompt: true, negativePrompt: true, lora1: true, lora2: true, linkedVariants: true },
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
  const allPresetIds = new Set<string>();
  const allVariantIds = new Set<string>();
  const allSubGroupIds = new Set<string>();
  for (const c of categories) {
    for (const g of c.groups) {
      for (const m of g.members) {
        if (m.presetId) allPresetIds.add(m.presetId);
        if (m.variantId) allVariantIds.add(m.variantId);
        if (m.subGroupId) allSubGroupIds.add(m.subGroupId);
      }
    }
  }

  const [presetNames, variantNames, groupNames] = await Promise.all([
    allPresetIds.size > 0
      ? prisma.preset.findMany({ where: { id: { in: [...allPresetIds] } }, select: { id: true, name: true } })
      : [],
    allVariantIds.size > 0
      ? prisma.presetVariant.findMany({ where: { id: { in: [...allVariantIds] } }, select: { id: true, name: true } })
      : [],
    allSubGroupIds.size > 0
      ? prisma.presetGroup.findMany({ where: { id: { in: [...allSubGroupIds] } }, select: { id: true, name: true } })
      : [],
  ]);

  const presetNameMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const variantNameMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const groupNameMap = new Map(groupNames.map((g) => [g.id, g.name]));

  return {
    categories: categories.map((c) => ({
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
      presets: c.presets.map((p) => ({
        id: p.id,
        name: p.name,
        folderId: p.folderId,
        variants: p.variants,
      })),
      groups: c.groups.map((g) => ({
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
    })),
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

  const pMap = new Map(presetNames.map((p) => [p.id, p.name]));
  const vMap = new Map(variantNames.map((v) => [v.id, v.name]));
  const gMap = new Map(groupNames.map((g) => [g.id, g.name]));

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
