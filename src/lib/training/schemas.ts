import { z } from "zod";

const trainingJsonObjectSchema = z.record(z.string(), z.unknown());
const trainingRelativeArtifactPathSchema = z.string().min(1);
const trainingSha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

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

export const TRAINING_GENERATION_KINDS = [
  "text_generation",
  "image_generation",
] as const;

export const TRAINING_GENERATION_TASK_TYPES = [
  "profile_text_generation",
  "scene_description_generation",
  "image_prompt_generation",
  "caption_generation",
  "trainingset_generation",
  "reference_image_generation",
] as const;

export const trainingGenerationKindSchema = z.enum(TRAINING_GENERATION_KINDS);
export const trainingGenerationTaskTypeSchema = z.enum(TRAINING_GENERATION_TASK_TYPES);

export const TRAINING_WORKER_TYPES = [
  "image_generation",
  "dataset_freeze",
  "training",
] as const;

export const trainingWorkerTypeSchema = z.enum(TRAINING_WORKER_TYPES);

const trainingArtifactRefSchema = z.object({
  artifactId: z.string().min(1).optional(),
  kind: z.string().trim().min(1).optional(),
  relativePath: trainingRelativeArtifactPathSchema,
  sha256: trainingSha256Schema.optional(),
}).strict();

const trainingImageGenerationOutputSchema = z.object({
  images: z.array(
    z.object({
      relativePath: trainingRelativeArtifactPathSchema,
      sha256: trainingSha256Schema,
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      metadataPath: trainingRelativeArtifactPathSchema.optional(),
    }),
  ),
  requestRedactedPath: trainingRelativeArtifactPathSchema,
  responseSummaryPath: trainingRelativeArtifactPathSchema,
  elapsedMs: z.number().int().nonnegative(),
});

const trainingMetadataSummarySchema = z.object({
  keyCount: z.number().int().nonnegative(),
  metadataPath: trainingRelativeArtifactPathSchema.optional(),
  summary: trainingJsonObjectSchema.optional(),
}).strict();

const trainingCheckpointOutputSchema = z.object({
  step: z.number().int().nonnegative(),
  artifact: trainingArtifactRefSchema,
  metrics: trainingJsonObjectSchema.optional(),
}).strict();

const trainingCompleteOutputSchema = z.object({
  finalSafetensorsArtifact: trainingArtifactRefSchema,
  finalSha256: trainingSha256Schema.optional(),
  hashes: z.record(z.string(), trainingSha256Schema).optional(),
  metadataSummary: trainingMetadataSummarySchema,
  checkpoints: z.array(trainingCheckpointOutputSchema).default([]),
  trainingLogArtifact: trainingArtifactRefSchema.optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
}).strict();

const trainingWorkerProviderErrorSchema = z.object({
  httpStatus: z.number().int().positive().optional(),
  backendError: z.string().min(1),
  retryable: z.boolean(),
});

export const trainingWorkerTaskLeaseRequestSchema = z.object({
  workerType: trainingWorkerTypeSchema,
  leaseOwner: z.string().trim().min(1).optional(),
  leaseDurationSeconds: z.number().int().min(30).max(86_400).optional(),
  projectId: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).optional(),
  targetId: z.string().trim().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.targetType) === Boolean(value.targetId)) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: value.targetType ? ["targetId"] : ["targetType"],
    message: "targetType and targetId must be provided together when filtering worker leases",
  });
});

export const trainingWorkerTaskHeartbeatRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  leaseDurationSeconds: z.number().int().min(30).max(86_400).optional(),
  progressJson: trainingJsonObjectSchema.optional(),
}).strict();

export const trainingWorkerTaskCompleteRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  output: z.union([
    trainingImageGenerationOutputSchema,
    trainingCompleteOutputSchema,
  ]).optional(),
}).strict();

export const trainingWorkerTaskFailRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  errorSummary: z.string().trim().min(1),
  providerError: trainingWorkerProviderErrorSchema.optional(),
}).strict();

export type TrainingWorkerTaskLeaseRequest = z.infer<typeof trainingWorkerTaskLeaseRequestSchema>;
export type TrainingWorkerTaskHeartbeatRequest = z.infer<typeof trainingWorkerTaskHeartbeatRequestSchema>;
export type TrainingWorkerTaskCompleteRequest = z.infer<typeof trainingWorkerTaskCompleteRequestSchema>;
export type TrainingWorkerTaskFailRequest = z.infer<typeof trainingWorkerTaskFailRequestSchema>;
export type TrainingGenerationKind = z.infer<typeof trainingGenerationKindSchema>;
export type TrainingGenerationTaskType = z.infer<typeof trainingGenerationTaskTypeSchema>;
