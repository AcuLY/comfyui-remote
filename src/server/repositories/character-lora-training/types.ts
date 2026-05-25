import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
} from "@/generated/prisma/enums";

export const CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS = [
  "角色 lora 测试",
  "角色 LoRA 测试",
  "character lora",
] as const;
export const CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME = "角色 LoRA 测试";
export const CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION =
  "Default ProjectTemplate for Character LoRA training benchmark and promotion evidence. It covers the standard 7 promotion variants.";
export const CHARACTER_LORA_BENCHMARK_TEMPLATE_REQUIRED_SECTION_COUNT = 7;
export const CHARACTER_LORA_BENCHMARK_TEMPLATE_SECTIONS = [
  { name: "默认", slug: "default", promptSuffix: "default outfit, standing pose" },
  { name: "内裤", slug: "underwear", promptSuffix: "underwear outfit, standing pose" },
  { name: "内裤+脱鞋", slug: "underwear-shoes-off", promptSuffix: "underwear outfit, barefoot" },
  { name: "半脱", slug: "half-undressed", promptSuffix: "half undressed outfit" },
  { name: "半脱+上半身", slug: "half-undressed-upper", promptSuffix: "half undressed upper body" },
  { name: "半脱+脱鞋", slug: "half-undressed-shoes-off", promptSuffix: "half undressed outfit, barefoot" },
  { name: "裸", slug: "naked", promptSuffix: "nude body, neutral pose" },
] as const;

export const TRAINING_TEMPLATE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  baseFamily: true,
  captionStrategyDefault: true,
  canonicalDefaults: true,
  promptCardDefaults: true,
  trainingDefaults: true,
  benchmarkDefaults: true,
  promotionDefaults: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sectionTemplates: true,
      jobs: true,
    },
  },
} as const;

export const JOB_SUMMARY_SELECT = {
  id: true,
  slug: true,
  characterName: true,
  triggerToken: true,
  status: true,
  phase: true,
  trainingScope: true,
  captionStrategy: true,
  baseCheckpointName: true,
  baseCheckpointPath: true,
  baseCheckpointHash: true,
  baseFamily: true,
  artifactRoot: true,
  currentCanonicalVersionId: true,
  currentPromptCardVersionId: true,
  selectedDatasetRevisionId: true,
  promotedPresetId: true,
  trainingTemplateId: true,
  trainingTemplateSnapshot: true,
  createdBy: true,
  failureSummary: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sourceImages: true,
      canonicalVersions: true,
      promptCardVersions: true,
      sections: true,
      generationRuns: true,
      candidateImages: true,
      datasetRevisions: true,
      trainingRuns: true,
      benchmarkRuns: true,
      promotionDecisions: true,
      artifacts: true,
      workerTasks: true,
    },
  },
} as const;

export const SOURCE_IMAGE_SELECT = {
  id: true,
  jobId: true,
  role: true,
  artifactId: true,
  filePath: true,
  sha256: true,
  width: true,
  height: true,
  provenance: true,
  sortOrder: true,
  createdAt: true,
} as const;

export const ARTIFACT_REF_SELECT = {
  id: true,
  jobId: true,
  kind: true,
  relativePath: true,
  absolutePath: true,
  sha256: true,
  byteSize: true,
  mimeType: true,
  redactionLevel: true,
  metadata: true,
  createdAt: true,
} as const;

export const GENERATION_RUN_SUMMARY_SELECT = {
  id: true,
  jobId: true,
  sectionId: true,
  kind: true,
  canonicalView: true,
  parentRunId: true,
  status: true,
  provider: true,
  hostModel: true,
  imageModel: true,
  hostInstruction: true,
  visualPrompt: true,
  negativePrompt: true,
  toolParams: true,
  inputImages: true,
  requestArtifactId: true,
  responseSummary: true,
  errorSummary: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      canonicalVersions: true,
      candidateImages: true,
    },
  },
} as const;

