import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import type { LoraTrainingPreset } from "@/features/training/types";
import { prisma } from "@/lib/prisma";
import {
  trainingPresetInputSchema,
  trainingPresetSortRulesSchema,
  trainingSceneCategoryCreateSchema,
  trainingSceneCategoryUpdateSchema,
  trainingSceneFolderCreateSchema,
  trainingSceneFolderUpdateSchema,
} from "@/lib/training/schemas";
import {
  getTrainingSceneDescriptionCategoryRow as getTrainingSceneCategoryRowFromRepository,
  getTrainingSceneDescriptionFolderRow as getTrainingSceneFolderRowFromRepository,
  getTrainingSceneDescriptionPresetRow as getTrainingPresetRowFromRepository,
  listTrainingSceneDescriptionCategoryRows as listTrainingSceneCategoryRowsFromRepository,
  listTrainingSceneDescriptionFolderRows as listTrainingSceneFolderRowsFromRepository,
  listTrainingSceneDescriptionPresetRows as listTrainingPresetRowsFromRepository,
  type TrainingPresetRow,
  type TrainingSceneCategoryRow,
  type TrainingSceneFolderRow,
} from "@/server/repositories/training/scene-description-presets";
import { slugifyForTrainingRepository } from "@/server/repositories/training/helpers";

export type TrainingSceneDescriptionCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  sceneDescriptionOrder: number;
};

export type TrainingSceneDescriptionFolder = {
  id: string;
  categoryId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};

type TrainingPresetDefault = {
  categoryName: string;
  categorySlug: string;
  categorySortOrder: number;
  folderName: string;
  folderSortOrder: number;
  id: string;
  isActive: boolean;
  projectUsage: string[];
  sceneDescriptionText: string;
  sortOrder: number;
  templateUsage: string[];
  title: string;
  updatedAt: string;
};

const DEFAULT_TRAINING_PRESETS: TrainingPresetDefault[] = [
  {
    id: "cyan-rim-light",
    title: "青色轮廓光",
    updatedAt: "16:01",
    categoryName: "光线",
    categorySlug: "training-lighting",
    categorySortOrder: 10,
  folderName: "舞台",
  folderSortOrder: 10,
  sortOrder: 10,
  isActive: true,
  sceneDescriptionText: "冷色舞台灯光，侧后方有清晰青色轮廓光，背景暗部保留少量霓虹反射。",
  projectUsage: ["训练项目 / 舞台肖像"],
  templateUsage: ["角色 LoRA 基础模板 / 舞台肖像"],
},
  {
    id: "rainy-street",
    title: "雨后街角",
    updatedAt: "15:48",
    categoryName: "环境",
    categorySlug: "training-environment",
    categorySortOrder: 20,
  folderName: "城市",
  folderSortOrder: 10,
  sortOrder: 20,
  isActive: true,
  sceneDescriptionText: "雨后街角，地面有霓虹反射，背景轻微虚化但仍可辨认街道层次。",
  projectUsage: ["训练项目 / 街角夜景", "训练项目 / 雨夜背光"],
  templateUsage: ["街拍扩展模板 / 夜景"],
},
  {
    id: "white-studio",
    title: "白底棚拍",
    updatedAt: "15:20",
    categoryName: "构图",
    categorySlug: "training-composition",
    categorySortOrder: 30,
  folderName: "训练净图",
  folderSortOrder: 10,
  sortOrder: 30,
  isActive: true,
  sceneDescriptionText: "白底棚拍，少量柔光，移除复杂背景，优先保证角色全身服装和发型稳定。",
  projectUsage: ["训练项目 / 白底棚拍"],
  templateUsage: ["角色 LoRA 基础模板 / 净图"],
},
  {
    id: "old-haze",
    title: "旧版薄雾",
    updatedAt: "上周",
    categoryName: "环境",
    categorySlug: "training-environment",
    categorySortOrder: 20,
    folderName: "归档",
    folderSortOrder: 20,
    sortOrder: 40,
    isActive: false,
    sceneDescriptionText: "低对比薄雾背景，旧版项目保留，不建议新项目继续使用。",
    projectUsage: [],
    templateUsage: [],
  },
];
const DEFAULT_TRAINING_PRESET_IDS = new Set(DEFAULT_TRAINING_PRESETS.map((preset) => preset.id));

