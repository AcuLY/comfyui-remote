import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export const TRAINING_PRESET_CATEGORY_TYPE = "training_scene_description";

export type TrainingPresetRow = Prisma.PresetGetPayload<{
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

export type TrainingSceneCategoryRow = Prisma.PresetCategoryGetPayload<{
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

export type TrainingSceneFolderRow = Prisma.PresetFolderGetPayload<{
  select: {
    id: true;
    categoryId: true;
    parentId: true;
    name: true;
    sortOrder: true;
  };
}>;

export async function listTrainingSceneDescriptionPresetRows() {
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

export async function getTrainingSceneDescriptionPresetRow(presetId: string) {
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

export async function listTrainingSceneDescriptionCategoryRows() {
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

export async function getTrainingSceneDescriptionCategoryRow(categoryId: string) {
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

export async function listTrainingSceneDescriptionFolderRows() {
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

export async function getTrainingSceneDescriptionFolderRow(folderId: string) {
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
