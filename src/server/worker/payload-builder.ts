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

function composePositivePrompt(snapshot: NormalizedResolvedConfigSnapshot) {
  return [
    snapshot.character.prompt,
    snapshot.scene?.prompt,
    snapshot.style?.prompt,
    snapshot.position.templatePrompt,
    snapshot.position.positivePrompt,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(", ");
}

export function normalizeResolvedConfigSnapshot(
  snapshot: WorkerRunSnapshot["resolvedConfigSnapshot"],
): NormalizedResolvedConfigSnapshot {
  const root = asJsonObject(snapshot);
  const job = asJsonObject(root?.job ?? null);
  const character = asJsonObject(root?.character ?? null);
  const scene = asJsonObject(root?.scene ?? null);
  const style = asJsonObject(root?.style ?? null);
  const position = asJsonObject(root?.position ?? null);
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
    job: {
      id: asString(job?.id),
      title: asString(job?.title),
      slug: asString(job?.slug),
    },
    character: {
      id: asString(character?.id),
      name: asString(character?.name),
      slug: asString(character?.slug),
      prompt: asString(character?.prompt),
      loraPath: asString(character?.loraPath),
    },
    scene: scene
      ? {
          id: asString(scene.id),
          name: asString(scene.name),
          slug: asString(scene.slug),
          prompt: asNullableString(scene.prompt),
        }
      : null,
    style: style
      ? {
          id: asString(style.id),
          name: asString(style.name),
          slug: asString(style.slug),
          prompt: asNullableString(style.prompt),
        }
      : null,
    position: {
      id: asString(position?.id),
      templateId: asString(position?.templateId),
      name: asString(position?.name),
      slug: asString(position?.slug),
      templatePrompt: asString(position?.templatePrompt),
      positivePrompt: asNullableString(position?.positivePrompt),
      negativePrompt: asNullableString(position?.negativePrompt),
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
    },
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
  const negative = resolvedConfig.composedPrompt?.negative ?? resolvedConfig.position.negativePrompt;

  return {
    clientId: `run-${run.runId}`,
    workflowId: run.workflowId,
    prompt: {
      positive,
      negative,
    },
    parameters: resolvedConfig.parameters,
    ksampler1: resolvedConfig.ksampler1,
    ksampler2: resolvedConfig.ksampler2,
    loraConfig: resolvedConfig.loraConfig,
    extraParams: resolvedConfig.extraParams,
    metadata: {
      runId: run.runId,
      runIndex: run.runIndex,
      jobId: resolvedConfig.job.id || run.job.id,
      jobTitle: resolvedConfig.job.title || run.job.title,
      positionId: resolvedConfig.position.id || run.position.id,
      positionName: resolvedConfig.position.name || run.position.name,
    },
  };
}
