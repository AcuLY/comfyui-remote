import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
  CharacterLoraRunStatus,
  CharacterLoraWorkerType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CharacterLoraArtifactKind } from "@/server/character-lora-training/contracts";

import { toInputJsonValue } from "./helpers";
import {
  serializeSourceImage,
  serializeArtifactRef,
  serializeGenerationRun,
  serializeCandidateImage,
} from "./serializers";
import {
  SOURCE_IMAGE_SELECT,
  ARTIFACT_REF_SELECT,
  GENERATION_RUN_SUMMARY_SELECT,
  CANDIDATE_IMAGE_SELECT,
  type CharacterLoraSourceImageCreateInput,
} from "./types";

export async function listCharacterLoraSourceImages(jobId: string) {
  const sourceImages = await db.characterLoraSourceImage.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImages.map(serializeSourceImage);
}

export async function getCharacterLoraSourceImage(sourceImageId: string) {
  const sourceImage = await db.characterLoraSourceImage.findUnique({
    where: { id: sourceImageId },
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImage ? serializeSourceImage(sourceImage) : null;
}

export async function listCharacterLoraSourceImagesByIds(jobId: string, sourceImageIds: string[]) {
  if (sourceImageIds.length === 0) {
    return [];
  }

  const sourceImages = await db.characterLoraSourceImage.findMany({
    where: {
      jobId,
      id: { in: sourceImageIds },
    },
    select: SOURCE_IMAGE_SELECT,
  });

  return sourceImages.map(serializeSourceImage);
}

export async function findCharacterLoraSourceImageDuplicate(input: {
  jobId: string;
  sha256: string;
  role: string;
}) {
  return db.characterLoraSourceImage.findUnique({
    where: {
      jobId_sha256_role: {
        jobId: input.jobId,
        sha256: input.sha256,
        role: input.role,
      },
    },
    select: { id: true },
  });
}

export async function createCharacterLoraSourceImage(input: CharacterLoraSourceImageCreateInput) {
  const sourceImage = await db.$transaction(async (tx) => {
    const artifact = await tx.characterLoraArtifact.create({
      data: {
        jobId: input.jobId,
        kind: "source_image",
        relativePath: input.relativePath,
        absolutePath: input.absolutePath,
        sha256: input.sha256,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        redactionLevel: "path_only",
        metadata: input.artifactMetadata ?? Prisma.DbNull,
      },
      select: { id: true },
    });

    return tx.characterLoraSourceImage.create({
      data: {
        jobId: input.jobId,
        role: input.role,
        artifactId: artifact.id,
        filePath: input.relativePath,
        sha256: input.sha256,
        width: input.width ?? null,
        height: input.height ?? null,
        provenance: input.provenance ?? Prisma.DbNull,
        sortOrder: input.sortOrder ?? 0,
      },
      select: SOURCE_IMAGE_SELECT,
    });
  });

  return serializeSourceImage(sourceImage);
}

export async function registerCharacterLoraSourceImageAsCandidate(input: {
  jobId: string;
  sourceImageId: string;
  reviewStatus?: CharacterLoraImageReviewStatus;
  captionDraft?: string | null;
}) {
  const result = await db.$transaction(async (tx) => {
    const sourceImage = await tx.characterLoraSourceImage.findUnique({
      where: { id: input.sourceImageId },
      select: {
        ...SOURCE_IMAGE_SELECT,
        job: {
          select: {
            id: true,
            characterName: true,
            triggerToken: true,
          },
        },
      },
    });

    if (!sourceImage || sourceImage.jobId !== input.jobId) {
      throw new Error("Source image not found for this character LoRA job");
    }

    const artifact = await tx.characterLoraArtifact.findUnique({
      where: { id: sourceImage.artifactId },
      select: ARTIFACT_REF_SELECT,
    });

    if (!artifact || artifact.jobId !== input.jobId || artifact.kind !== "source_image") {
      throw new Error("Source image artifact must belong to the job and have kind source_image");
    }

    const existingCandidate = await tx.characterLoraCandidateImage.findFirst({
      where: {
        jobId: input.jobId,
        artifactId: sourceImage.artifactId,
      },
      select: CANDIDATE_IMAGE_SELECT,
    });

    if (existingCandidate) {
      return {
        candidate: existingCandidate,
        generationRun: null,
        created: false,
      };
    }

    const now = new Date();
    const run = await tx.characterLoraGenerationRun.create({
      data: {
        id: randomUUID(),
        jobId: input.jobId,
        sectionId: null,
        kind: "source_candidate",
        status: CharacterLoraRunStatus.done,
        provider: "mock-local",
        hostModel: "mock-local",
        imageModel: "source-image-import",
        hostInstruction: "Register an uploaded source image as a reviewable dataset candidate.",
        visualPrompt: `${sourceImage.job.triggerToken}, ${sourceImage.job.characterName}, source training anchor`,
        negativePrompt: null,
        toolParams: toInputJsonValue({
          origin: "source_candidate",
          mode: "register_source_image",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
        }),
        inputImages: toInputJsonValue({
          origin: "source_candidate",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
          artifactId: sourceImage.artifactId,
          relativePath: sourceImage.filePath,
          sha256: sourceImage.sha256,
        }),
        responseSummary: toInputJsonValue({
          origin: "source_candidate",
          sourceImageId: sourceImage.id,
          sourceRole: sourceImage.role,
          artifactId: sourceImage.artifactId,
          relativePath: sourceImage.filePath,
          registeredAt: now.toISOString(),
        }),
        startedAt: now,
        finishedAt: now,
      },
      select: GENERATION_RUN_SUMMARY_SELECT,
    });

    const candidate = await tx.characterLoraCandidateImage.create({
      data: {
        jobId: input.jobId,
        sectionId: null,
        generationRunId: run.id,
        artifactId: sourceImage.artifactId,
        filePath: sourceImage.filePath,
        sha256: sourceImage.sha256,
        width: sourceImage.width,
        height: sourceImage.height,
        fileSize: artifact.byteSize,
        reviewStatus: input.reviewStatus ?? CharacterLoraImageReviewStatus.pending,
        captionDraft: input.captionDraft ?? `${sourceImage.job.triggerToken}, ${sourceImage.job.characterName}, source reference, ${sourceImage.role}`,
        reviewedAt: null,
      },
      select: CANDIDATE_IMAGE_SELECT,
    });

    await tx.characterLoraTrainingJob.update({
      where: { id: input.jobId },
      data: { status: CharacterLoraJobStatus.reviewing, phase: "review" },
      select: { id: true },
    });

    return {
      candidate,
      generationRun: run,
      created: true,
    };
  });

  return {
    candidate: serializeCandidateImage(result.candidate),
    generationRun: result.generationRun ? serializeGenerationRun(result.generationRun) : null,
    created: result.created,
  };
}

export async function createCharacterLoraJobArtifact(input: {
  jobId: string;
  kind: CharacterLoraArtifactKind;
  relativePath: string;
  absolutePath?: string | null;
  sha256?: string | null;
  byteSize?: bigint | number | null;
  mimeType?: string | null;
  redactionLevel?: string;
  metadata?: Prisma.InputJsonValue | null;
}) {
  return db.characterLoraArtifact.create({
    data: {
      jobId: input.jobId,
      kind: input.kind,
      relativePath: input.relativePath,
      absolutePath: input.absolutePath,
      sha256: input.sha256,
      byteSize: input.byteSize,
      mimeType: input.mimeType,
      redactionLevel: input.redactionLevel ?? "path_only",
      metadata: input.metadata ?? Prisma.DbNull,
    },
    select: { id: true },
  });
}

export async function getCharacterLoraArtifact(artifactId: string) {
  const artifact = await db.characterLoraArtifact.findUnique({
    where: { id: artifactId },
    select: ARTIFACT_REF_SELECT,
  });

  return artifact ? serializeArtifactRef(artifact) : null;
}

export async function getCharacterLoraGenerationRun(generationRunId: string) {
  const run = await db.characterLoraGenerationRun.findUnique({
    where: { id: generationRunId },
    select: GENERATION_RUN_SUMMARY_SELECT,
  });

  return run ? serializeGenerationRun(run) : null;
}
