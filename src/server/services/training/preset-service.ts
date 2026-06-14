import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import type { LoraTrainingPreset } from "@/app/design-demos/data/lora-training-types";
import { prisma } from "@/lib/prisma";
import { slugifyForRepository } from "@/server/repositories/character-lora-training/helpers";
import { z } from "zod";

const TRAINING_PRESET_CATEGORY_TYPE = "training_scene_description";
const TRAINING_PRESET_VARIANT_NAME = "场景描述";
const TRAINING_PRESET_VARIANT_SLUG = "scene-description";
const TRAINING_PRESET_FALLBACK_PATH = join(process.cwd(), "data", "training-scene-description-presets.json");

const trainingPresetInputSchema = z.object({
  category: z.string().trim().min(1).max(80),
  folder: z.string().trim().max(80).optional().default(""),
  sceneDescriptionText: z.string().trim().min(1).max(20_000),
  title: z.string().trim().min(1).max(160),
});

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
    projectUsage: ["Vela Neon Jacket / 舞台灯光"],
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
    projectUsage: ["Vela Neon Jacket / 街角夜景", "Noir Runner / 雨夜背光"],
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
    projectUsage: ["Vela Neon Jacket / 白底棚拍"],
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

async function readFallbackTrainingPresets() {
  try {
    const raw = await readFile(TRAINING_PRESET_FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as LoraTrainingPreset[];
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

async function writeFallbackTrainingPresets(presets: LoraTrainingPreset[]) {
  await mkdir(dirname(TRAINING_PRESET_FALLBACK_PATH), { recursive: true });
  await writeFile(TRAINING_PRESET_FALLBACK_PATH, `${JSON.stringify(presets, null, 2)}\n`, "utf8");
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

export async function listTrainingSceneDescriptionPresets() {
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

export async function listTrainingSceneDescriptionTree() {
  const presets = await listTrainingSceneDescriptionPresets();
  const categoryMap = new Map<string, {
    id: string;
    name: string;
    folders: Array<{ id: string; name: string; presets: LoraTrainingPreset[] }>;
    presets: LoraTrainingPreset[];
  }>();

  for (const preset of presets) {
    const categoryEntry = categoryMap.get(preset.category) ?? {
      id: `training-scene-category-${preset.category}`,
      name: preset.category,
      folders: [],
      presets: [],
    };

    if (preset.folder && preset.folder !== "未归档") {
      let folderEntry = categoryEntry.folders.find((folder) => folder.name === preset.folder);
      if (!folderEntry) {
        folderEntry = {
          id: `training-scene-folder-${preset.category}-${preset.folder}`,
          name: preset.folder,
          presets: [],
        };
        categoryEntry.folders.push(folderEntry);
      }
      folderEntry.presets.push(preset);
    } else {
      categoryEntry.presets.push(preset);
    }

    categoryMap.set(preset.category, categoryEntry);
  }

  return {
    categories: [...categoryMap.values()],
  };
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
    const presets = await readFallbackTrainingPresets();
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
    await writeFallbackTrainingPresets([...presets, created]);
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
    const presets = await readFallbackTrainingPresets();
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
    await writeFallbackTrainingPresets(next);
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
    const presets = await readFallbackTrainingPresets();
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
    await writeFallbackTrainingPresets(next);
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
  const schema = z.object({
    categoryOrder: z.array(z.string().trim().min(1)).min(1),
    presetOrder: z.array(z.string().trim().min(1)).min(1),
  });
  const result = schema.safeParse(input);
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
