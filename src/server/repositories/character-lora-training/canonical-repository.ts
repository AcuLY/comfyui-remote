import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraImageGenerationTaskPayload } from "@/server/character-lora-training/contracts";

import { toInputJsonValue } from "./helpers";
import {
  serializeCanonicalVersion,
  serializeGenerationRun,
  serializeJobSummary,
  serializePromptCardVersion,
} from "./serializers";
import {
  CANONICAL_VERSION_SELECT,
  GENERATION_RUN_SUMMARY_SELECT,
  JOB_SUMMARY_SELECT,
  PROMPT_CARD_VERSION_SELECT,
} from "./types";

export async function createCharacterLoraCanonicalGenerationRunWithTask(input: {
  runId: string;
  jobId: string;
  canonicalView?: string | null;
  provider: string;
  hostModel: string;
  imageModel: string;
  hostInstruction: string;
  visualPrompt: string;
  negativePrompt?: string | null;
  toolParams: Prisma.InputJsonValue;
  inputImages: Prisma.InputJsonValue;
  requestArtifact: {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    byteSize: bigint | number;
    metadata: Prisma.InputJsonValue;
  };
  taskPayload: CharacterLoraImageGenerationTaskPayload;
}) {
  const result = await db.$transaction(async (tx) => {
    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "provider_payload",
        relativePath: input.requestArtifact.relativePath,
        absolutePath: input.requestArtifact.absolutePath,
        sha256: input.requestArtifact.sha256,
        byteSize: input.requestArtifact.byteSize,
        mimeType: "application/json",
        redactionLevel: "payload_redacted",
        metadata: input.requestArtifact.metadata,
      },
      select: { id: true },
    });

    const run = await tx.characterLoraGenerationRun.create({
      data: {
        id: input.runId,
        jobId: input.jobId,
        sectionId: null,
        kind: "canonical",
        canonicalView: input.canonicalView ?? null,
        status: CharacterLoraRunStatus.queued,
        provider: input.provider,
        hostModel: input.hostModel,
        imageModel: input.imageModel,
        hostInstruction: input.hostInstruction,
        visualPrompt: input.visualPrompt,
        negativePrompt: input.negativePrompt,
        toolParams: input.toolParams,
        inputImages: input.inputImages,
        requestArtifactId: artifact.id,
      },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    const task = await tx.characterLoraWorkerTask.create({
      data: {
        jobId: input.jobId,
        workerType: CharacterLoraWorkerType.image_generation,
        targetType: "generationRun",
        targetId: run.id,
        status: CharacterLoraRunStatus.queued,
        payload: toInputJsonValue(input.taskPayload),
      },
      select: { id: true },
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        status: CharacterLoraJobStatus.canonical_pending,
        phase: "canonical",
      },
      select: { id: true },
    });

    return {
      run,
      workerTaskId: task.id,
    };
  });

  return {
    ...serializeGenerationRun(result.run),
    workerTaskId: result.workerTaskId,
  };
}

export async function createMockCompletedCanonicalVersion(input: {
  generationRunId: string;
  jobId: string;
  canonicalView?: string | null;
  imageArtifactId: string;
  notes?: string | null;
  responseSummary: Prisma.InputJsonValue;
}) {
  const version = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraCanonicalVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const canonicalVersion = await tx.characterLoraCanonicalVersion.create({
      data: {
        jobId: input.jobId,
        version: (previous?.version ?? 0) + 1,
        status: "candidate",
        canonicalView: input.canonicalView ?? null,
        sourceRunId: input.generationRunId,
        imageArtifactId: input.imageArtifactId,
        notes: input.notes,
      },
      select: CANONICAL_VERSION_SELECT,
    });

    await tx.characterLoraGenerationRun.update({
      where: { id: input.generationRunId },
      data: {
        status: CharacterLoraRunStatus.done,
        responseSummary: input.responseSummary,
        errorSummary: null,
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.characterLoraWorkerTask.updateMany({
      where: {
        targetType: "generationRun",
        targetId: input.generationRunId,
        status: { in: [CharacterLoraRunStatus.queued, CharacterLoraRunStatus.running] },
      },
      data: {
        status: CharacterLoraRunStatus.done,
        errorSummary: null,
      },
    });

    return canonicalVersion;
  });

  return serializeCanonicalVersion(version);
}

export async function createManualCanonicalVersionFromSourceImage(input: {
  jobId: string;
  canonicalView?: string | null;
  imageArtifactId: string;
  notes: string;
}) {
  const version = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraCanonicalVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return tx.characterLoraCanonicalVersion.create({
      data: {
        jobId: input.jobId,
        version: (previous?.version ?? 0) + 1,
        status: "candidate",
        canonicalView: input.canonicalView ?? null,
        sourceRunId: null,
        imageArtifactId: input.imageArtifactId,
        notes: input.notes,
      },
      select: CANONICAL_VERSION_SELECT,
    });
  });

  return serializeCanonicalVersion(version);
}

