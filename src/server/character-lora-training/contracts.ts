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
  "job_report",
] as const;

export const CHARACTER_LORA_WORKER_TYPES = [
  "image_generation",
  "dataset_freeze",
  "training",
  "benchmark",
  "promotion",
  "prompt_card_draft",
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
export const CHARACTER_LORA_CANONICAL_VIEWS = ["front", "back", "left", "right"] as const;

export const CHARACTER_LORA_REJECT_REASONS = [
  "identity_wrong",
  "hair_wrong",
  "bangs_wrong",
  "eye_wrong",
  "face_wrong",
  "outfit_wrong",
  "shoe_wrong",
  "accessory_missing",
  "pose_wrong",
  "composition_wrong",
  "hands_wrong",
  "anatomy_wrong",
  "multi_character",
  "background_pollution",
  "style_wrong",
  "watermark_text",
  "quality_low",
  "duplicate",
  "unsafe",
  "other",
] as const;

export const CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES = [
  { state: "underwear", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "underwear_shoes", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "semi_undressed", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "semi_undressed_upper_body", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "semi_undressed_shoes", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "nude", includeInTraining: false, note: "Excluded by default; benchmark/promotion variant only." },
  { state: "default_outfit", includeInTraining: false, note: "Primary training is controlled by primaryOutfitOrForm." },
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
export const characterLoraCanonicalViewSchema = z.enum(CHARACTER_LORA_CANONICAL_VIEWS);
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
export type CharacterLoraCanonicalView = z.infer<typeof characterLoraCanonicalViewSchema>;
export type CharacterLoraRejectReason = z.infer<typeof characterLoraRejectReasonSchema>;

const relativeArtifactPathSchema = z.string().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const characterLoraTrainingScopeMixingPolicySchema = z.object({
  allowMixedCharacters: z.boolean().default(false),
  allowMultipleOfficialOutfits: z.boolean().default(false),
  note: optionalTrimmedStringSchema,
  reason: optionalTrimmedStringSchema,
}).strict();

export const characterLoraTrainingScopeDerivedStateSchema = z.object({
  state: z.string().trim().min(1),
  includeInTraining: z.boolean().default(false),
  advancedExperiment: z.boolean().optional(),
  captionTag: optionalTrimmedStringSchema,
  ratioLimit: z.number().positive().max(1).optional(),
  riskNote: optionalTrimmedStringSchema,
  note: optionalTrimmedStringSchema,
}).strict();

export const characterLoraTrainingScopeSchema = z.object({
  purpose: z.string().trim().min(1).default("character_identity"),
  primaryOutfitOrForm: z.string().trim().min(1),
  scopeNote: optionalTrimmedStringSchema,
  advancedExperiment: z.boolean().default(false),
  mixingPolicy: characterLoraTrainingScopeMixingPolicySchema.default({
    allowMixedCharacters: false,
    allowMultipleOfficialOutfits: false,
    note: "Default PRD 5.2 policy: train one character identity and one primary outfit/form only.",
  }),
  derivedStates: z.array(characterLoraTrainingScopeDerivedStateSchema).default([
    ...CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES,
  ]),
}).strict().superRefine((value, ctx) => {
  const mixingRequested =
    value.mixingPolicy.allowMixedCharacters ||
    value.mixingPolicy.allowMultipleOfficialOutfits;
  const mixingExplanation = value.mixingPolicy.reason ?? value.mixingPolicy.note;

  if (mixingRequested && !value.advancedExperiment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["advancedExperiment"],
      message: "advancedExperiment=true is required when training scope allows mixed characters or multiple official outfits",
    });
  }

  if (mixingRequested && !mixingExplanation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mixingPolicy", "reason"],
      message: "mixingPolicy.reason or note is required when mixed training is allowed",
    });
  }

  value.derivedStates.forEach((state, index) => {
    if (!state.includeInTraining) {
      return;
    }

    if (state.advancedExperiment === false || (!value.advancedExperiment && state.advancedExperiment !== true)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derivedStates", index, "advancedExperiment"],
        message: "advancedExperiment=true is required when a derived state is included in training",
      });
    }

    if (!state.captionTag) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derivedStates", index, "captionTag"],
        message: "captionTag is required when a derived state is included in training",
      });
    }

    if (state.ratioLimit === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derivedStates", index, "ratioLimit"],
        message: "ratioLimit is required when a derived state is included in training",
      });
    }

    if (!state.riskNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derivedStates", index, "riskNote"],
        message: "riskNote is required when a derived state is included in training",
      });
    }
  });
}).transform((value) => ({
  ...value,
  mixingPolicy: {
    ...value.mixingPolicy,
    note: value.mixingPolicy.note ??
      "Default PRD 5.2 policy: train one character identity and one primary outfit/form only.",
  },
  derivedStates: normalizeTrainingScopeDerivedStates(value.derivedStates, value.advancedExperiment),
}));

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
  sourceImageId: z.string().trim().min(1).optional(),
  role: characterLoraProviderInputImageRoleSchema,
  relativePath: relativeArtifactPathSchema,
  sha256: sha256Schema,
}).strict();

