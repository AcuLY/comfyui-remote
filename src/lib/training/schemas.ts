import { z } from "zod";

export const trainingPresetInputSchema = z.object({
  category: z.string().trim().min(1).max(80),
  folder: z.string().trim().max(80).optional().default(""),
  sceneDescriptionText: z.string().trim().min(1).max(20_000),
  title: z.string().trim().min(1).max(160),
});

export const trainingPresetSortRulesSchema = z.object({
  categoryOrder: z.array(z.string().trim().min(1)).min(1),
  presetOrder: z.array(z.string().trim().min(1)).min(1),
});

export const trainingSceneCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(80).optional().nullable(),
  color: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  sceneDescriptionOrder: z.coerce.number().int().optional(),
}).strict();

export const trainingSceneCategoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  icon: z.string().trim().max(80).optional().nullable(),
  color: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  sceneDescriptionOrder: z.coerce.number().int().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export const trainingSceneFolderCreateSchema = z.object({
  categoryId: z.string().trim().min(1),
  parentId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().optional(),
}).strict();

export const trainingSceneFolderUpdateSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  parentId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.coerce.number().int().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});
