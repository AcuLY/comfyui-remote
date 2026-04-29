import { Prisma } from "@/generated/prisma";
import {
  ComfyPromptDraft,
  NormalizedResolvedConfigSnapshot,
  WorkerRunSnapshot,
} from "@/server/worker/types";

function asJsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Prisma.JsonObject;
}

function asString(value: Prisma.JsonValue | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : null;
}

function asNullableInteger(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asNullableNumber(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asInteger(value: Prisma.JsonValue | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function composePositivePrompt(snapshot: NormalizedResolvedConfigSnapshot) {
  return [
    snapshot.section.templatePrompt,
    snapshot.section.positivePrompt,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" BREAK ");
}

export function normalizeResolvedConfigSnapshot(
  snapshot: WorkerRunSnapshot["resolvedConfigSnapshot"],
): NormalizedResolvedConfigSnapshot {
  const root = asJsonObject(snapshot);
  const project = asJsonObject(root?.project ?? null);
  const section = asJsonObject(root?.section ?? null);
  const parameters = asJsonObject(root?.parameters ?? null);
  const composedPrompt = asJsonObject(root?.composedPrompt ?? null);

  // Parse promptBlocks array
  const rawBlocks = root?.promptBlocks;
  let promptBlocks: NormalizedResolvedConfigSnapshot["promptBlocks"] = null;
  if (Array.isArray(rawBlocks)) {
    promptBlocks = rawBlocks.map((block: Prisma.JsonValue) => ({
      positive: asString((block as Record<string, Prisma.JsonValue>)?.positive),
      negative: asNullableString((block as Record<string, Prisma.JsonValue>)?.negative),
    }));
  }

  return {
    project: {
      id: asString(project?.id),
      title: asString(project?.title),
      slug: asString(project?.slug),
    },
    section: {
      id: asString(section?.id),
      templateId: asString(section?.templateId),
      sortOrder: asInteger(section?.sortOrder, 0),
      name: asString(section?.name),
      slug: asString(section?.slug),
      templatePrompt: asString(section?.templatePrompt),
      positivePrompt: asNullableString(section?.positivePrompt),
      negativePrompt: asNullableString(section?.negativePrompt),
    },
    promptBlocks,
    composedPrompt: composedPrompt
      ? {
          positive: asString(composedPrompt.positive),
          negative: asNullableString(composedPrompt.negative),
        }
      : null,
    parameters: {
      aspectRatio: asNullableString(parameters?.aspectRatio),
      shortSidePx: asNullableInteger(parameters?.shortSidePx),
      batchSize: asNullableInteger(parameters?.batchSize),
      seedPolicy: asNullableString(parameters?.seedPolicy),
      seedPolicy1: asNullableString(parameters?.seedPolicy1),
      seedPolicy2: asNullableString(parameters?.seedPolicy2),
      upscaleFactor: asNullableNumber(parameters?.upscaleFactor),
      checkpointName: asNullableString(parameters?.checkpointName),
    },
    checkpointName: asNullableString(root?.checkpointName) ?? asNullableString(parameters?.checkpointName),
    ksampler1: asJsonObject(root?.ksampler1 ?? null),
    ksampler2: asJsonObject(root?.ksampler2 ?? null),
    loraConfig: asJsonObject(root?.loraConfig ?? null),
    extraParams: asJsonObject(root?.extraParams ?? null),
  };
}

export function buildComfyPromptDraft(run: WorkerRunSnapshot): ComfyPromptDraft {
  const resolvedConfig = normalizeResolvedConfigSnapshot(run.resolvedConfigSnapshot);

  // Prefer composedPrompt from blocks (v0.2), fall back to legacy composition
  const positive = resolvedConfig.composedPrompt?.positive ?? composePositivePrompt(resolvedConfig);
  const negative = resolvedConfig.composedPrompt?.negative ?? resolvedConfig.section.negativePrompt;

  return {
    clientId: `run-${run.runId}`,
    workflowId: run.workflowId,
    prompt: {
      positive,
      negative,
    },
    parameters: resolvedConfig.parameters,
    checkpointName: resolvedConfig.checkpointName,
    ksampler1: resolvedConfig.ksampler1,
    ksampler2: resolvedConfig.ksampler2,
    loraConfig: resolvedConfig.loraConfig,
    extraParams: resolvedConfig.extraParams,
    metadata: {
      runId: run.runId,
      runIndex: run.runIndex,
      projectId: resolvedConfig.project.id || run.project.id,
      projectTitle: resolvedConfig.project.title || run.project.title,
      sectionId: resolvedConfig.section.id || run.section.id,
      sectionName: resolvedConfig.section.name || run.section.name,
      sectionSortOrder: resolvedConfig.section.sortOrder,
    },
  };
}