export const characterLoraImageGenerationRequestSchema = z.object({
  jobId: z.string().min(1),
  generationRunId: z.string().min(1),
  canonicalView: characterLoraCanonicalViewSchema.optional(),
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

export const characterLoraTrainingLauncherSchema = z.enum(["sd-scripts", "kohya"]);
export const characterLoraTrainingQueuePolicySchema = z.enum(["reject_when_busy", "queue_when_busy", "ignore_busy"]);
export const characterLoraTrainingConfigProfileSchema = z.enum(["conservative", "standard", "strong"]);

export const characterLoraTrainingResolvedConfigSchema = z.object({
  profile: characterLoraTrainingConfigProfileSchema,
  launcher: characterLoraTrainingLauncherSchema,
  ordinary: z.object({
    rank: z.number().int().positive().default(32),
    alpha: z.number().int().positive().default(16),
    resolution: z.number().int().positive().default(1024),
    bucket: z.boolean().default(true),
    precision: z.enum(["fp16", "bf16", "fp32"]).default("bf16"),
    batchSize: z.number().int().positive().default(1),
    gradientAccumulation: z.number().int().positive().default(1),
    targetSteps: z.number().int().positive().default(2000),
    saveInterval: z.number().int().positive().default(500),
  }).strict(),
  advanced: z.object({
    unetLearningRate: z.number().positive().default(0.0001),
    textEncoderLearningRate: z.number().positive().nullable().default(0.00002),
    trainTextEncoder: z.boolean().default(true),
    networkModule: z.string().trim().min(1).default("networks.lora"),
    optimizer: z.string().trim().min(1).default("adamw8bit"),
    lrScheduler: z.string().trim().min(1).default("cosine"),
    minBucketResolution: z.number().int().positive().default(512),
    maxBucketResolution: z.number().int().positive().default(1536),
    seed: z.number().int().optional(),
  }).strict(),
  expert: jsonObjectSchema.default({}),
}).strict();

export const characterLoraTrainingConfigOverridesSchema = z.object({
  ordinary: characterLoraTrainingResolvedConfigSchema.shape.ordinary.partial().optional(),
  advanced: characterLoraTrainingResolvedConfigSchema.shape.advanced.partial().optional(),
  expert: jsonObjectSchema.optional(),
}).strict();

export const characterLoraTrainingLeaseOptionsSchema = z.object({
  leaseOwner: z.string().trim().min(1).optional(),
  leaseDurationSeconds: z.number().int().min(30).max(86_400).optional(),
}).strict();

export const characterLoraTrainingCancelOptionsSchema = z.object({
  signalFilename: z.string().trim().min(1).optional(),
}).strict();

const characterLoraBenchmarkEnqueueFields = {
  checkpointMatrix: z.array(z.string().trim().min(1)).min(1),
  weightMatrix: z.array(z.number().positive()).min(1),
  templateId: z.string().trim().min(1).optional(),
  registerLoraAsset: z.boolean().default(true),
  copyToCharacterDir: z.boolean().default(true),
  loraAssetName: z.string().trim().min(1).optional(),
  queuePolicy: characterLoraTrainingQueuePolicySchema.default("queue_when_busy"),
  dryRun: z.boolean().default(false),
  skipQueue: z.boolean().default(false),
} as const;

const characterLoraPostTrainingBenchmarkDefault = {
  enabled: false,
  registerLoraAsset: true,
  copyToCharacterDir: true,
  queuePolicy: "queue_when_busy",
  dryRun: false,
  skipQueue: false,
} as const;

export const characterLoraPostTrainingBenchmarkSchema = z.object({
  enabled: z.boolean().default(false),
  checkpointMatrix: characterLoraBenchmarkEnqueueFields.checkpointMatrix.optional(),
  weightMatrix: characterLoraBenchmarkEnqueueFields.weightMatrix.optional(),
  templateId: characterLoraBenchmarkEnqueueFields.templateId,
  registerLoraAsset: characterLoraBenchmarkEnqueueFields.registerLoraAsset,
  copyToCharacterDir: characterLoraBenchmarkEnqueueFields.copyToCharacterDir,
  loraAssetName: characterLoraBenchmarkEnqueueFields.loraAssetName,
  queuePolicy: characterLoraBenchmarkEnqueueFields.queuePolicy,
  dryRun: characterLoraBenchmarkEnqueueFields.dryRun,
  skipQueue: characterLoraBenchmarkEnqueueFields.skipQueue,
}).strict().superRefine((value, ctx) => {
  if (!value.enabled) {
    return;
  }

  if (!value.checkpointMatrix || value.checkpointMatrix.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkpointMatrix"],
      message: "checkpointMatrix is required when post-training benchmark is enabled",
    });
  }
  if (!value.weightMatrix || value.weightMatrix.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weightMatrix"],
      message: "weightMatrix is required when post-training benchmark is enabled",
    });
  }
});

