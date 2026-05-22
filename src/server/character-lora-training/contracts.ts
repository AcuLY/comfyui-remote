import { z } from "zod";

export const CHARACTER_LORA_JOB_STATUSES = [
  "draft",
  "canonical_pending",
  "prompt_pending",
  "section_generating",
  "reviewing",
  "dataset_ready",
  "training_queued",
  "training_running",
  "trained",
  "benchmarking",
  "benchmark_review",
  "promotion_ready",
  "promoted",
  "failed",
  "cancelled",
  "archived",
] as const;

export const CHARACTER_LORA_IMAGE_REVIEW_STATUSES = [
  "pending",
  "keep",
  "reject",
  "excluded",
  "included_in_training",
] as const;

export const CHARACTER_LORA_RUN_STATUSES = [
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;

export const CHARACTER_LORA_ARTIFACT_KINDS = [
  "source_image",
  "canonical_image",
  "candidate_image",
  "prompt",
  "provider_payload",
  "caption",
  "dataset_manifest",
  "training_config",
  "training_log",
  "safetensors",
  "benchmark_report",
  "promotion_report",
] as const;

export const CHARACTER_LORA_WORKER_TYPES = [
  "image_generation",
  "dataset_freeze",
  "training",
  "benchmark",
  "promotion",
] as const;

export const CHARACTER_LORA_DECISION_STATUSES = [
  "draft",
  "approved",
  "rejected",
  "promoted",
  "superseded",
] as const;

export const CHARACTER_LORA_GPU_TASK_LOCK_STATUSES = [
  "active",
  "released",
  "stale",
] as const;

export const CHARACTER_LORA_SOURCE_IMAGE_ROLES = [
  "source",
  "setting",
  "local_reference",
  "manual_canonical",
  "rerun_reference",
] as const;

export const CHARACTER_LORA_PROVIDER_INPUT_IMAGE_ROLES = [
  "canonical",
  "source",
  "setting",
  "local_reference",
  "previous_candidate",
] as const;

export const CHARACTER_LORA_IMAGE_PROVIDERS = ["mock-local", "openai-codex"] as const;

export const CHARACTER_LORA_REJECT_REASONS = [
  "identity_wrong",
  "hair_wrong",
  "bangs_wrong",
  "eye_wrong",
  "face_wrong",
  "outfit_wrong",
  "shoe_wrong",
  "pose_wrong",
  "composition_wrong",
  "hands_wrong",
  "anatomy_wrong",
  "style_wrong",
  "quality_low",
  "duplicate",
  "unsafe",
  "other",
] as const;

export const characterLoraJobStatusSchema = z.enum(CHARACTER_LORA_JOB_STATUSES);
export const characterLoraImageReviewStatusSchema = z.enum(CHARACTER_LORA_IMAGE_REVIEW_STATUSES);
export const characterLoraRunStatusSchema = z.enum(CHARACTER_LORA_RUN_STATUSES);
export const characterLoraArtifactKindSchema = z.enum(CHARACTER_LORA_ARTIFACT_KINDS);
export const characterLoraWorkerTypeSchema = z.enum(CHARACTER_LORA_WORKER_TYPES);
export const characterLoraDecisionStatusSchema = z.enum(CHARACTER_LORA_DECISION_STATUSES);
export const characterLoraGpuTaskLockStatusSchema = z.enum(CHARACTER_LORA_GPU_TASK_LOCK_STATUSES);
export const characterLoraSourceImageRoleSchema = z.enum(CHARACTER_LORA_SOURCE_IMAGE_ROLES);
export const characterLoraProviderInputImageRoleSchema = z.enum(CHARACTER_LORA_PROVIDER_INPUT_IMAGE_ROLES);
export const characterLoraImageProviderSchema = z.enum(CHARACTER_LORA_IMAGE_PROVIDERS);
export const characterLoraRejectReasonSchema = z.enum(CHARACTER_LORA_REJECT_REASONS);

export type CharacterLoraJobStatus = z.infer<typeof characterLoraJobStatusSchema>;
export type CharacterLoraImageReviewStatus = z.infer<typeof characterLoraImageReviewStatusSchema>;
export type CharacterLoraRunStatus = z.infer<typeof characterLoraRunStatusSchema>;
export type CharacterLoraArtifactKind = z.infer<typeof characterLoraArtifactKindSchema>;
export type CharacterLoraWorkerType = z.infer<typeof characterLoraWorkerTypeSchema>;
export type CharacterLoraDecisionStatus = z.infer<typeof characterLoraDecisionStatusSchema>;
export type CharacterLoraGpuTaskLockStatus = z.infer<typeof characterLoraGpuTaskLockStatusSchema>;
export type CharacterLoraSourceImageRole = z.infer<typeof characterLoraSourceImageRoleSchema>;
export type CharacterLoraProviderInputImageRole = z.infer<typeof characterLoraProviderInputImageRoleSchema>;
export type CharacterLoraImageProvider = z.infer<typeof characterLoraImageProviderSchema>;
export type CharacterLoraRejectReason = z.infer<typeof characterLoraRejectReasonSchema>;

const relativeArtifactPathSchema = z.string().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const characterLoraArtifactRefSchema = z.object({
  artifactId: z.string().min(1).optional(),
  kind: characterLoraArtifactKindSchema.optional(),
  relativePath: relativeArtifactPathSchema,
  sha256: sha256Schema.optional(),
}).strict();

export const characterLoraProviderToolParamsSchema = z.object({
  size: z.string().min(1),
  quality: z.string().min(1),
  outputFormat: z.enum(["png"]),
  background: z.enum(["opaque", "transparent"]),
  partialImages: z.number().int().positive().optional(),
}).strict();

export const characterLoraProviderInputImageSchema = z.object({
  artifactId: z.string().min(1),
  role: characterLoraProviderInputImageRoleSchema,
  relativePath: relativeArtifactPathSchema,
  sha256: sha256Schema,
}).strict();

export const characterLoraImageGenerationRequestSchema = z.object({
  jobId: z.string().min(1),
  generationRunId: z.string().min(1),
  provider: characterLoraImageProviderSchema,
  hostModel: z.string().min(1),
  imageModel: z.enum(["gpt-image-2"]),
  // Host instructions describe tool use only. They must not contain provider auth or visual details.
  hostInstruction: z.string().min(1),
  // Visual prompts carry the character, scene, constraints, and user corrections.
  visualPrompt: z.string().min(1),
  // Rendered prompt is the final provider-facing prompt after templates and variables resolve.
  renderedPrompt: z.string().min(1).optional(),
  negativePrompt: z.string().optional(),
  toolParams: characterLoraProviderToolParamsSchema,
  inputImages: z.array(characterLoraProviderInputImageSchema),
  outputDir: relativeArtifactPathSchema,
}).strict();

export const characterLoraImageGenerationOutputSchema = z.object({
  images: z.array(
    z.object({
      relativePath: relativeArtifactPathSchema,
      sha256: sha256Schema,
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      metadataPath: relativeArtifactPathSchema.optional(),
    }),
  ),
  requestRedactedPath: relativeArtifactPathSchema,
  responseSummaryPath: relativeArtifactPathSchema,
  elapsedMs: z.number().int().nonnegative(),
});

export const characterLoraProviderErrorSchema = z.object({
  httpStatus: z.number().int().positive().optional(),
  backendError: z.string().min(1),
  retryable: z.boolean(),
});

export type CharacterLoraArtifactRef = z.infer<typeof characterLoraArtifactRefSchema>;
export type CharacterLoraProviderToolParams = z.infer<typeof characterLoraProviderToolParamsSchema>;
export type CharacterLoraProviderInputImage = z.infer<typeof characterLoraProviderInputImageSchema>;
export type CharacterLoraImageGenerationRequest = z.infer<typeof characterLoraImageGenerationRequestSchema>;
export type CharacterLoraImageGenerationOutput = z.infer<typeof characterLoraImageGenerationOutputSchema>;
export type CharacterLoraProviderError = z.infer<typeof characterLoraProviderErrorSchema>;

export const characterLoraSectionGenerationRequestSchema = z.object({
  provider: characterLoraImageProviderSchema.optional(),
  hostModel: z.string().trim().min(1).optional(),
  imageModel: z.literal("gpt-image-2").optional(),
  hostInstruction: z.string().trim().min(1).optional(),
  visualPrompt: z.string().trim().min(1).optional(),
  renderedPrompt: z.string().trim().min(1).optional(),
  negativePrompt: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional(),
  userInstruction: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional(),
  parentRunId: z.string().trim().min(1).optional(),
  toolParams: characterLoraProviderToolParamsSchema.optional(),
  inputImages: z.array(characterLoraProviderInputImageSchema).optional(),
  sourceImageIds: z.array(z.string().trim().min(1)).optional(),
}).strict();

export const characterLoraImageReviewPatchSchema = z.object({
  imageId: z.string().trim().min(1),
  reviewStatus: z.enum(["pending", "keep", "reject", "excluded"]),
  rejectReasons: z.array(characterLoraRejectReasonSchema).optional(),
  reviewNote: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional(),
}).strict();

export const characterLoraImageReviewBatchRequestSchema = z.object({
  images: z.array(characterLoraImageReviewPatchSchema).min(1),
}).strict();

export const characterLoraCaptionPatchRequestSchema = z.object({
  captionDraft: z.string().trim().min(1),
}).strict();

export const characterLoraDatasetFreezeRequestSchema = z.object({
  force: z.boolean().optional(),
  captionStrategy: z.string().trim().min(1).optional(),
  repeatCount: z.number().int().positive().optional(),
  sourceWeight: z.number().positive().optional(),
}).strict();

export const characterLoraWorkerTaskLeaseRequestSchema = z.object({
  workerType: characterLoraWorkerTypeSchema,
  leaseOwner: z.string().trim().min(1).optional(),
  leaseDurationSeconds: z.number().int().min(30).max(86_400).optional(),
}).strict();

export const characterLoraWorkerTaskHeartbeatRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  leaseDurationSeconds: z.number().int().min(30).max(86_400).optional(),
  progressJson: jsonObjectSchema.optional(),
}).strict();

export const characterLoraWorkerTaskCompleteRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  output: characterLoraImageGenerationOutputSchema,
}).strict();

export const characterLoraWorkerTaskFailRequestSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  errorSummary: z.string().trim().min(1),
  providerError: characterLoraProviderErrorSchema.optional(),
}).strict();

export type CharacterLoraSectionGenerationRequest = z.infer<typeof characterLoraSectionGenerationRequestSchema>;
export type CharacterLoraImageReviewPatch = z.infer<typeof characterLoraImageReviewPatchSchema>;
export type CharacterLoraImageReviewBatchRequest = z.infer<typeof characterLoraImageReviewBatchRequestSchema>;
export type CharacterLoraCaptionPatchRequest = z.infer<typeof characterLoraCaptionPatchRequestSchema>;
export type CharacterLoraDatasetFreezeRequest = z.infer<typeof characterLoraDatasetFreezeRequestSchema>;
export type CharacterLoraWorkerTaskLeaseRequest = z.infer<typeof characterLoraWorkerTaskLeaseRequestSchema>;
export type CharacterLoraWorkerTaskHeartbeatRequest = z.infer<typeof characterLoraWorkerTaskHeartbeatRequestSchema>;
export type CharacterLoraWorkerTaskCompleteRequest = z.infer<typeof characterLoraWorkerTaskCompleteRequestSchema>;
export type CharacterLoraWorkerTaskFailRequest = z.infer<typeof characterLoraWorkerTaskFailRequestSchema>;