export class TrainingPresetServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingPresetServiceError";
    this.status = status;
    this.details = details;
  }
}

function defaultUsageForPreset(presetId: string) {
  const defaultPreset = DEFAULT_TRAINING_PRESETS.find((preset) => preset.id === presetId);
  return {
    projectUsage: defaultPreset?.projectUsage ?? [],
    templateUsage: defaultPreset?.templateUsage ?? [],
  };
}

function sortTrainingSceneCategories(categories: TrainingSceneDescriptionCategory[]) {
  return [...categories].sort((left, right) =>
    left.sortOrder - right.sortOrder
    || left.sceneDescriptionOrder - right.sceneDescriptionOrder
    || left.name.localeCompare(right.name),
  );
}

function sortTrainingSceneFolders(folders: TrainingSceneDescriptionFolder[]) {
  return [...folders].sort((left, right) =>
    left.categoryId.localeCompare(right.categoryId)
    || (left.parentId ?? "").localeCompare(right.parentId ?? "")
    || left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name),
  );
}

function formatUpdatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapTrainingPreset(row: TrainingPresetRow): LoraTrainingPreset {
  const usage = defaultUsageForPreset(row.id);
  return {
    id: row.id,
    title: row.name,
    category: row.category.name,
    folder: row.folder?.name ?? "未归档",
    status: row.isActive ? "active" : "inactive",
    updatedAt: formatUpdatedAt(row.updatedAt),
    sceneDescriptionText: row.sceneDescriptionText,
    projectUsage: usage.projectUsage,
    templateUsage: usage.templateUsage,
  };
}

function mapTrainingSceneCategory(row: TrainingSceneCategoryRow): TrainingSceneDescriptionCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    sceneDescriptionOrder: row.sceneDescriptionOrder,
  };
}

function mapTrainingSceneFolder(row: TrainingSceneFolderRow): TrainingSceneDescriptionFolder {
  return {
    id: row.id,
    categoryId: row.categoryId,
    parentId: row.parentId,
    name: row.name,
    sortOrder: row.sortOrder,
  };
}