export const characterLoraTrainingEnqueueRequestSchema = z.object({
  launcher: characterLoraTrainingLauncherSchema.default("sd-scripts"),
  allowWhenComfyQueueBusy: z.boolean().optional(),
  queuePolicy: characterLoraTrainingQueuePolicySchema.default("reject_when_busy"),
  configProfile: characterLoraTrainingConfigProfileSchema.default("standard"),
  overrides: characterLoraTrainingConfigOverridesSchema.optional(),
  advanced: characterLoraTrainingResolvedConfigSchema.shape.advanced.partial().optional(),
  expert: jsonObjectSchema.optional(),
  lease: characterLoraTrainingLeaseOptionsSchema.optional(),
  cancel: characterLoraTrainingCancelOptionsSchema.optional(),
  postTrainingBenchmark: characterLoraPostTrainingBenchmarkSchema.default(characterLoraPostTrainingBenchmarkDefault),
}).strict();

export const characterLoraTrainingProgressSchema = z.object({
  step: z.number().int().nonnegative().optional(),
  targetSteps: z.number().int().positive().optional(),
  loss: z.number().nonnegative().optional(),
  etaSeconds: z.number().int().nonnegative().optional(),
  currentCheckpoint: relativeArtifactPathSchema.optional(),
}).strict();

export const characterLoraTrainingCheckpointOutputSchema = z.object({
  step: z.number().int().nonnegative(),
  artifact: characterLoraArtifactRefSchema,
  metrics: jsonObjectSchema.optional(),
}).strict();

export const characterLoraTrainingMetadataSummarySchema = z.object({
  keyCount: z.number().int().nonnegative(),
  metadataPath: relativeArtifactPathSchema.optional(),
  summary: jsonObjectSchema.optional(),
}).strict();