export const CANONICAL_VERSION_SELECT = {
  id: true,
  jobId: true,
  version: true,
  status: true,
  canonicalView: true,
  sourceRunId: true,
  imageArtifactId: true,
  selectedAt: true,
  notes: true,
  createdAt: true,
} as const;

export const PROMPT_CARD_VERSION_SELECT = {
  id: true,
  jobId: true,
  canonicalVersionId: true,
  version: true,
  triggerToken: true,
  identityTraits: true,
  outfitTraits: true,
  negativeTraits: true,
  finalPromptDraft: true,
  changeReason: true,
  createdAt: true,
} as const;

export const SECTION_TEMPLATE_SELECT = {
  id: true,
  trainingTemplateId: true,
  key: true,
  name: true,
  description: true,
  angleTag: true,
  promptTemplate: true,
  negativeTemplate: true,
  targetCandidateCount: true,
  targetKeepCount: true,
  sortOrder: true,
  isActive: true,
} as const;

export const JOB_SECTION_SELECT = {
  id: true,
  jobId: true,
  templateId: true,
  key: true,
  name: true,
  canonicalVersionId: true,
  promptCardVersionId: true,
  targetCandidateCount: true,
  targetKeepCount: true,
  status: true,
  keepCount: true,
  rejectCount: true,
  pendingCount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  template: {
    select: {
      promptTemplate: true,
      negativeTemplate: true,
      angleTag: true,
      description: true,
    },
  },
  _count: {
    select: {
      generationRuns: true,
      candidateImages: true,
    },
  },
} as const;

export const CANDIDATE_IMAGE_SELECT = {
  id: true,
  jobId: true,
  sectionId: true,
  generationRunId: true,
  artifactId: true,
  filePath: true,
  sha256: true,
  width: true,
  height: true,
  fileSize: true,
  reviewStatus: true,
  rejectReasons: true,
  reviewNote: true,
  captionDraft: true,
  reviewedAt: true,
  includedDatasetRevisionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const DATASET_REVISION_SELECT = {
  id: true,
  jobId: true,
  version: true,
  status: true,
  canonicalVersionId: true,
  promptCardVersionId: true,
  captionStrategy: true,
  itemCount: true,
  sourceCount: true,
  syntheticCount: true,
  selectedManifestArtifactId: true,
  metadataJsonlArtifactId: true,
  captionAuditArtifactId: true,
  trainDir: true,
  frozenAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      items: true,
      includedCandidateImages: true,
    },
  },
} as const;

export const TRAINING_RUN_SELECT = {
  id: true,
  jobId: true,
  datasetRevisionId: true,
  status: true,
  launcher: true,
  resolvedConfig: true,
  configArtifactId: true,
  dryRunSummaryArtifactId: true,
  logArtifactId: true,
  outputDir: true,
  finalSafetensorsArtifactId: true,
  finalSha256: true,
  metadataSummary: true,
  currentStep: true,
  targetSteps: true,
  lossSnapshot: true,
  cancelRequestedAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      checkpoints: true,
      benchmarkRuns: true,
    },
  },
} as const;

export const BENCHMARK_RUN_SELECT = {
  id: true,
  jobId: true,
  trainingRunId: true,
  status: true,
  loraAssetId: true,
  testPresetId: true,
  testProjectId: true,
  templateId: true,
  checkpointMatrix: true,
  weightMatrix: true,
  reportArtifactId: true,
  recommendedWeight: true,
  resultSummary: true,
  testPresetCleanedAt: true,
  testProjectCleanedAt: true,
  cleanupSummary: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      promotionDecisions: true,
    },
  },
} as const;