export const characterLoraImageGenerationTaskPayloadSchema = z.object({
  taskType: z.literal("image_generation"),
  jobId: z.string().min(1),
  generationRunId: z.string().min(1),
  request: characterLoraImageGenerationRequestSchema,
}).strict();

export const characterLoraDatasetFreezeTaskPayloadSchema = z.object({
  taskType: z.literal("dataset_freeze"),
  jobId: z.string().min(1),
  datasetRevisionId: z.string().min(1),
  canonicalVersionId: z.string().min(1),
  promptCardVersionId: z.string().min(1),
  keepImageIds: z.array(z.string().min(1)).min(1),
  captionStrategy: z.string().min(1),
  repeatCount: z.number().int().positive().optional(),
  sourceWeight: z.number().positive().optional(),
});

export const characterLoraTrainingTaskPayloadSchema = z.object({
  taskType: z.literal("training"),
  jobId: z.string().min(1),
  trainingRunId: z.string().min(1),
  datasetRevisionId: z.string().min(1),
  baseCheckpointPath: z.string().min(1),
  baseCheckpointHash: sha256Schema.optional(),
  baseFamily: z.string().min(1).optional(),
  launcher: z.enum(["sd-scripts", "kohya"]),
  resolvedConfig: jsonObjectSchema,
  outputDir: relativeArtifactPathSchema,
  cancelSignalPath: relativeArtifactPathSchema,
});

export const characterLoraBenchmarkTaskPayloadSchema = z.object({
  taskType: z.literal("benchmark"),
  jobId: z.string().min(1),
  benchmarkRunId: z.string().min(1),
  trainingRunId: z.string().min(1),
  finalSafetensorsArtifact: characterLoraArtifactRefSchema,
  checkpointMatrix: z.array(z.string().min(1)).min(1),
  weightMatrix: z.array(z.number().positive()).min(1),
  templateId: z.string().min(1).optional(),
});

export const characterLoraPromotionTaskPayloadSchema = z.object({
  taskType: z.literal("promotion"),
  jobId: z.string().min(1),
  promotionDecisionId: z.string().min(1),
  benchmarkRunId: z.string().min(1),
  selectedLoraAssetId: z.string().min(1),
  selectedCheckpoint: z.string().min(1).optional(),
  defaultRecommendedWeight: z.number().positive(),
  perVariantWeightOverrides: jsonObjectSchema.optional(),
  variantPromptDrafts: jsonObjectSchema,
});

export const characterLoraWorkerTaskPayloadSchema = z.discriminatedUnion("taskType", [
  characterLoraImageGenerationTaskPayloadSchema,
  characterLoraDatasetFreezeTaskPayloadSchema,
  characterLoraTrainingTaskPayloadSchema,
  characterLoraBenchmarkTaskPayloadSchema,
  characterLoraPromotionTaskPayloadSchema,
]);

export type CharacterLoraImageGenerationTaskPayload = z.infer<typeof characterLoraImageGenerationTaskPayloadSchema>;
export type CharacterLoraDatasetFreezeTaskPayload = z.infer<typeof characterLoraDatasetFreezeTaskPayloadSchema>;
export type CharacterLoraTrainingTaskPayload = z.infer<typeof characterLoraTrainingTaskPayloadSchema>;
export type CharacterLoraBenchmarkTaskPayload = z.infer<typeof characterLoraBenchmarkTaskPayloadSchema>;
export type CharacterLoraPromotionTaskPayload = z.infer<typeof characterLoraPromotionTaskPayloadSchema>;
export type CharacterLoraWorkerTaskPayload = z.infer<typeof characterLoraWorkerTaskPayloadSchema>;
