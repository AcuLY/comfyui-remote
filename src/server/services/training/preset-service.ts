import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
import { slugifyForRepository } from "@/server/services/training/legacy-compat-service";

const TRAINING_PRESET_CATEGORY_TYPE = "training_scene_description";
const TRAINING_PRESET_VARIANT_NAME = "场景描述";
const TRAINING_PRESET_VARIANT_SLUG = "scene-description";
const TRAINING_PRESET_FALLBACK_PATH = join(process.cwd(), "data", "training-scene-description-presets.json");
const TRAINING_PRESET_CATEGORY_FALLBACK_PATH = join(process.cwd(), "data", "training-scene-description-categories.json");
const TRAINING_PRESET_FOLDER_FALLBACK_PATH = join(process.cwd(), "data", "training-scene-description-folders.json");

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

type TrainingPresetRow = Prisma.PresetGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true; sortOrder: true; type: true } };
    folder: { select: { id: true; name: true; sortOrder: true } };
    variants: {
      where: { isActive: true };
      orderBy: { sortOrder: "asc" };
      select: { id: true; prompt: true; sortOrder: true };
    };
  };
}>;

type TrainingSceneCategoryRow = Prisma.PresetCategoryGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    icon: true;
    color: true;
    sortOrder: true;
    positivePromptOrder: true;
    type: true;
  };
}>;

type TrainingSceneFolderRow = Prisma.PresetFolderGetPayload<{
  select: {
    id: true;
    categoryId: true;
    parentId: true;
    name: true;
    sortOrder: true;
  };
}>;

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
  const fallback = DEFAULT_TRAINING_PRESETS.find((preset) => preset.id === presetId);
  return {
    projectUsage: fallback?.projectUsage ?? [],
    templateUsage: fallback?.templateUsage ?? [],
  };
}

function buildDefaultFallbackPreset(preset: TrainingPresetDefault): LoraTrainingPreset {
  return {
    id: preset.id,
    title: preset.title,
    category: preset.categoryName,
    folder: preset.folderName,
    status: preset.isActive ? "active" : "inactive",
    updatedAt: preset.updatedAt,
    sceneDescriptionText: preset.sceneDescriptionText,
    projectUsage: preset.projectUsage,
    templateUsage: preset.templateUsage,
  };
}

