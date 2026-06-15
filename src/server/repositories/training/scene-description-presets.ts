import { Prisma } from "@/generated/prisma";
import {
  TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE,
  trainingSceneDescriptionPresetCategoryTypeWhere,
} from "@/lib/actions/preset-resource-scope";
import { prisma } from "@/lib/prisma";

export const TRAINING_PRESET_CATEGORY_TYPE = TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE;

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
        type: trainingSceneDescriptionPresetCategoryTypeWhere(),
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
        type: trainingSceneDescriptionPresetCategoryTypeWhere(),
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
    where: { type: trainingSceneDescriptionPresetCategoryTypeWhere() },
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
      type: trainingSceneDescriptionPresetCategoryTypeWhere(),
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
        type: trainingSceneDescriptionPresetCategoryTypeWhere(),
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
        type: trainingSceneDescriptionPresetCategoryTypeWhere(),
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