export const PROMOTION_DECISION_SELECT = {
  id: true,
  jobId: true,
  benchmarkRunId: true,
  status: true,
  selectedLoraAssetId: true,
  selectedCheckpoint: true,
  defaultRecommendedWeight: true,
  perVariantWeightOverrides: true,
  variantPromptDrafts: true,
  decisionReason: true,
  rejectedReturnPoint: true,
  promotedCategoryId: true,
  promotedPresetId: true,
  reportArtifactId: true,
  decidedAt: true,
  promotedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const WORKER_TASK_SELECT = {
  id: true,
  jobId: true,
  workerType: true,
  targetType: true,
  targetId: true,
  status: true,
  payload: true,
  leaseOwner: true,
  leaseExpiresAt: true,
  attemptCount: true,
  progressJson: true,
  startedAt: true,
  heartbeatAt: true,
  finishedAt: true,
  errorSummary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GPU_TASK_LOCK_SELECT = {
  id: true,
  taskType: true,
  ownerType: true,
  ownerId: true,
  status: true,
  startedAt: true,
  releasedAt: true,
  metadata: true,
} as const;

export const BENCHMARK_TEMPLATE_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sections: true,
    },
  },
} as const;

export type JobSummaryRecord = Prisma.CharacterLoraTrainingJobGetPayload<{
  select: typeof JOB_SUMMARY_SELECT;
}>;

export type TrainingTemplateRecord = Prisma.CharacterLoraTrainingTemplateGetPayload<{
  select: typeof TRAINING_TEMPLATE_SELECT;
}>;

export type SourceImageRecord = Prisma.CharacterLoraSourceImageGetPayload<{
  select: typeof SOURCE_IMAGE_SELECT;
}>;

export type ArtifactRefRecord = Prisma.CharacterLoraArtifactGetPayload<{
  select: typeof ARTIFACT_REF_SELECT;
}>;

export type GenerationRunRecord = Prisma.CharacterLoraGenerationRunGetPayload<{
  select: typeof GENERATION_RUN_SUMMARY_SELECT;
}>;

export type CanonicalVersionRecord = Prisma.CharacterLoraCanonicalVersionGetPayload<{
  select: typeof CANONICAL_VERSION_SELECT;
}>;

export type PromptCardVersionRecord = Prisma.CharacterLoraPromptCardVersionGetPayload<{
  select: typeof PROMPT_CARD_VERSION_SELECT;
}>;

export type SectionTemplateRecord = Prisma.CharacterLoraSectionTemplateGetPayload<{
  select: typeof SECTION_TEMPLATE_SELECT;
}>;

export type JobSectionRecord = Prisma.CharacterLoraJobSectionGetPayload<{
  select: typeof JOB_SECTION_SELECT;
}>;

export type CandidateImageRecord = Prisma.CharacterLoraCandidateImageGetPayload<{
  select: typeof CANDIDATE_IMAGE_SELECT;
}>;

export type DatasetRevisionRecord = Prisma.CharacterLoraDatasetRevisionGetPayload<{
  select: typeof DATASET_REVISION_SELECT;
}>;

export type TrainingRunRecord = Prisma.CharacterLoraTrainingRunGetPayload<{
  select: typeof TRAINING_RUN_SELECT;
}>;

export type BenchmarkRunRecord = Prisma.CharacterLoraBenchmarkRunGetPayload<{
  select: typeof BENCHMARK_RUN_SELECT;
}>;

export type PromotionDecisionRecord = Prisma.CharacterLoraPromotionDecisionGetPayload<{
  select: typeof PROMOTION_DECISION_SELECT;
}>;

export type WorkerTaskRecord = Prisma.CharacterLoraWorkerTaskGetPayload<{
  select: typeof WORKER_TASK_SELECT;
}>;

export type GpuTaskLockRecord = Prisma.GpuTaskLockGetPayload<{
  select: typeof GPU_TASK_LOCK_SELECT;
}>;

export type BenchmarkTemplateRecord = Prisma.ProjectTemplateGetPayload<{
  select: typeof BENCHMARK_TEMPLATE_SELECT;
}>;

