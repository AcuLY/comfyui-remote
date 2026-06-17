import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type TrainingPresetRow = Prisma.TrainingSceneDescriptionPresetGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true; sortOrder: true; sceneDescriptionOrder: true } };
    folder: { select: { id: true; name: true; sortOrder: true } };
  };
}>;

export type TrainingSceneCategoryRow = Prisma.TrainingSceneDescriptionPresetCategoryGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    icon: true;
    color: true;
    sortOrder: true;
    sceneDescriptionOrder: true;
  };
}>;

export type TrainingSceneFolderRow = Prisma.TrainingSceneDescriptionPresetFolderGetPayload<{
  select: {
    id: true;
    categoryId: true;
    parentId: true;
    name: true;
    sortOrder: true;
  };
}>;

export async function listTrainingSceneDescriptionPresetRows() {
  return prisma.trainingSceneDescriptionPreset.findMany({
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
          sceneDescriptionOrder: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
    },
  });
}

export async function getTrainingSceneDescriptionPresetRow(presetId: string) {
  return prisma.trainingSceneDescriptionPreset.findFirst({
    where: {
      id: presetId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          sceneDescriptionOrder: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
    },
  });
}

export async function listTrainingSceneDescriptionCategoryRows() {
  return prisma.trainingSceneDescriptionPresetCategory.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { sceneDescriptionOrder: "asc" },
      { createdAt: "asc" },
    ],
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
}

export async function getTrainingSceneDescriptionCategoryRow(categoryId: string) {
  return prisma.trainingSceneDescriptionPresetCategory.findFirst({
    where: {
      id: categoryId,
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
}

export async function listTrainingSceneDescriptionFolderRows() {
  return prisma.trainingSceneDescriptionPresetFolder.findMany({
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
  return prisma.trainingSceneDescriptionPresetFolder.findFirst({
    where: {
      id: folderId,
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
