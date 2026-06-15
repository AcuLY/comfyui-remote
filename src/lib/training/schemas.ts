import { z } from "zod";

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
