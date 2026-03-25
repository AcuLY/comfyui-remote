import { Prisma } from "@/generated/prisma";

export type WorkerRunSnapshot = {
  runId: string;
  runIndex: number;
  status: string;
  workflowId: string;
  comfyApiUrl: string;
  outputDir: string | null;
  resolvedConfigSnapshot: Prisma.JsonValue | null;
  job: {
    id: string;
    title: string;
    slug: string;
  };
  position: {
    id: string;
    name: string;
    slug: string;
  };
};

export type NormalizedResolvedConfigSnapshot = {
  job: {
    id: string;
    title: string;
    slug: string;
  };
  character: {
    id: string;
    name: string;
    slug: string;
    prompt: string;
    loraPath: string;
  };
  scene: {
    id: string;
    name: string;
    slug: string;
    prompt: string | null;
  } | null;
  style: {
    id: string;
    name: string;
    slug: string;
    prompt: string | null;
  } | null;
  position: {
    id: string;
    templateId: string;
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
    seedPolicy: string | null;
  };
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
    seedPolicy: string | null;
  };
  loraConfig: Prisma.JsonObject | null;
  extraParams: Prisma.JsonObject | null;
  metadata: {
    runId: string;
    runIndex: number;
    jobId: string;
    jobTitle: string;
    positionId: string;
    positionName: string;
  };
};

export type WorkerRunDraft = {
  runId: string;
  status: string;
  comfyApiUrl: string;
  comfyPromptId: string | null;
  outputDir: string | null;
  resolvedConfig: NormalizedResolvedConfigSnapshot | null;
  promptDraft: ComfyPromptDraft | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type WorkerPassReport = {
  scannedAt: string;
  queuedRunCount: number;
  claimedRunCount: number;
  skippedRunCount: number;
  failedRunCount: number;
  drafts: WorkerRunDraft[];
};