export const characterLoraTrainingCompleteOutputSchema = z.object({
  finalSafetensorsArtifact: characterLoraArtifactRefSchema,
  finalSha256: sha256Schema.optional(),
  hashes: z.record(z.string(), sha256Schema).optional(),
  metadataSummary: characterLoraTrainingMetadataSummarySchema,
  checkpoints: z.array(characterLoraTrainingCheckpointOutputSchema).default([]),
  trainingLogArtifact: characterLoraArtifactRefSchema.optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
}).strict();

export const characterLoraTrainingCancelRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
  requestedBy: z.string().trim().min(1).optional(),
}).strict();

export const characterLoraBenchmarkEnqueueRequestSchema = z.object(characterLoraBenchmarkEnqueueFields).strict();

export const characterLoraBenchmarkReportRefSchema = z.object({
  artifactId: z.string().trim().min(1).optional(),
  relativePath: relativeArtifactPathSchema.optional(),
  absolutePath: z.string().trim().min(1).optional(),
  ref: z.string().trim().min(1).optional(),
}).strict();

export const characterLoraBenchmarkCompleteRequestSchema = z.object({
  recommendedWeight: z.number().positive(),
  resultSummary: jsonObjectSchema.default({}),
  diagnosticSuggestions: z.array(z.string().trim().min(1)).default([]),
  report: characterLoraBenchmarkReportRefSchema.optional(),
}).strict();

export const characterLoraBenchmarkCleanupRequestSchema = z.object({
  project: z.boolean().default(true),
  preset: z.boolean().default(true),
  dryRun: z.boolean().default(false),
}).strict();

export const characterLoraBenchmarkCleanupResponseSchema = z.object({
  dryRun: z.boolean(),
  canCleanup: z.boolean(),
  benchmarkRun: z.unknown(),
  cleanup: jsonObjectSchema,
  blockers: z.array(z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    details: z.unknown().optional(),
  }).strict()).default([]),
}).strict();

export const characterLoraPromotionReturnPointSchema = z.enum([
  "dataset",
  "caption",
  "prompt",
  "trainingConfig",
  "weightSelection",
]);

export const characterLoraPromotionDecisionCreateRequestSchema = z.object({
  benchmarkRunId: z.string().trim().min(1),
  status: z.enum(["approved", "rejected"]),
  selectedLoraAssetId: z.string().trim().min(1),
  selectedCheckpoint: z.string().trim().min(1).optional(),
  defaultRecommendedWeight: z.number().positive(),
  perVariantWeightOverrides: z.record(z.string(), z.number().positive()).optional(),
  variantPromptDrafts: z.record(z.string(), z.string()).default({}),
  decisionReason: z.string().trim().min(1).optional(),
  returnPoint: characterLoraPromotionReturnPointSchema.optional(),
}).strict();