function parseTrainingPresetInput(input: unknown) {
  const result = trainingPresetInputSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingPresetServiceError("Invalid training preset request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseTrainingSceneCategoryCreateInput(input: unknown) {
  const result = trainingSceneCategoryCreateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingPresetServiceError("Invalid training scene-description category request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseTrainingSceneCategoryUpdateInput(input: unknown) {
  const result = trainingSceneCategoryUpdateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingPresetServiceError("Invalid training scene-description category request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseTrainingSceneFolderCreateInput(input: unknown) {
  const result = trainingSceneFolderCreateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingPresetServiceError("Invalid training scene-description folder request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

function parseTrainingSceneFolderUpdateInput(input: unknown) {
  const result = trainingSceneFolderUpdateSchema.safeParse(input);
  if (result.success) return result.data;
  throw new TrainingPresetServiceError("Invalid training scene-description folder request", 400, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

async function resolveDefaultTrainingCategoryId(tx: Prisma.TransactionClient, preset: TrainingPresetDefault) {
  const existingTrainingCategory = await tx.trainingSceneDescriptionPresetCategory.findFirst({
    where: {
      slug: preset.categorySlug,
    },
    select: { id: true },
  });

  if (existingTrainingCategory) {
    await tx.trainingSceneDescriptionPresetCategory.update({
      where: { id: existingTrainingCategory.id },
      data: {
        name: preset.categoryName,
      },
    });
    return existingTrainingCategory.id;
  }

  const createdCategory = await tx.trainingSceneDescriptionPresetCategory.create({
    data: {
      id: `training-category-${preset.categorySlug}`,
      name: preset.categoryName,
      slug: preset.categorySlug,
      sortOrder: preset.categorySortOrder,
      sceneDescriptionOrder: preset.categorySortOrder,
    },
    select: { id: true },
  });

  return createdCategory.id;
}

async function ensureDefaultTrainingPresets() {
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map<string, string>();
    const folderIds = new Map<string, string>();

    for (const preset of DEFAULT_TRAINING_PRESETS) {
      let categoryId = categoryIds.get(preset.categorySlug);
      if (!categoryId) {
        categoryId = await resolveDefaultTrainingCategoryId(tx, preset);
        categoryIds.set(preset.categorySlug, categoryId);
      }

      const folderKey = `${categoryId}:${preset.folderName}`;
      let folderId = folderIds.get(folderKey);
      if (!folderId) {
        const existingFolder = await tx.trainingSceneDescriptionPresetFolder.findFirst({
          where: {
            categoryId,
            parentId: null,
            name: preset.folderName,
          },
          select: { id: true },
        });
        if (existingFolder) {
          folderId = existingFolder.id;
        } else {
          const createdFolder = await tx.trainingSceneDescriptionPresetFolder.create({
            data: {
              id: `training-folder-${preset.id}`,
              categoryId,
              parentId: null,
              name: preset.folderName,
              sortOrder: preset.folderSortOrder,
            },
            select: { id: true },
          });
          folderId = createdFolder.id;
        }
        folderIds.set(folderKey, folderId);
      }

      const presetId = preset.id;
      const existingPreset = await tx.trainingSceneDescriptionPreset.findUnique({
        where: { id: presetId },
        select: { id: true },
      });

      if (!existingPreset) {
        await tx.trainingSceneDescriptionPreset.create({
          data: {
            id: presetId,
            categoryId,
            folderId,
            name: preset.title,
            slug: presetId,
            sceneDescriptionText: preset.sceneDescriptionText,
            isActive: preset.isActive,
            sortOrder: preset.sortOrder,
          },
        });
      } else {
        await tx.trainingSceneDescriptionPreset.update({
          where: { id: presetId },
          data: {
            categoryId,
            folderId,
            name: preset.title,
            sceneDescriptionText: preset.sceneDescriptionText,
            isActive: preset.isActive,
          },
        });
      }
    }
  });
}

async function listTrainingPresetRows() {
  await ensureDefaultTrainingPresets();
  return listTrainingPresetRowsFromRepository();
}

async function getTrainingPresetRow(presetId: string) {
  await ensureDefaultTrainingPresets();
  return getTrainingPresetRowFromRepository(presetId);
}

async function listTrainingSceneCategoryRows() {
  await ensureDefaultTrainingPresets();
  return listTrainingSceneCategoryRowsFromRepository();
}

async function getTrainingSceneCategoryRow(categoryId: string) {
  await ensureDefaultTrainingPresets();
  return getTrainingSceneCategoryRowFromRepository(categoryId);
}

async function listTrainingSceneFolderRows() {
  await ensureDefaultTrainingPresets();
  return listTrainingSceneFolderRowsFromRepository();
}

async function getTrainingSceneFolderRow(folderId: string) {
  await ensureDefaultTrainingPresets();
  return getTrainingSceneFolderRowFromRepository(folderId);
}

async function createUniqueCategorySlug(name: string) {
  const base = `training-${slugifyForTrainingRepository(name, "category")}`;
  let candidate = base;
  let suffix = 2;

  while (await prisma.trainingSceneDescriptionPresetCategory.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function createUniquePresetSlug(categoryId: string, title: string, excludePresetId?: string) {
  const base = slugifyForTrainingRepository(title, "training-preset");
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.trainingSceneDescriptionPreset.findUnique({
      where: {
        categoryId_slug: {
          categoryId,
          slug: candidate,
        },
      },
      select: { id: true },
    });
    if (!existing || existing.id === excludePresetId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function resolveTrainingPresetCategoryId(name: string) {
  const normalized = name.trim();
  const existing = await prisma.trainingSceneDescriptionPresetCategory.findFirst({
    where: {
      name: normalized,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const slug = await createUniqueCategorySlug(normalized);
  const maxOrder = await prisma.trainingSceneDescriptionPresetCategory.aggregate({
    _max: { sortOrder: true },
  });
  const created = await prisma.trainingSceneDescriptionPresetCategory.create({
    data: {
      name: normalized,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      sceneDescriptionOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  return created.id;
}

async function resolveTrainingPresetFolderId(categoryId: string, folderName: string) {
  const normalized = folderName.trim();
  if (!normalized || normalized === "未归档") return null;

  const existing = await prisma.trainingSceneDescriptionPresetFolder.findFirst({
    where: {
      categoryId,
      parentId: null,
      name: normalized,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const maxOrder = await prisma.trainingSceneDescriptionPresetFolder.aggregate({
    where: { categoryId, parentId: null },
    _max: { sortOrder: true },
  });
  const created = await prisma.trainingSceneDescriptionPresetFolder.create({
    data: {
      categoryId,
      parentId: null,
      name: normalized,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  return created.id;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) {
      throw error;
    }
  }
}

function revalidateTrainingPresetPaths(presetId?: string) {
  safeRevalidatePath("/training/presets");
  safeRevalidatePath("/training/presets/new");
  if (presetId) safeRevalidatePath(`/training/presets/${presetId}`);
}

export async function listTrainingSceneDescriptionPresets(): Promise<LoraTrainingPreset[]> {
  const rows = await listTrainingPresetRows();
  return rows
    .filter((row) => row.isActive || DEFAULT_TRAINING_PRESET_IDS.has(row.id))
    .map(mapTrainingPreset);
}

export async function getTrainingSceneDescriptionPreset(presetId: string) {
  const row = await getTrainingPresetRow(presetId);
  if (!row) {
    throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
  }
  return mapTrainingPreset(row);
}

export async function getTrainingSceneDescriptionPresetUsage(presetId: string) {
  const preset = await getTrainingSceneDescriptionPreset(presetId);
  return {
    presetId: preset.id,
    projectUsage: preset.projectUsage,
    templateUsage: preset.templateUsage,
  };
}

function buildTrainingSceneDescriptionTree(input: {
  categories: TrainingSceneDescriptionCategory[];
  folders: TrainingSceneDescriptionFolder[];
  presets: LoraTrainingPreset[];
}) {
  const categoryEntries = sortTrainingSceneCategories(input.categories).map((category) => ({
    ...category,
    folders: [] as Array<TrainingSceneDescriptionFolder & { presets: LoraTrainingPreset[] }>,
    presets: [] as LoraTrainingPreset[],
  }));
  const categoryById = new Map(categoryEntries.map((category) => [category.id, category]));
  const categoryByName = new Map(categoryEntries.map((category) => [category.name, category]));
  const foldersByIdentity = new Map<string, TrainingSceneDescriptionFolder & { presets: LoraTrainingPreset[] }>();

  for (const folder of sortTrainingSceneFolders(input.folders)) {
    const category = categoryById.get(folder.categoryId);
    if (!category) continue;
    const folderEntry = {
      ...folder,
      presets: [] as LoraTrainingPreset[],
    };
    category.folders.push(folderEntry);
    foldersByIdentity.set(`${folder.categoryId}:${folder.name}`, folderEntry);
  }

  for (const preset of input.presets) {
    const category = categoryByName.get(preset.category);
    if (!category) continue;
    if (preset.folder && preset.folder !== "未归档") {
      const folder = foldersByIdentity.get(`${category.id}:${preset.folder}`);
      if (folder) {
        folder.presets.push(preset);
        continue;
      }
    }
    category.presets.push(preset);
  }

  return { categories: categoryEntries };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listTrainingSceneDescriptionTree(options: { includeInactive?: boolean } = {}) {
  await ensureDefaultTrainingPresets();
  const [categories, folders, rows] = await Promise.all([
    listTrainingSceneCategoryRowsFromRepository(),
    listTrainingSceneFolderRowsFromRepository(),
    listTrainingPresetRowsFromRepository(),
  ]);
  const presets = rows
    .map(mapTrainingPreset)
    .filter((preset) => options.includeInactive ? true : preset.status === "active");
  return buildTrainingSceneDescriptionTree({
    categories: categories.map(mapTrainingSceneCategory),
    folders: folders.map(mapTrainingSceneFolder),
    presets,
  });
}

export async function createTrainingSceneDescriptionCategory(input: unknown) {
  const parsed = parseTrainingSceneCategoryCreateInput(input);
  try {
    const current = await prisma.trainingSceneDescriptionPresetCategory.findUnique({ where: { slug: parsed.slug }, select: { id: true } });
    if (current) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }

    const maxOrder = await prisma.trainingSceneDescriptionPresetCategory.aggregate({
      _max: { sortOrder: true },
    });
    const created = await prisma.trainingSceneDescriptionPresetCategory.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        icon: parsed.icon?.trim() || null,
        color: parsed.color?.trim() || null,
        sortOrder: parsed.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1),
        sceneDescriptionOrder: parsed.sceneDescriptionOrder ?? 0,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        sortOrder: true,
        sceneDescriptionOrder: true,
      },
    });
    revalidateTrainingPresetPaths();
    return mapTrainingSceneCategory(created);
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }
    throw error;
  }
}

export async function updateTrainingSceneDescriptionCategory(categoryId: string, input: unknown) {
  const parsed = parseTrainingSceneCategoryUpdateInput(input);
  try {
    const current = await getTrainingSceneCategoryRow(categoryId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId });
    }
    if (parsed.slug && parsed.slug !== current.slug) {
      const duplicate = await prisma.trainingSceneDescriptionPresetCategory.findUnique({ where: { slug: parsed.slug }, select: { id: true } });
      if (duplicate) {
        throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
      }
    }

    const updated = await prisma.trainingSceneDescriptionPresetCategory.update({
      where: { id: categoryId },
      data: {
        name: parsed.name ?? current.name,
        slug: parsed.slug ?? current.slug,
        icon: Object.prototype.hasOwnProperty.call(parsed, "icon") ? (parsed.icon?.trim() || null) : current.icon,
        color: Object.prototype.hasOwnProperty.call(parsed, "color") ? (parsed.color?.trim() || null) : current.color,
        sortOrder: parsed.sortOrder ?? current.sortOrder,
        sceneDescriptionOrder: parsed.sceneDescriptionOrder ?? current.sceneDescriptionOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        sortOrder: true,
        sceneDescriptionOrder: true,
      },
    });
    revalidateTrainingPresetPaths();
    return mapTrainingSceneCategory(updated);
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { categoryId });
    }
    throw error;
  }
}

export async function deleteTrainingSceneDescriptionCategory(categoryId: string) {
  const current = await getTrainingSceneCategoryRow(categoryId);
  if (!current) {
    throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId });
  }

  const [folderCount, activePresetCount] = await Promise.all([
    prisma.trainingSceneDescriptionPresetFolder.count({
      where: {
        categoryId,
      },
    }),
    prisma.trainingSceneDescriptionPreset.count({
      where: {
        categoryId,
        isActive: true,
      },
    }),
  ]);
  if (folderCount > 0 || activePresetCount > 0) {
    throw new TrainingPresetServiceError("Training preset category is not empty", 409, {
      categoryId,
      folderCount,
      activePresetCount,
    });
  }

  await prisma.$transaction([
    prisma.trainingSceneDescriptionPreset.deleteMany({
      where: {
        categoryId,
        isActive: false,
      },
    }),
    prisma.trainingSceneDescriptionPresetCategory.delete({ where: { id: categoryId } }),
  ]);
  revalidateTrainingPresetPaths();
  return { success: true };
}

export async function createTrainingSceneDescriptionFolder(input: unknown) {
  const parsed = parseTrainingSceneFolderCreateInput(input);
  const category = await getTrainingSceneCategoryRow(parsed.categoryId);
  if (!category) {
    throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId: parsed.categoryId });
  }
  if (parsed.parentId) {
    const parent = await getTrainingSceneFolderRow(parsed.parentId);
    if (!parent || parent.categoryId !== parsed.categoryId) {
      throw new TrainingPresetServiceError("Training preset folder parent not found", 404, {
        categoryId: parsed.categoryId,
        parentId: parsed.parentId,
      });
    }
  }

  const siblingMax = await prisma.trainingSceneDescriptionPresetFolder.aggregate({
    where: {
      categoryId: parsed.categoryId,
      parentId: parsed.parentId ?? null,
    },
    _max: { sortOrder: true },
  });
  const created = await prisma.trainingSceneDescriptionPresetFolder.create({
    data: {
      categoryId: parsed.categoryId,
      parentId: parsed.parentId ?? null,
      name: parsed.name,
      sortOrder: parsed.sortOrder ?? ((siblingMax._max.sortOrder ?? -1) + 1),
    },
    select: {
      id: true,
      categoryId: true,
      parentId: true,
      name: true,
      sortOrder: true,
    },
  });
  revalidateTrainingPresetPaths();
  return mapTrainingSceneFolder(created);
}

export async function updateTrainingSceneDescriptionFolder(folderId: string, input: unknown) {
  const parsed = parseTrainingSceneFolderUpdateInput(input);
  const current = await getTrainingSceneFolderRow(folderId);
  if (!current) {
    throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
  }

  const nextCategoryId = parsed.categoryId ?? current.categoryId;
  if (nextCategoryId !== current.categoryId) {
    const presetCount = await prisma.trainingSceneDescriptionPreset.count({
      where: {
        folderId,
      },
    });
    if (presetCount > 0) {
      throw new TrainingPresetServiceError("Training preset folder is not movable while it still contains presets", 409, { folderId });
    }
    const nextCategory = await getTrainingSceneCategoryRow(nextCategoryId);
    if (!nextCategory) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId: nextCategoryId });
    }
  }

  const nextParentId = Object.prototype.hasOwnProperty.call(parsed, "parentId") ? (parsed.parentId ?? null) : current.parentId;
  if (nextParentId === folderId) {
    throw new TrainingPresetServiceError("Training preset folder cannot be its own parent", 400, { folderId });
  }
  if (nextParentId) {
    const parent = await getTrainingSceneFolderRow(nextParentId);
    if (!parent || parent.categoryId !== nextCategoryId) {
      throw new TrainingPresetServiceError("Training preset folder parent not found", 404, {
        folderId,
        parentId: nextParentId,
      });
    }
  }

  const updated = await prisma.trainingSceneDescriptionPresetFolder.update({
    where: { id: folderId },
    data: {
      categoryId: nextCategoryId,
      parentId: nextParentId,
      name: parsed.name ?? current.name,
      sortOrder: parsed.sortOrder ?? current.sortOrder,
    },
    select: {
      id: true,
      categoryId: true,
      parentId: true,
      name: true,
      sortOrder: true,
    },
  });
  revalidateTrainingPresetPaths();
  return mapTrainingSceneFolder(updated);
}

export async function deleteTrainingSceneDescriptionFolder(folderId: string) {
  const current = await getTrainingSceneFolderRow(folderId);
  if (!current) {
    throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
  }

  const [childFolderCount, activePresetCount] = await Promise.all([
    prisma.trainingSceneDescriptionPresetFolder.count({ where: { parentId: folderId } }),
    prisma.trainingSceneDescriptionPreset.count({
      where: {
        folderId,
        isActive: true,
      },
    }),
  ]);
  if (childFolderCount > 0 || activePresetCount > 0) {
    throw new TrainingPresetServiceError("Training preset folder is not empty", 409, {
      folderId,
      childFolderCount,
      activePresetCount,
    });
  }

  await prisma.$transaction([
    prisma.trainingSceneDescriptionPreset.deleteMany({
      where: {
        folderId,
        isActive: false,
      },
    }),
    prisma.trainingSceneDescriptionPresetFolder.delete({ where: { id: folderId } }),
  ]);
  revalidateTrainingPresetPaths();
  return { success: true };
}

export async function createTrainingSceneDescriptionPreset(input: unknown) {
  const parsed = parseTrainingPresetInput(input);
  const categoryId = await resolveTrainingPresetCategoryId(parsed.category);
  const folderId = await resolveTrainingPresetFolderId(categoryId, parsed.folder);
  const slug = await createUniquePresetSlug(categoryId, parsed.title);
  const maxOrder = await prisma.trainingSceneDescriptionPreset.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const preset = await tx.trainingSceneDescriptionPreset.create({
      data: {
        categoryId,
        folderId,
        name: parsed.title,
        slug,
        sceneDescriptionText: parsed.sceneDescriptionText,
        isActive: true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });

    return preset.id;
  });

  revalidateTrainingPresetPaths(created);
  return getTrainingSceneDescriptionPreset(created);
}

export async function updateTrainingSceneDescriptionPreset(presetId: string, input: unknown) {
  const parsed = parseTrainingPresetInput(input);
  const current = await getTrainingPresetRow(presetId);
  if (!current) {
    throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
  }

  const categoryId = await resolveTrainingPresetCategoryId(parsed.category);
  const folderId = await resolveTrainingPresetFolderId(categoryId, parsed.folder);
  const slug = await createUniquePresetSlug(categoryId, parsed.title, presetId);

  await prisma.$transaction(async (tx) => {
    await tx.trainingSceneDescriptionPreset.update({
      where: { id: presetId },
      data: {
        categoryId,
        folderId,
        name: parsed.title,
        slug,
        sceneDescriptionText: parsed.sceneDescriptionText,
      },
    });
  });

  revalidateTrainingPresetPaths(presetId);
  return getTrainingSceneDescriptionPreset(presetId);
}

export async function deleteTrainingSceneDescriptionPreset(presetId: string) {
  const current = await getTrainingPresetRow(presetId);
  if (!current) {
    throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
  }

  await prisma.trainingSceneDescriptionPreset.update({
    where: { id: presetId },
    data: { isActive: false },
  });

  revalidateTrainingPresetPaths(presetId);
  return { success: true };
}

export async function cascadeDeleteTrainingSceneDescriptionPreset(
  presetId: string,
  input: { confirm?: boolean } = {},
) {
  if (input.confirm !== true) {
    throw new TrainingPresetServiceError("confirm must be true", 400, { presetId });
  }

  const usage = await getTrainingSceneDescriptionPresetUsage(presetId);
  const result = await deleteTrainingSceneDescriptionPreset(presetId);

  return {
    ...result,
    presetId,
    removedProjectUsage: usage.projectUsage.length,
    removedTemplateUsage: usage.templateUsage.length,
  };
}

export async function saveTrainingSceneDescriptionPresetSortRules(input: unknown) {
  const result = trainingPresetSortRulesSchema.safeParse(input);
  if (!result.success) {
    throw new TrainingPresetServiceError("Invalid training preset sort-rules request", 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { categoryOrder, presetOrder } = result.data;

  await ensureDefaultTrainingPresets();

  const categories = await prisma.trainingSceneDescriptionPresetCategory.findMany({
    select: { id: true, name: true },
  });
  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const missingCategories = categoryOrder.filter((name) => !categoryByName.has(name));
  if (missingCategories.length > 0) {
    throw new TrainingPresetServiceError("Training preset category not found", 404, { missingCategories });
  }

  const presets = await prisma.trainingSceneDescriptionPreset.findMany({
    select: {
      id: true,
      categoryId: true,
    },
  });
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));
  const missingPresetIds = presetOrder.filter((id) => !presetById.has(id));
  if (missingPresetIds.length > 0) {
    throw new TrainingPresetServiceError("Training preset not found", 404, { missingPresetIds });
  }

  const groupedPresetIds = new Map<string, string[]>();
  for (const presetId of presetOrder) {
    const preset = presetById.get(presetId)!;
    const group = groupedPresetIds.get(preset.categoryId) ?? [];
    group.push(presetId);
    groupedPresetIds.set(preset.categoryId, group);
  }

  await prisma.$transaction([
    ...categoryOrder.map((name, index) =>
      prisma.trainingSceneDescriptionPresetCategory.update({
        where: { id: categoryByName.get(name)!.id },
        data: { sortOrder: index },
      })),
    ...[...groupedPresetIds.entries()].flatMap(([, ids]) =>
      ids.map((presetId, index) =>
        prisma.trainingSceneDescriptionPreset.update({
          where: { id: presetId },
          data: { sortOrder: index },
        }),
      ),
    ),
  ]);

  revalidateTrainingPresetPaths();
  return {
    categoryOrder,
    presetOrder,
  };
}

export function mapTrainingPresetError(error: unknown) {
  if (error instanceof TrainingPresetServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training preset error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
