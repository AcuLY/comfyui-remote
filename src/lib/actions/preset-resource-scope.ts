import { prisma } from "@/lib/prisma";

export const ORDINARY_PRESET_CATEGORY_TYPE = "preset";
export const ORDINARY_PRESET_GROUP_CATEGORY_TYPE = "group";
export const TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE = "training_scene_description";
export const ORDINARY_PRESET_LIBRARY_CATEGORY_TYPES = [
  ORDINARY_PRESET_CATEGORY_TYPE,
  ORDINARY_PRESET_GROUP_CATEGORY_TYPE,
] as const;

export class PresetResourceScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetResourceScopeError";
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export function ordinaryPresetLibraryCategoryTypeWhere() {
  return { in: [...ORDINARY_PRESET_LIBRARY_CATEGORY_TYPES] };
}

export function trainingSceneDescriptionPresetCategoryTypeWhere() {
  return TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE;
}

export function isOrdinaryPresetLibraryCategoryType(type: string | null | undefined) {
  return ORDINARY_PRESET_LIBRARY_CATEGORY_TYPES.includes(
    type as (typeof ORDINARY_PRESET_LIBRARY_CATEGORY_TYPES)[number],
  );
}

export function isOrdinaryPresetCategoryType(type: string | null | undefined) {
  return type === ORDINARY_PRESET_CATEGORY_TYPE;
}

export function isTrainingSceneDescriptionPresetCategoryType(type: string | null | undefined) {
  return type === TRAINING_SCENE_DESCRIPTION_PRESET_CATEGORY_TYPE;
}

export async function assertOrdinaryPresetCategory(categoryId: string) {
  const category = await prisma.presetCategory.findFirst({
    where: { id: categoryId, type: ORDINARY_PRESET_CATEGORY_TYPE },
    select: { id: true },
  });

  if (!category) {
    throw new PresetResourceScopeError(`Ordinary preset category not found: ${categoryId}`);
  }

  return category;
}

export async function assertOrdinaryPresetCategories(categoryIds: string[]) {
  const ids = uniqueIds(categoryIds);
  if (ids.length === 0) return;

  const count = await prisma.presetCategory.count({
    where: { id: { in: ids }, type: ORDINARY_PRESET_CATEGORY_TYPE },
  });

  if (count !== ids.length) {
    throw new PresetResourceScopeError("Ordinary preset categories include non-generation resources");
  }
}

export async function assertOrdinaryPresetLibraryCategory(categoryId: string) {
  const category = await prisma.presetCategory.findFirst({
    where: { id: categoryId, type: ordinaryPresetLibraryCategoryTypeWhere() },
    select: { id: true },
  });

  if (!category) {
    throw new PresetResourceScopeError(`Ordinary preset category not found: ${categoryId}`);
  }

  return category;
}

export async function assertOrdinaryPresetLibraryCategories(categoryIds: string[]) {
  const ids = uniqueIds(categoryIds);
  if (ids.length === 0) return;

  const count = await prisma.presetCategory.count({
    where: { id: { in: ids }, type: ordinaryPresetLibraryCategoryTypeWhere() },
  });

  if (count !== ids.length) {
    throw new PresetResourceScopeError("Ordinary preset categories include non-generation resources");
  }
}

export async function assertOrdinaryPreset(presetId: string) {
  const preset = await prisma.preset.findFirst({
    where: {
      id: presetId,
      category: { type: ORDINARY_PRESET_CATEGORY_TYPE },
    },
    select: { id: true, categoryId: true },
  });

  if (!preset) {
    throw new PresetResourceScopeError(`Ordinary preset not found: ${presetId}`);
  }

  return preset;
}

export async function assertOrdinaryPresets(presetIds: string[]) {
  const ids = uniqueIds(presetIds);
  if (ids.length === 0) return;

  const count = await prisma.preset.count({
    where: {
      id: { in: ids },
      category: { type: ORDINARY_PRESET_CATEGORY_TYPE },
    },
  });

  if (count !== ids.length) {
    throw new PresetResourceScopeError("Ordinary presets include non-generation resources");
  }
}

export async function assertOrdinaryPresetFolder(folderId: string) {
  const folder = await prisma.presetFolder.findFirst({
    where: {
      id: folderId,
      category: { type: ordinaryPresetLibraryCategoryTypeWhere() },
    },
    select: { id: true, categoryId: true },
  });

  if (!folder) {
    throw new PresetResourceScopeError(`Ordinary preset folder not found: ${folderId}`);
  }

  return folder;
}

export async function assertOrdinaryPresetGroup(groupId: string) {
  const group = await prisma.presetGroup.findFirst({
    where: {
      id: groupId,
      category: { type: ordinaryPresetLibraryCategoryTypeWhere() },
    },
    select: { id: true, categoryId: true },
  });

  if (!group) {
    throw new PresetResourceScopeError(`Ordinary preset group not found: ${groupId}`);
  }

  return group;
}

export async function assertOrdinaryPresetVariant(variantId: string) {
  const variant = await prisma.presetVariant.findFirst({
    where: {
      id: variantId,
      preset: { category: { type: ORDINARY_PRESET_CATEGORY_TYPE } },
    },
    select: { id: true, presetId: true },
  });

  if (!variant) {
    throw new PresetResourceScopeError(`Ordinary preset variant not found: ${variantId}`);
  }

  return variant;
}