export const characterLoraPromoteRequestSchema = z.object({
  dryRun: z.boolean().default(false),
  overwriteExisting: z.boolean().default(false),
}).strict();

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
export type CharacterLoraTrainingScope = z.infer<typeof characterLoraTrainingScopeSchema>;
export type CharacterLoraTrainingScopeDerivedState = z.infer<typeof characterLoraTrainingScopeDerivedStateSchema>;
export type CharacterLoraTrainingLauncher = z.infer<typeof characterLoraTrainingLauncherSchema>;
export type CharacterLoraTrainingQueuePolicy = z.infer<typeof characterLoraTrainingQueuePolicySchema>;
export type CharacterLoraTrainingConfigProfile = z.infer<typeof characterLoraTrainingConfigProfileSchema>;
export type CharacterLoraTrainingResolvedConfig = z.infer<typeof characterLoraTrainingResolvedConfigSchema>;
export type CharacterLoraTrainingEnqueueRequest = z.infer<typeof characterLoraTrainingEnqueueRequestSchema>;
export type CharacterLoraPostTrainingBenchmark = z.infer<typeof characterLoraPostTrainingBenchmarkSchema>;
export type CharacterLoraTrainingProgress = z.infer<typeof characterLoraTrainingProgressSchema>;
export type CharacterLoraTrainingCompleteOutput = z.infer<typeof characterLoraTrainingCompleteOutputSchema>;
export type CharacterLoraTrainingCancelRequest = z.infer<typeof characterLoraTrainingCancelRequestSchema>;
export type CharacterLoraBenchmarkEnqueueRequest = z.infer<typeof characterLoraBenchmarkEnqueueRequestSchema>;
export type CharacterLoraBenchmarkCompleteRequest = z.infer<typeof characterLoraBenchmarkCompleteRequestSchema>;
export type CharacterLoraBenchmarkCleanupRequest = z.infer<typeof characterLoraBenchmarkCleanupRequestSchema>;
export type CharacterLoraBenchmarkCleanupResponse = z.infer<typeof characterLoraBenchmarkCleanupResponseSchema>;
export type CharacterLoraPromotionDecisionCreateRequest = z.infer<typeof characterLoraPromotionDecisionCreateRequestSchema>;
export type CharacterLoraPromotionReturnPoint = z.infer<typeof characterLoraPromotionReturnPointSchema>;
export type CharacterLoraPromoteRequest = z.infer<typeof characterLoraPromoteRequestSchema>;
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
  previousCandidateImageIds: z.array(z.string().trim().min(1)).min(1).optional(),
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
}).strict().superRefine((value, ctx) => {
  if (value.reviewStatus !== "reject") {
    return;
  }

  if (!value.rejectReasons || value.rejectReasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectReasons"],
      message: "rejectReasons must include at least one reason when reviewStatus is reject",
    });
  }
});

export const characterLoraImageReviewBatchRequestSchema = z.object({
  images: z.array(characterLoraImageReviewPatchSchema).min(1),
}).strict();

export const characterLoraCaptionPatchRequestSchema = z.object({
  captionDraft: z.string().trim().min(1),
}).strict();

export const characterLoraDatasetFreezeWarningSchema = z.object({
  sectionId: z.string().trim().min(1),
  sectionKey: z.string().trim().min(1),
  targetKeepCount: z.number().int().nonnegative(),
  actualKeepCount: z.number().int().nonnegative(),
}).strict();

export const characterLoraDatasetFreezeForceOverrideSchema = z.object({
  enabled: z.literal(true),
  reason: z.string().trim().min(1),
  warningCount: z.number().int().nonnegative(),
}).strict();

export const characterLoraDatasetFreezeRequestSchema = z.object({
  queue: z.boolean().optional(),
  force: z.boolean().optional(),
  forceReason: z.string().trim().min(1).optional(),
  captionStrategy: z.string().trim().min(1).optional(),
  repeatCount: z.number().int().positive().optional(),
  sourceWeight: z.number().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.force) {
    return;
  }

  if (!value.forceReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["forceReason"],
      message: "forceReason is required when forcing dataset freeze",
    });
  }
});

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
  output: z.union([
    characterLoraImageGenerationOutputSchema,
    characterLoraTrainingCompleteOutputSchema,
  ]).optional(),
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
export type CharacterLoraDatasetFreezeWarning = z.infer<typeof characterLoraDatasetFreezeWarningSchema>;
export type CharacterLoraDatasetFreezeForceOverride = z.infer<typeof characterLoraDatasetFreezeForceOverrideSchema>;
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
  version: z.number().int().positive(),
  keepImageIds: z.array(z.string().min(1)).min(1),
  captionStrategy: z.string().min(1),
  repeatCount: z.number().int().positive(),
  sourceWeight: z.number().positive().optional(),
  forceOverride: characterLoraDatasetFreezeForceOverrideSchema.nullable().optional(),
  warnings: z.array(characterLoraDatasetFreezeWarningSchema).default([]),
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
  postTrainingBenchmark: characterLoraPostTrainingBenchmarkSchema.default(characterLoraPostTrainingBenchmarkDefault),
});