export type CharacterLoraTrainingJobCreateInput = {
  slug: string;
  characterName: string;
  triggerToken: string;
  status: "draft";
  phase?: string | null;
  trainingScope: Prisma.InputJsonValue;
  captionStrategy: string;
  baseCheckpointName?: string | null;
  baseCheckpointPath?: string | null;
  baseCheckpointHash?: string | null;
  baseFamily?: string | null;
  artifactRoot: string;
  trainingTemplateId?: string | null;
  trainingTemplateSnapshot?: Prisma.InputJsonValue | null;
  createdBy?: string | null;
};

export type CharacterLoraTrainingJobUpdateInput = Partial<{
  characterName: string;
  triggerToken: string;
  status: CharacterLoraJobStatus;
  phase: string | null;
  trainingScope: Prisma.InputJsonValue;
  captionStrategy: string;
  baseCheckpointName: string | null;
  baseCheckpointPath: string | null;
  baseCheckpointHash: string | null;
  baseFamily: string | null;
  trainingTemplateId: string | null;
  trainingTemplateSnapshot: Prisma.InputJsonValue | null;
  createdBy: string | null;
}>;

export type CharacterLoraTrainingJobListFilters = {
  q?: string;
  status?: CharacterLoraJobStatus;
  page?: number;
  pageSize?: number;
};

export type CharacterLoraTrainingTemplateUpsertInput = {
  key: string;
  name: string;
  description?: string | null;
  baseFamily?: string | null;
  captionStrategyDefault: string;
  canonicalDefaults: Prisma.InputJsonValue;
  promptCardDefaults: Prisma.InputJsonValue;
  trainingDefaults: Prisma.InputJsonValue;
  benchmarkDefaults: Prisma.InputJsonValue;
  promotionDefaults: Prisma.InputJsonValue;
  isActive: boolean;
  sortOrder: number;
};

export type CharacterLoraJobSectionStatusPatch = "paused" | "active";

export type CharacterLoraBenchmarkCleanupBlocker = {
  code: string;
  message: string;
  details?: unknown;
};

export type CharacterLoraSourceImageCreateInput = {
  jobId: string;
  role: string;
  relativePath: string;
  absolutePath?: string | null;
  sha256: string;
  byteSize?: bigint | number | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  provenance?: Prisma.InputJsonValue | null;
  sortOrder?: number;
  artifactMetadata?: Prisma.InputJsonValue | null;
};

export type CharacterLoraCandidateImageListFilters = {
  jobId: string;
  sectionId?: string;
  generationRunId?: string;
  reviewStatus?: CharacterLoraImageReviewStatus;
};

export type CharacterLoraDatasetItemCreateInput = {
  candidateImageId: string;
  imageArtifactId: string;
  captionArtifactId: string;
  captionText: string;
  repeatCount: number;
  sourceWeight?: number | null;
  sortOrder: number;
};

export type CharacterLoraDatasetRevisionCreateInput = {
  revisionId: string;
  jobId: string;
  version: number;
  canonicalVersionId: string;
  promptCardVersionId: string;
  captionStrategy: string;
  trainDir: string;
  sourceCount: number;
  syntheticCount: number;
  selectedManifestArtifactId: string;
  metadataJsonlArtifactId: string;
  captionAuditArtifactId: string;
  items: CharacterLoraDatasetItemCreateInput[];
};

export type CharacterLoraSectionTemplateUpsertInput = {
  trainingTemplateId?: string | null;
  key: string;
  name: string;
  description?: string | null;
  angleTag?: string | null;
  promptTemplate: string;
  negativeTemplate?: string | null;
  targetCandidateCount: number;
  targetKeepCount: number;
  sortOrder: number;
  isActive: boolean;
};

export type CharacterLoraSectionTemplateCopyCreateInput = {
  trainingTemplateId?: string | null;
  key: string;
  name: string;
  description?: string | null;
  angleTag?: string | null;
  promptTemplate: string;
  negativeTemplate?: string | null;
  targetCandidateCount: number;
  targetKeepCount: number;
  sortOrder: number;
};
