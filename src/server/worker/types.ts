import { Prisma } from "@/generated/prisma";

export type WorkerRunSnapshot = {
  runId: string;
  runIndex: number;
  status: string;
  workflowId: string;
  comfyApiUrl: string;
  outputDir: string | null;
  resolvedConfigSnapshot: Prisma.JsonValue | null;
  project: {
    id: string;
    title: string;
    slug: string;
  };
  section: {
    id: string;
    name: string;
    slug: string;
  };
};

export type NormalizedResolvedConfigSnapshot = {
  project: {
    id: string;
    title: string;
    slug: string;
  };
  section: {
    id: string;
    templateId: string;
    sortOrder: number;
    name: string;
    slug: string;
    templatePrompt: string;
    positivePrompt: string | null;
    negativePrompt: string | null;
  };
  promptBlocks: Array<{
    positive: string;
    negative: string | null;
  }> | null;
  composedPrompt: {
    positive: string;
    negative: string | null;
  } | null;
  parameters: {
    aspectRatio: string | null;
    shortSidePx: number | null;
    batchSize: number | null;
    /** @deprecated Use seedPolicy1 and seedPolicy2 */
    seedPolicy: string | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    upscaleFactor: number | null;
    checkpointName: string | null;
  };
  checkpointName: string | null;
  /** v0.3: KSampler1 parameters (第一阶段) */
  ksampler1: Prisma.JsonObject | null;
  /** v0.3: KSampler2 parameters (高清修复阶段) */
  ksampler2: Prisma.JsonObject | null;
  /** v0.4: Restructured to { lora1, lora2 } */
  loraConfig: Prisma.JsonObject | null;
  extraParams: Prisma.JsonObject | null;
};

export type ComfyPromptDraft = {
  clientId: string;
  workflowId: string;
  prompt: {
    positive: string;
    negative: string | null;
  };
  parameters: {
    aspectRatio: string | null;
    shortSidePx: number | null;
    batchSize: number | null;
    /** @deprecated Use seedPolicy1 and seedPolicy2 */
    seedPolicy: string | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    upscaleFactor: number | null;
    checkpointName: string | null;
  };
  checkpointName: string | null;
  /** v0.3: KSampler1 parameters (第一阶段) */
  ksampler1: Prisma.JsonObject | null;
  /** v0.3: KSampler2 parameters (高清修复阶段) */
  ksampler2: Prisma.JsonObject | null;
  /** v0.4: Restructured to { lora1, lora2 } */
  loraConfig: Prisma.JsonObject | null;
  extraParams: Prisma.JsonObject | null;
  metadata: {
    runId: string;
    runIndex: number;
    projectId: string;
    projectTitle: string;
    sectionId: string;
    sectionName: string;
    sectionSortOrder: number;
  };
};