export async function getCharacterLoraCanonicalVersion(canonicalVersionId: string) {
  const version = await db.characterLoraCanonicalVersion.findUnique({
    where: { id: canonicalVersionId },
    select: CANONICAL_VERSION_SELECT,
  });

  return version ? serializeCanonicalVersion(version) : null;
}

export async function listCharacterLoraCanonicalVersions(jobId: string) {
  const versions = await db.characterLoraCanonicalVersion.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: CANONICAL_VERSION_SELECT,
  });

  return versions.map(serializeCanonicalVersion);
}

export async function rejectCharacterLoraCanonicalVersion(input: {
  jobId: string;
  canonicalVersionId: string;
}) {
  const version = await db.$transaction(async (tx) => {
    const updated = await tx.characterLoraCanonicalVersion.updateMany({
      where: {
        jobId: input.jobId,
        id: input.canonicalVersionId,
        status: "candidate",
      },
      data: {
        status: "rejected",
      },
    });

    if (updated.count !== 1) {
      return null;
    }

    return tx.characterLoraCanonicalVersion.findUnique({
      where: { id: input.canonicalVersionId },
      select: CANONICAL_VERSION_SELECT,
    });
  });

  return version ? serializeCanonicalVersion(version) : null;
}

export async function selectCharacterLoraCanonicalVersion(input: {
  jobId: string;
  canonicalVersionId: string;
}) {
  const result = await db.$transaction(async (tx) => {
    await tx.characterLoraCanonicalVersion.updateMany({
      where: {
        jobId: input.jobId,
        id: { not: input.canonicalVersionId },
        status: "selected",
      },
      data: {
        status: "superseded",
      },
    });

    const canonicalVersion = await tx.characterLoraCanonicalVersion.update({
      where: { id: input.canonicalVersionId },
      data: {
        status: "selected",
        selectedAt: new Date(),
      },
      select: CANONICAL_VERSION_SELECT,
    });

    const job = await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        currentCanonicalVersionId: input.canonicalVersionId,
        status: CharacterLoraJobStatus.prompt_pending,
        phase: "prompt_card",
      },
      select: JOB_SUMMARY_SELECT,
    });

    return { canonicalVersion, job };
  });

  return {
    canonicalVersion: serializeCanonicalVersion(result.canonicalVersion),
    job: serializeJobSummary(result.job),
  };
}

export async function listCharacterLoraPromptCardVersions(jobId: string) {
  const versions = await db.characterLoraPromptCardVersion.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: PROMPT_CARD_VERSION_SELECT,
  });

  return versions.map(serializePromptCardVersion);
}

export async function getCharacterLoraPromptCardVersion(promptCardVersionId: string) {
  const version = await db.characterLoraPromptCardVersion.findUnique({
    where: { id: promptCardVersionId },
    select: PROMPT_CARD_VERSION_SELECT,
  });

  return version ? serializePromptCardVersion(version) : null;
}

export async function createCharacterLoraPromptCardVersion(input: {
  jobId: string;
  canonicalVersionId?: string | null;
  triggerToken: string;
  identityTraits: Prisma.InputJsonValue;
  outfitTraits: Prisma.InputJsonValue;
  negativeTraits?: Prisma.InputJsonValue | null;
  finalPromptDraft: string;
  changeReason?: string | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const previous = await tx.characterLoraPromptCardVersion.findFirst({
      where: { jobId: input.jobId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const promptCard = await tx.characterLoraPromptCardVersion.create({
      data: {
        jobId: input.jobId,
        canonicalVersionId: input.canonicalVersionId ?? null,
        version: (previous?.version ?? 0) + 1,
        triggerToken: input.triggerToken,
        identityTraits: input.identityTraits,
        outfitTraits: input.outfitTraits,
        negativeTraits: input.negativeTraits ?? Prisma.DbNull,
        finalPromptDraft: input.finalPromptDraft,
        changeReason: input.changeReason,
      },
      select: PROMPT_CARD_VERSION_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: {
        currentPromptCardVersionId: promptCard.id,
        status: CharacterLoraJobStatus.section_generating,
        phase: "sections",
      },
      select: { id: true },
    });

    return promptCard;
  });

  return serializePromptCardVersion(result);
}