export const characterLoraBaseCheckpointSnapshotSchema = z.object({
  name: z.string().min(1).nullable(),
  path: z.string().min(1).nullable(),
  hash: sha256Schema.nullable(),
  baseFamily: z.string().min(1).nullable(),
}).strict();

export const characterLoraBenchmarkTaskPayloadSchema = z.object({
  taskType: z.literal("benchmark"),
  jobId: z.string().min(1),
  benchmarkRunId: z.string().min(1),
  trainingRunId: z.string().min(1),
  finalSafetensorsArtifact: characterLoraArtifactRefSchema,
  baseCheckpoint: characterLoraBaseCheckpointSnapshotSchema,
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

export const characterLoraPromptCardDraftTaskPayloadSchema = z.object({
  taskType: z.literal("prompt_card_draft"),
  jobId: z.string().min(1),
  request: z.object({
    provider: z.enum(["codex-cli", "mock-local"]),
    operatorNotes: z.string().trim().min(1).nullable().optional(),
    sourceImageIds: z.array(z.string().trim().min(1)).default([]),
    canonicalVersionIds: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
}).strict();

export const characterLoraWorkerTaskPayloadSchema = z.discriminatedUnion("taskType", [
  characterLoraImageGenerationTaskPayloadSchema,
  characterLoraDatasetFreezeTaskPayloadSchema,
  characterLoraTrainingTaskPayloadSchema,
  characterLoraBenchmarkTaskPayloadSchema,
  characterLoraPromotionTaskPayloadSchema,
  characterLoraPromptCardDraftTaskPayloadSchema,
]);

export type CharacterLoraImageGenerationTaskPayload = z.infer<typeof characterLoraImageGenerationTaskPayloadSchema>;
export type CharacterLoraDatasetFreezeTaskPayload = z.infer<typeof characterLoraDatasetFreezeTaskPayloadSchema>;
export type CharacterLoraTrainingTaskPayload = z.infer<typeof characterLoraTrainingTaskPayloadSchema>;
export type CharacterLoraBenchmarkTaskPayload = z.infer<typeof characterLoraBenchmarkTaskPayloadSchema>;
export type CharacterLoraPromotionTaskPayload = z.infer<typeof characterLoraPromotionTaskPayloadSchema>;
export type CharacterLoraPromptCardDraftTaskPayload = z.infer<typeof characterLoraPromptCardDraftTaskPayloadSchema>;
export type CharacterLoraWorkerTaskPayload = z.infer<typeof characterLoraWorkerTaskPayloadSchema>;

function normalizeTrainingScopeDerivedStates(
  states: Array<z.infer<typeof characterLoraTrainingScopeDerivedStateSchema>>,
  scopeAdvancedExperiment: boolean,
) {
  const byState = new Map(states.map((state) => [state.state, state]));
  const defaultStateNames = new Set<string>(CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES.map((state) => state.state));

  const normalizedDefaults = CHARACTER_LORA_DEFAULT_DERIVED_TRAINING_STATES.map((defaultState) => {
    const state = byState.get(defaultState.state);
    if (!state) {
      return {
        ...defaultState,
        advancedExperiment: false,
      };
    }

    return {
      ...defaultState,
      ...state,
      advancedExperiment: state.includeInTraining
        ? state.advancedExperiment ?? scopeAdvancedExperiment
        : state.advancedExperiment ?? false,
    };
  });

  const customStates = states
    .filter((state) => !defaultStateNames.has(state.state))
    .map((state) => ({
      ...state,
      advancedExperiment: state.includeInTraining
        ? state.advancedExperiment ?? scopeAdvancedExperiment
        : state.advancedExperiment ?? false,
    }));

  return [...normalizedDefaults, ...customStates];
}