function normalizeBuiltInFallbackPreset(preset: LoraTrainingPreset): LoraTrainingPreset {
  const builtIn = DEFAULT_TRAINING_PRESETS.find((item) => item.id === preset.id);
  if (!builtIn) return preset;

  return {
    ...preset,
    title: builtIn.title,
    category: builtIn.categoryName,
    folder: builtIn.folderName,
    status: builtIn.isActive ? "active" : "inactive",
    updatedAt: builtIn.updatedAt,
    sceneDescriptionText: builtIn.sceneDescriptionText,
    projectUsage: [...builtIn.projectUsage],
    templateUsage: [...builtIn.templateUsage],
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

function buildDefaultFallbackSceneLibraryState() {
  const categories = new Map<string, TrainingSceneDescriptionCategory>();
  const folders = new Map<string, TrainingSceneDescriptionFolder>();

  for (const preset of DEFAULT_TRAINING_PRESETS) {
    const categoryId = `training-scene-category-${preset.categorySlug}`;
    if (!categories.has(categoryId)) {
      categories.set(categoryId, {
        id: categoryId,
        name: preset.categoryName,
        slug: preset.categorySlug,
        icon: null,
        color: null,
        sortOrder: preset.categorySortOrder,
        sceneDescriptionOrder: preset.categorySortOrder,
      });
    }

    if (!preset.folderName.trim() || preset.folderName === "未归档") continue;

    const folderSlug = slugifyForRepository(preset.folderName, "folder");
    const folderId = `training-scene-folder-${preset.categorySlug}-${folderSlug}`;
    if (!folders.has(folderId)) {
      folders.set(folderId, {
        id: folderId,
        categoryId,
        parentId: null,
        name: preset.folderName,
        sortOrder: preset.folderSortOrder,
      });
    }
  }

  return {
    categories: sortTrainingSceneCategories([...categories.values()]),
    folders: sortTrainingSceneFolders([...folders.values()]),
  };
}

function formatUpdatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapTrainingPreset(row: TrainingPresetRow): LoraTrainingPreset {
  const primaryVariant = row.variants[0];
  const usage = defaultUsageForPreset(row.id);
  return {
    id: row.id,
    title: row.name,
    category: row.category.name,
    folder: row.folder?.name ?? "未归档",
    status: row.isActive ? "active" : "inactive",
    updatedAt: formatUpdatedAt(row.updatedAt),
    sceneDescriptionText: primaryVariant?.prompt ?? row.notes ?? "",
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
    sceneDescriptionOrder: row.positivePromptOrder,
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

async function readFallbackTrainingPresets(): Promise<LoraTrainingPreset[]> {
  try {
    const raw = await readFile(TRAINING_PRESET_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as LoraTrainingPreset[]).map(normalizeBuiltInFallbackPreset);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaults = DEFAULT_TRAINING_PRESETS.map(buildDefaultFallbackPreset);
  await writeFallbackTrainingPresets(defaults);
  return defaults;
}

async function readFallbackTrainingCategories() {
  try {
    const raw = await readFile(TRAINING_PRESET_CATEGORY_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return sortTrainingSceneCategories(parsed as TrainingSceneDescriptionCategory[]);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaults = buildDefaultFallbackSceneLibraryState().categories;
  await writeFallbackTrainingCategories(defaults);
  return defaults;
}

async function readFallbackTrainingFolders() {
  try {
    const raw = await readFile(TRAINING_PRESET_FOLDER_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return sortTrainingSceneFolders(parsed as TrainingSceneDescriptionFolder[]);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaults = buildDefaultFallbackSceneLibraryState().folders;
  await writeFallbackTrainingFolders(defaults);
  return defaults;
}

async function writeFallbackTrainingPresets(presets: LoraTrainingPreset[]) {
  await mkdir(dirname(TRAINING_PRESET_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_PRESET_FALLBACK_PATH, `${JSON.stringify(presets, null, 2)}\n`, "utf8");
}

async function writeFallbackTrainingCategories(categories: TrainingSceneDescriptionCategory[]) {
  await mkdir(dirname(TRAINING_PRESET_CATEGORY_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_PRESET_CATEGORY_FALLBACK_PATH, `${JSON.stringify(sortTrainingSceneCategories(categories), null, 2)}\n`, "utf8");
}

async function writeFallbackTrainingFolders(folders: TrainingSceneDescriptionFolder[]) {
  await mkdir(dirname(TRAINING_PRESET_FOLDER_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_PRESET_FOLDER_FALLBACK_PATH, `${JSON.stringify(sortTrainingSceneFolders(folders), null, 2)}\n`, "utf8");
}

function nextFallbackUpdatedAt() {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function shouldUseTrainingPresetFileFallback(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Database .* does not exist|Can't reach database server|ECONNREFUSED|P1001|P1003/i.test(message);
}

function nextFallbackCategoryId(slug: string) {
  return `training-scene-category-${slug}`;
}

function nextFallbackFolderId(categoryId: string, name: string) {
  return `training-scene-folder-${categoryId}-${slugifyForRepository(name, "folder")}`;
}

function normalizeFallbackSceneLibraryState(input: {
  categories: TrainingSceneDescriptionCategory[];
  folders: TrainingSceneDescriptionFolder[];
  presets: LoraTrainingPreset[];
}): {
  categories: TrainingSceneDescriptionCategory[];
  folders: TrainingSceneDescriptionFolder[];
} {
  const nextCategories = [...input.categories];
  const nextFolders = [...input.folders];
  const categoryByName = new Map(nextCategories.map((category) => [category.name, category]));
  const categoryBySlug = new Map(nextCategories.map((category) => [category.slug, category]));

  for (const preset of input.presets) {
    let category = categoryByName.get(preset.category);
    if (!category) {
      const baseSlug = `training-${slugifyForRepository(preset.category, "category")}`;
      let slug = baseSlug;
      let suffix = 2;
      while (categoryBySlug.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      category = {
        id: nextFallbackCategoryId(slug),
        name: preset.category,
        slug,
        icon: null,
        color: null,
        sortOrder: nextCategories.length,
        sceneDescriptionOrder: nextCategories.length,
      };
      nextCategories.push(category);
      categoryByName.set(category.name, category);
      categoryBySlug.set(category.slug, category);
    }

    if (!preset.folder.trim() || preset.folder === "未归档") continue;

    const folderExists = nextFolders.some((folder) =>
      folder.categoryId === category.id
      && folder.parentId === null
      && folder.name === preset.folder,
    );
    if (folderExists) continue;

    const siblingSortOrder = nextFolders
      .filter((folder) => folder.categoryId === category.id && folder.parentId === null)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.sortOrder), -1) + 1;
    nextFolders.push({
      id: nextFallbackFolderId(category.id, preset.folder),
      categoryId: category.id,
      parentId: null,
      name: preset.folder,
      sortOrder: siblingSortOrder,
    });
  }

  return {
    categories: sortTrainingSceneCategories(nextCategories),
    folders: sortTrainingSceneFolders(nextFolders),
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

async function ensureDefaultTrainingPresets() {
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map<string, string>();
    const folderIds = new Map<string, string>();

    for (const preset of DEFAULT_TRAINING_PRESETS) {
      let categoryId = categoryIds.get(preset.categorySlug);
      if (!categoryId) {
        const existingCategory = await tx.presetCategory.findUnique({
          where: { slug: preset.categorySlug },
          select: { id: true },
        });
        if (existingCategory) {
          categoryId = existingCategory.id;
          await tx.presetCategory.update({
            where: { id: categoryId },
            data: {
              name: preset.categoryName,
              sortOrder: preset.categorySortOrder,
              type: TRAINING_PRESET_CATEGORY_TYPE,
            },
          });
        } else {
          const createdCategory = await tx.presetCategory.create({
            data: {
              id: `training-category-${preset.categorySlug}`,
              name: preset.categoryName,
              slug: preset.categorySlug,
              type: TRAINING_PRESET_CATEGORY_TYPE,
              sortOrder: preset.categorySortOrder,
            },
            select: { id: true },
          });
          categoryId = createdCategory.id;
        }
        categoryIds.set(preset.categorySlug, categoryId);
      }

      const folderKey = `${categoryId}:${preset.folderName}`;
      let folderId = folderIds.get(folderKey);
      if (!folderId) {
        const existingFolder = await tx.presetFolder.findFirst({
          where: {
            categoryId,
            parentId: null,
            name: preset.folderName,
          },
          select: { id: true },
        });
        if (existingFolder) {
          folderId = existingFolder.id;
          await tx.presetFolder.update({
            where: { id: folderId },
            data: { sortOrder: preset.folderSortOrder },
          });
        } else {
          const createdFolder = await tx.presetFolder.create({
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

      const existingPreset = await tx.preset.findUnique({
        where: { id: preset.id },
        select: { id: true },
      });

      if (!existingPreset) {
        await tx.preset.create({
          data: {
            id: preset.id,
            categoryId,
            folderId,
            name: preset.title,
            slug: preset.id,
            isActive: preset.isActive,
            sortOrder: preset.sortOrder,
          },
        });
      }

      const existingVariant = await tx.presetVariant.findFirst({
        where: { presetId: preset.id },
        select: { id: true },
      });

      if (!existingVariant) {
        await tx.presetVariant.create({
          data: {
            id: `${preset.id}-scene`,
            presetId: preset.id,
            name: TRAINING_PRESET_VARIANT_NAME,
            slug: TRAINING_PRESET_VARIANT_SLUG,
            prompt: preset.sceneDescriptionText,
            negativePrompt: null,
            lora1: Prisma.DbNull,
            lora2: Prisma.DbNull,
            sortOrder: 0,
            isActive: true,
          },
        });
      }
    }
  });
}

async function listTrainingPresetRows() {
  await ensureDefaultTrainingPresets();
  return prisma.preset.findMany({
    where: {
      category: {
        type: TRAINING_PRESET_CATEGORY_TYPE,
      },
    },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          type: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          prompt: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function getTrainingPresetRow(presetId: string) {
  await ensureDefaultTrainingPresets();
  return prisma.preset.findFirst({
    where: {
      id: presetId,
      category: {
        type: TRAINING_PRESET_CATEGORY_TYPE,
      },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          type: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          prompt: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function listTrainingSceneCategoryRows() {
  await ensureDefaultTrainingPresets();
  return prisma.presetCategory.findMany({
    where: { type: TRAINING_PRESET_CATEGORY_TYPE },
    orderBy: [
      { sortOrder: "asc" },
      { positivePromptOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      color: true,
      sortOrder: true,
      positivePromptOrder: true,
      type: true,
    },
  });
}

async function getTrainingSceneCategoryRow(categoryId: string) {
  await ensureDefaultTrainingPresets();
  return prisma.presetCategory.findFirst({
    where: {
      id: categoryId,
      type: TRAINING_PRESET_CATEGORY_TYPE,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      color: true,
      sortOrder: true,
      positivePromptOrder: true,
      type: true,
    },
  });
}

async function listTrainingSceneFolderRows() {
  await ensureDefaultTrainingPresets();
  return prisma.presetFolder.findMany({
    where: {
      category: {
        type: TRAINING_PRESET_CATEGORY_TYPE,
      },
    },
    orderBy: [
      { categoryId: "asc" },
      { parentId: "asc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      categoryId: true,
      parentId: true,
      name: true,
      sortOrder: true,
    },
  });
}

async function getTrainingSceneFolderRow(folderId: string) {
  await ensureDefaultTrainingPresets();
  return prisma.presetFolder.findFirst({
    where: {
      id: folderId,
      category: {
        type: TRAINING_PRESET_CATEGORY_TYPE,
      },
    },
    select: {
      id: true,
      categoryId: true,
      parentId: true,
      name: true,
      sortOrder: true,
    },
  });
}

async function createUniqueCategorySlug(name: string) {
  const base = `training-${slugifyForRepository(name, "category")}`;
  let candidate = base;
  let suffix = 2;

  while (await prisma.presetCategory.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function createUniquePresetSlug(categoryId: string, title: string, excludePresetId?: string) {
  const base = slugifyForRepository(title, "training-preset");
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.preset.findUnique({
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
  const existing = await prisma.presetCategory.findFirst({
    where: {
      type: TRAINING_PRESET_CATEGORY_TYPE,
      name: normalized,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const slug = await createUniqueCategorySlug(normalized);
  const maxOrder = await prisma.presetCategory.aggregate({
    where: { type: TRAINING_PRESET_CATEGORY_TYPE },
    _max: { sortOrder: true },
  });
  const created = await prisma.presetCategory.create({
    data: {
      name: normalized,
      slug,
      type: TRAINING_PRESET_CATEGORY_TYPE,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  return created.id;
}

async function resolveTrainingPresetFolderId(categoryId: string, folderName: string) {
  const normalized = folderName.trim();
  if (!normalized || normalized === "未归档") return null;

  const existing = await prisma.presetFolder.findFirst({
    where: {
      categoryId,
      parentId: null,
      name: normalized,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const maxOrder = await prisma.presetFolder.aggregate({
    where: { categoryId, parentId: null },
    _max: { sortOrder: true },
  });
  const created = await prisma.presetFolder.create({
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
  try {
    const rows = await listTrainingPresetRows();
    return rows.map(mapTrainingPreset);
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    return readFallbackTrainingPresets();
  }
}

export async function getTrainingSceneDescriptionPreset(presetId: string) {
  try {
    const row = await getTrainingPresetRow(presetId);
    if (!row) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }
    return mapTrainingPreset(row);
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const presets = await readFallbackTrainingPresets();
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }
    return preset;
  }
}

export async function getTrainingSceneDescriptionPresetUsage(presetId: string) {
  const preset = await getTrainingSceneDescriptionPreset(presetId);
  return {
    presetId: preset.id,
    projectUsage: preset.projectUsage,
    templateUsage: preset.templateUsage,
  };
}

async function writeFallbackTrainingSceneLibraryState(input: {
  categories: TrainingSceneDescriptionCategory[];
  folders: TrainingSceneDescriptionFolder[];
}) {
  await Promise.all([
    writeFallbackTrainingCategories(input.categories),
    writeFallbackTrainingFolders(input.folders),
  ]);
}

async function readFallbackTrainingSceneLibraryState() {
  const [categories, folders, presets] = await Promise.all([
    readFallbackTrainingCategories(),
    readFallbackTrainingFolders(),
    readFallbackTrainingPresets(),
  ]);
  return {
    ...normalizeFallbackSceneLibraryState({ categories, folders, presets }),
    presets,
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

function nextTrainingSceneCategorySortOrder(categories: TrainingSceneDescriptionCategory[]) {
  return categories.reduce((maxOrder, category) => Math.max(maxOrder, category.sortOrder), -1) + 1;
}

function nextTrainingSceneFolderSortOrder(folders: TrainingSceneDescriptionFolder[], categoryId: string, parentId: string | null) {
  return folders
    .filter((folder) => folder.categoryId === categoryId && folder.parentId === parentId)
    .reduce((maxOrder, folder) => Math.max(maxOrder, folder.sortOrder), -1) + 1;
}

export async function listTrainingSceneDescriptionTree(options: { includeInactive?: boolean } = {}) {
  try {
    const [categories, folders, rows] = await Promise.all([
      listTrainingSceneCategoryRows(),
      listTrainingSceneFolderRows(),
      listTrainingPresetRows(),
    ]);
    const presets = rows
      .map(mapTrainingPreset)
      .filter((preset) => options.includeInactive ? true : preset.status === "active");
    return buildTrainingSceneDescriptionTree({
      categories: categories.map(mapTrainingSceneCategory),
      folders: folders.map(mapTrainingSceneFolder),
      presets,
    });
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const snapshot = await readFallbackTrainingSceneLibraryState();
    const presets = snapshot.presets.filter((preset) => options.includeInactive ? true : preset.status === "active");
    return buildTrainingSceneDescriptionTree({
      categories: snapshot.categories,
      folders: snapshot.folders,
      presets,
    });
  }
}

export async function createTrainingSceneDescriptionCategory(input: unknown) {
  const parsed = parseTrainingSceneCategoryCreateInput(input);
  try {
    const current = await prisma.presetCategory.findUnique({ where: { slug: parsed.slug }, select: { id: true } });
    if (current) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }

    const maxOrder = await prisma.presetCategory.aggregate({
      where: { type: TRAINING_PRESET_CATEGORY_TYPE },
      _max: { sortOrder: true },
    });
    const created = await prisma.presetCategory.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        icon: parsed.icon?.trim() || null,
        color: parsed.color?.trim() || null,
        sortOrder: parsed.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1),
        positivePromptOrder: parsed.sceneDescriptionOrder ?? 0,
        type: TRAINING_PRESET_CATEGORY_TYPE,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        sortOrder: true,
        positivePromptOrder: true,
        type: true,
      },
    });
    revalidateTrainingPresetPaths();
    return mapTrainingSceneCategory(created);
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    if (snapshot.categories.some((category) => category.slug === parsed.slug)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }
    const created: TrainingSceneDescriptionCategory = {
      id: nextFallbackCategoryId(parsed.slug),
      name: parsed.name,
      slug: parsed.slug,
      icon: parsed.icon?.trim() || null,
      color: parsed.color?.trim() || null,
      sortOrder: parsed.sortOrder ?? nextTrainingSceneCategorySortOrder(snapshot.categories),
      sceneDescriptionOrder: parsed.sceneDescriptionOrder ?? 0,
    };
    await writeFallbackTrainingSceneLibraryState({
      categories: [...snapshot.categories, created],
      folders: snapshot.folders,
    });
    revalidateTrainingPresetPaths();
    return created;
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
      const duplicate = await prisma.presetCategory.findUnique({ where: { slug: parsed.slug }, select: { id: true } });
      if (duplicate) {
        throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
      }
    }

    const updated = await prisma.presetCategory.update({
      where: { id: categoryId },
      data: {
        name: parsed.name ?? current.name,
        slug: parsed.slug ?? current.slug,
        icon: Object.prototype.hasOwnProperty.call(parsed, "icon") ? (parsed.icon?.trim() || null) : current.icon,
        color: Object.prototype.hasOwnProperty.call(parsed, "color") ? (parsed.color?.trim() || null) : current.color,
        sortOrder: parsed.sortOrder ?? current.sortOrder,
        positivePromptOrder: parsed.sceneDescriptionOrder ?? current.positivePromptOrder,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        sortOrder: true,
        positivePromptOrder: true,
        type: true,
      },
    });
    revalidateTrainingPresetPaths();
    return mapTrainingSceneCategory(updated);
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { categoryId });
    }
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    const categoryIndex = snapshot.categories.findIndex((category) => category.id === categoryId);
    if (categoryIndex === -1) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId });
    }
    const current = snapshot.categories[categoryIndex];
    if (parsed.slug && parsed.slug !== current.slug && snapshot.categories.some((category) => category.slug === parsed.slug)) {
      throw new TrainingPresetServiceError("Training preset category slug already exists", 409, { slug: parsed.slug });
    }
    const nextCategory: TrainingSceneDescriptionCategory = {
      ...current,
      name: parsed.name ?? current.name,
      slug: parsed.slug ?? current.slug,
      icon: Object.prototype.hasOwnProperty.call(parsed, "icon") ? (parsed.icon?.trim() || null) : current.icon,
      color: Object.prototype.hasOwnProperty.call(parsed, "color") ? (parsed.color?.trim() || null) : current.color,
      sortOrder: parsed.sortOrder ?? current.sortOrder,
      sceneDescriptionOrder: parsed.sceneDescriptionOrder ?? current.sceneDescriptionOrder,
    };
    const nextCategories = [...snapshot.categories];
    nextCategories[categoryIndex] = nextCategory;
    const nextPresets = snapshot.presets.map((preset) => preset.category === current.name
      ? { ...preset, category: nextCategory.name }
      : preset);
    await Promise.all([
      writeFallbackTrainingPresets(nextPresets),
      writeFallbackTrainingSceneLibraryState({
        categories: nextCategories,
        folders: snapshot.folders,
      }),
    ]);
    revalidateTrainingPresetPaths();
    return nextCategory;
  }
}

export async function deleteTrainingSceneDescriptionCategory(categoryId: string) {
  try {
    const current = await getTrainingSceneCategoryRow(categoryId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId });
    }

    const [folderCount, activePresetCount] = await Promise.all([
      prisma.presetFolder.count({
        where: {
          categoryId,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
        },
      }),
      prisma.preset.count({
        where: {
          categoryId,
          isActive: true,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
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
      prisma.preset.deleteMany({
        where: {
          categoryId,
          isActive: false,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
        },
      }),
      prisma.presetCategory.delete({ where: { id: categoryId } }),
    ]);
    revalidateTrainingPresetPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    const category = snapshot.categories.find((item) => item.id === categoryId);
    if (!category) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId });
    }
    const folderCount = snapshot.folders.filter((folder) => folder.categoryId === categoryId).length;
    const activePresetCount = snapshot.presets.filter((preset) => preset.category === category.name && preset.status === "active").length;
    if (folderCount > 0 || activePresetCount > 0) {
      throw new TrainingPresetServiceError("Training preset category is not empty", 409, {
        categoryId,
        folderCount,
        activePresetCount,
      });
    }
    const nextPresets = snapshot.presets.filter((preset) => !(preset.category === category.name && preset.status !== "active"));
    await Promise.all([
      writeFallbackTrainingPresets(nextPresets),
      writeFallbackTrainingSceneLibraryState({
        categories: snapshot.categories.filter((item) => item.id !== categoryId),
        folders: snapshot.folders,
      }),
    ]);
    revalidateTrainingPresetPaths();
    return { success: true };
  }
}

export async function createTrainingSceneDescriptionFolder(input: unknown) {
  const parsed = parseTrainingSceneFolderCreateInput(input);
  try {
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

    const siblingMax = await prisma.presetFolder.aggregate({
      where: {
        categoryId: parsed.categoryId,
        parentId: parsed.parentId ?? null,
      },
      _max: { sortOrder: true },
    });
    const created = await prisma.presetFolder.create({
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
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    const category = snapshot.categories.find((item) => item.id === parsed.categoryId);
    if (!category) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId: parsed.categoryId });
    }
    if (parsed.parentId) {
      const parent = snapshot.folders.find((folder) => folder.id === parsed.parentId);
      if (!parent || parent.categoryId !== parsed.categoryId) {
        throw new TrainingPresetServiceError("Training preset folder parent not found", 404, {
          categoryId: parsed.categoryId,
          parentId: parsed.parentId,
        });
      }
    }
    const created: TrainingSceneDescriptionFolder = {
      id: nextFallbackFolderId(parsed.categoryId, `${parsed.name}-${Date.now()}`),
      categoryId: parsed.categoryId,
      parentId: parsed.parentId ?? null,
      name: parsed.name,
      sortOrder: parsed.sortOrder ?? nextTrainingSceneFolderSortOrder(snapshot.folders, parsed.categoryId, parsed.parentId ?? null),
    };
    await writeFallbackTrainingSceneLibraryState({
      categories: snapshot.categories,
      folders: [...snapshot.folders, created],
    });
    revalidateTrainingPresetPaths();
    return created;
  }
}

export async function updateTrainingSceneDescriptionFolder(folderId: string, input: unknown) {
  const parsed = parseTrainingSceneFolderUpdateInput(input);
  try {
    const current = await getTrainingSceneFolderRow(folderId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
    }

    const nextCategoryId = parsed.categoryId ?? current.categoryId;
    if (nextCategoryId !== current.categoryId) {
      const presetCount = await prisma.preset.count({
        where: {
          folderId,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
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

    const updated = await prisma.presetFolder.update({
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
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    const folderIndex = snapshot.folders.findIndex((folder) => folder.id === folderId);
    if (folderIndex === -1) {
      throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
    }
    const current = snapshot.folders[folderIndex];
    const nextCategoryId = parsed.categoryId ?? current.categoryId;
    if (nextCategoryId !== current.categoryId && snapshot.presets.some((preset) => preset.folder === current.name && preset.category === snapshot.categories.find((category) => category.id === current.categoryId)?.name)) {
      throw new TrainingPresetServiceError("Training preset folder is not movable while it still contains presets", 409, { folderId });
    }
    if (!snapshot.categories.some((category) => category.id === nextCategoryId)) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { categoryId: nextCategoryId });
    }
    const nextParentId = Object.prototype.hasOwnProperty.call(parsed, "parentId") ? (parsed.parentId ?? null) : current.parentId;
    if (nextParentId === folderId) {
      throw new TrainingPresetServiceError("Training preset folder cannot be its own parent", 400, { folderId });
    }
    if (nextParentId) {
      const parent = snapshot.folders.find((folder) => folder.id === nextParentId);
      if (!parent || parent.categoryId !== nextCategoryId) {
        throw new TrainingPresetServiceError("Training preset folder parent not found", 404, {
          folderId,
          parentId: nextParentId,
        });
      }
    }

    const updated: TrainingSceneDescriptionFolder = {
      ...current,
      categoryId: nextCategoryId,
      parentId: nextParentId,
      name: parsed.name ?? current.name,
      sortOrder: parsed.sortOrder ?? current.sortOrder,
    };
    const nextFolders = [...snapshot.folders];
    nextFolders[folderIndex] = updated;
    const categoryNameById = new Map(snapshot.categories.map((category) => [category.id, category.name]));
    const nextPresets = snapshot.presets.map((preset) => (
      preset.folder === current.name && preset.category === categoryNameById.get(current.categoryId)
        ? {
          ...preset,
          category: categoryNameById.get(updated.categoryId) ?? preset.category,
          folder: updated.name,
        }
        : preset
    ));
    await Promise.all([
      writeFallbackTrainingPresets(nextPresets),
      writeFallbackTrainingSceneLibraryState({
        categories: snapshot.categories,
        folders: nextFolders,
      }),
    ]);
    revalidateTrainingPresetPaths();
    return updated;
  }
}

export async function deleteTrainingSceneDescriptionFolder(folderId: string) {
  try {
    const current = await getTrainingSceneFolderRow(folderId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
    }

    const [childFolderCount, activePresetCount] = await Promise.all([
      prisma.presetFolder.count({ where: { parentId: folderId } }),
      prisma.preset.count({
        where: {
          folderId,
          isActive: true,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
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
      prisma.preset.deleteMany({
        where: {
          folderId,
          isActive: false,
          category: { type: TRAINING_PRESET_CATEGORY_TYPE },
        },
      }),
      prisma.presetFolder.delete({ where: { id: folderId } }),
    ]);
    revalidateTrainingPresetPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof TrainingPresetServiceError) throw error;
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;

    const snapshot = await readFallbackTrainingSceneLibraryState();
    const folder = snapshot.folders.find((item) => item.id === folderId);
    if (!folder) {
      throw new TrainingPresetServiceError("Training preset folder not found", 404, { folderId });
    }
    const categoryName = snapshot.categories.find((category) => category.id === folder.categoryId)?.name;
    const childFolderCount = snapshot.folders.filter((item) => item.parentId === folderId).length;
    const activePresetCount = snapshot.presets.filter((preset) =>
      preset.folder === folder.name
      && preset.category === categoryName
      && preset.status === "active",
    ).length;
    if (childFolderCount > 0 || activePresetCount > 0) {
      throw new TrainingPresetServiceError("Training preset folder is not empty", 409, {
        folderId,
        childFolderCount,
        activePresetCount,
      });
    }

    const nextPresets = snapshot.presets.filter((preset) =>
      !(preset.folder === folder.name && preset.category === categoryName && preset.status !== "active"),
    );
    await Promise.all([
      writeFallbackTrainingPresets(nextPresets),
      writeFallbackTrainingSceneLibraryState({
        categories: snapshot.categories,
        folders: snapshot.folders.filter((item) => item.id !== folderId),
      }),
    ]);
    revalidateTrainingPresetPaths();
    return { success: true };
  }
}

export async function createTrainingSceneDescriptionPreset(input: unknown) {
  const parsed = parseTrainingPresetInput(input);
  try {
    const categoryId = await resolveTrainingPresetCategoryId(parsed.category);
    const folderId = await resolveTrainingPresetFolderId(categoryId, parsed.folder);
    const slug = await createUniquePresetSlug(categoryId, parsed.title);
    const maxOrder = await prisma.preset.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const preset = await tx.preset.create({
        data: {
          categoryId,
          folderId,
          name: parsed.title,
          slug,
          isActive: true,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });

      await tx.presetVariant.create({
        data: {
          presetId: preset.id,
          name: TRAINING_PRESET_VARIANT_NAME,
          slug: TRAINING_PRESET_VARIANT_SLUG,
          prompt: parsed.sceneDescriptionText,
          negativePrompt: null,
          lora1: Prisma.DbNull,
          lora2: Prisma.DbNull,
          sortOrder: 0,
          isActive: true,
        },
      });

      return preset.id;
    });

    revalidateTrainingPresetPaths(created);
    return getTrainingSceneDescriptionPreset(created);
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const snapshot = await readFallbackTrainingSceneLibraryState();
    const presets = snapshot.presets;
    const nextId = `training-preset-${Date.now()}`;
    const created: LoraTrainingPreset = {
      id: nextId,
      title: parsed.title,
      category: parsed.category,
      folder: parsed.folder.trim() || "未归档",
      status: "active",
      updatedAt: nextFallbackUpdatedAt(),
      sceneDescriptionText: parsed.sceneDescriptionText,
      projectUsage: [],
      templateUsage: [],
    };
    const nextPresets = [...presets, created];
    const normalized = normalizeFallbackSceneLibraryState({
      categories: snapshot.categories,
      folders: snapshot.folders,
      presets: nextPresets,
    });
    await Promise.all([
      writeFallbackTrainingPresets(nextPresets),
      writeFallbackTrainingSceneLibraryState(normalized),
    ]);
    revalidateTrainingPresetPaths(nextId);
    return created;
  }
}

export async function updateTrainingSceneDescriptionPreset(presetId: string, input: unknown) {
  const parsed = parseTrainingPresetInput(input);
  try {
    const current = await getTrainingPresetRow(presetId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }

    const categoryId = await resolveTrainingPresetCategoryId(parsed.category);
    const folderId = await resolveTrainingPresetFolderId(categoryId, parsed.folder);
    const slug = await createUniquePresetSlug(categoryId, parsed.title, presetId);

    await prisma.$transaction(async (tx) => {
      await tx.preset.update({
        where: { id: presetId },
        data: {
          categoryId,
          folderId,
          name: parsed.title,
          slug,
        },
      });

      const firstVariant = await tx.presetVariant.findFirst({
        where: {
          presetId,
          isActive: true,
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      if (firstVariant) {
        await tx.presetVariant.update({
          where: { id: firstVariant.id },
          data: { prompt: parsed.sceneDescriptionText },
        });
      } else {
        await tx.presetVariant.create({
          data: {
            presetId,
            name: TRAINING_PRESET_VARIANT_NAME,
            slug: TRAINING_PRESET_VARIANT_SLUG,
            prompt: parsed.sceneDescriptionText,
            negativePrompt: null,
            lora1: Prisma.DbNull,
            lora2: Prisma.DbNull,
            sortOrder: 0,
            isActive: true,
          },
        });
      }
    });

    revalidateTrainingPresetPaths(presetId);
    return getTrainingSceneDescriptionPreset(presetId);
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const snapshot = await readFallbackTrainingSceneLibraryState();
    const presets = snapshot.presets;
    const existingIndex = presets.findIndex((preset) => preset.id === presetId);
    if (existingIndex === -1) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }
    const updated: LoraTrainingPreset = {
      ...presets[existingIndex],
      title: parsed.title,
      category: parsed.category,
      folder: parsed.folder.trim() || "未归档",
      sceneDescriptionText: parsed.sceneDescriptionText,
      updatedAt: nextFallbackUpdatedAt(),
    };
    const next = [...presets];
    next[existingIndex] = updated;
    const normalized = normalizeFallbackSceneLibraryState({
      categories: snapshot.categories,
      folders: snapshot.folders,
      presets: next,
    });
    await Promise.all([
      writeFallbackTrainingPresets(next),
      writeFallbackTrainingSceneLibraryState(normalized),
    ]);
    revalidateTrainingPresetPaths(presetId);
    return updated;
  }
}

export async function deleteTrainingSceneDescriptionPreset(presetId: string) {
  try {
    const current = await getTrainingPresetRow(presetId);
    if (!current) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }

    await prisma.preset.update({
      where: { id: presetId },
      data: { isActive: false },
    });

    revalidateTrainingPresetPaths(presetId);
    return { success: true };
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const snapshot = await readFallbackTrainingSceneLibraryState();
    const presets = snapshot.presets;
    const existingIndex = presets.findIndex((preset) => preset.id === presetId);
    if (existingIndex === -1) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { presetId });
    }
    const next = [...presets];
    next[existingIndex] = {
      ...next[existingIndex],
      status: "inactive",
      updatedAt: nextFallbackUpdatedAt(),
    };
    const normalized = normalizeFallbackSceneLibraryState({
      categories: snapshot.categories,
      folders: snapshot.folders,
      presets: next,
    });
    await Promise.all([
      writeFallbackTrainingPresets(next),
      writeFallbackTrainingSceneLibraryState(normalized),
    ]);
    revalidateTrainingPresetPaths(presetId);
    return { success: true };
  }
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

  try {
    const categories = await prisma.presetCategory.findMany({
      where: { type: TRAINING_PRESET_CATEGORY_TYPE },
      select: { id: true, name: true },
    });
    const categoryByName = new Map(categories.map((category) => [category.name, category]));
    const missingCategories = categoryOrder.filter((name) => !categoryByName.has(name));
    if (missingCategories.length > 0) {
      throw new TrainingPresetServiceError("Training preset category not found", 404, { missingCategories });
    }

    const presets = await prisma.preset.findMany({
      where: {
        category: { type: TRAINING_PRESET_CATEGORY_TYPE },
      },
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
        prisma.presetCategory.update({
          where: { id: categoryByName.get(name)!.id },
          data: { sortOrder: index },
        })),
      ...[...groupedPresetIds.entries()].flatMap(([, ids]) =>
        ids.map((presetId, index) =>
          prisma.preset.update({
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
  } catch (error) {
    if (!shouldUseTrainingPresetFileFallback(error)) throw error;
    const presets = await readFallbackTrainingPresets();
    const presetById = new Map(presets.map((preset) => [preset.id, preset]));
    const missingPresetIds = presetOrder.filter((id) => !presetById.has(id));
    if (missingPresetIds.length > 0) {
      throw new TrainingPresetServiceError("Training preset not found", 404, { missingPresetIds });
    }

    const categoryBuckets = new Map<string, LoraTrainingPreset[]>();
    for (const preset of presets) {
      const bucket = categoryBuckets.get(preset.category) ?? [];
      bucket.push(preset);
      categoryBuckets.set(preset.category, bucket);
    }

    const orderedByCategory = categoryOrder.flatMap((categoryName) => {
      const bucket = categoryBuckets.get(categoryName) ?? [];
      const orderIndex = new Map(presetOrder.map((id, index) => [id, index]));
      return [...bucket].sort((left, right) => {
        const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
    });

    const untouchedCategories = presets
      .filter((preset) => !categoryOrder.includes(preset.category))
      .sort((left, right) => left.category.localeCompare(right.category));

    await writeFallbackTrainingPresets([...orderedByCategory, ...untouchedCategories]);
    revalidateTrainingPresetPaths();
    return {
      categoryOrder,
      presetOrder,
    };
  }
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
