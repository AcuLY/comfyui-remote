import { Prisma } from "@/generated/prisma";
import {
  CharacterLoraImageReviewStatus,
  CharacterLoraJobStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { refreshSectionCounts } from "./helpers";
import { serializeDatasetRevision } from "./serializers";
import {
  DATASET_REVISION_SELECT,
  type CharacterLoraDatasetRevisionCreateInput,
} from "./types";

export async function getCharacterLoraDatasetRevision(datasetRevisionId: string) {
  const revision = await db.characterLoraDatasetRevision.findUnique({
    where: { id: datasetRevisionId },
    select: DATASET_REVISION_SELECT,
  });

  return revision ? serializeDatasetRevision(revision) : null;
}

export async function listCharacterLoraDatasetRevisions(jobId: string) {
  const revisions = await db.characterLoraDatasetRevision.findMany({
    where: { jobId },
    orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    select: DATASET_REVISION_SELECT,
  });

  return revisions.map(serializeDatasetRevision);
}

export async function getNextCharacterLoraDatasetRevisionVersion(jobId: string) {
  const previous = await db.characterLoraDatasetRevision.findFirst({
    where: { jobId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (previous?.version ?? 0) + 1;
}

export async function createFrozenCharacterLoraDatasetRevision(input: CharacterLoraDatasetRevisionCreateInput) {
  const result = await db.$transaction(async (tx) => {
    return createFrozenCharacterLoraDatasetRevisionInTx(tx, input);
  });

  return serializeDatasetRevision(result);
}

export async function createFrozenCharacterLoraDatasetRevisionInTx(
  tx: Prisma.TransactionClient,
  input: CharacterLoraDatasetRevisionCreateInput,
) {
  const revision = await tx.characterLoraDatasetRevision.create({
    data: {
      id: input.revisionId,
      jobId: input.jobId,
      version: input.version,
      status: "frozen",
      canonicalVersionId: input.canonicalVersionId,
      promptCardVersionId: input.promptCardVersionId,
      captionStrategy: input.captionStrategy,
      itemCount: input.items.length,
      sourceCount: input.sourceCount,
      syntheticCount: input.syntheticCount,
      selectedManifestArtifactId: input.selectedManifestArtifactId,
      metadataJsonlArtifactId: input.metadataJsonlArtifactId,
      captionAuditArtifactId: input.captionAuditArtifactId,
      trainDir: input.trainDir,
      frozenAt: new Date(),
    },
    select: DATASET_REVISION_SELECT,
  });

  for (const item of input.items) {
    await tx.characterLoraDatasetItem.create({
      data: {
        datasetRevisionId: revision.id,
        candidateImageId: item.candidateImageId,
        imageArtifactId: item.imageArtifactId,
        captionArtifactId: item.captionArtifactId,
        captionText: item.captionText,
        repeatCount: item.repeatCount,
        sourceWeight: item.sourceWeight ?? null,
        sortOrder: item.sortOrder,
      },
      select: { id: true },
    });
  }

  await tx.characterLoraCandidateImage.updateMany({
    where: { id: { in: input.items.map((item) => item.candidateImageId) } },
    data: {
      reviewStatus: CharacterLoraImageReviewStatus.included_in_training,
      includedDatasetRevisionId: revision.id,
    },
  });

  const sectionIds = await tx.characterLoraCandidateImage.findMany({
    where: { id: { in: input.items.map((item) => item.candidateImageId) } },
    distinct: ["sectionId"],
    select: { sectionId: true },
  });

  await refreshSectionCounts(
    tx,
    sectionIds.map((section) => section.sectionId).filter((sectionId): sectionId is string => Boolean(sectionId)),
  );

  await tx.characterLoraTrainingJob.update({
    where: { id: input.jobId },
    data: {
      status: CharacterLoraJobStatus.dataset_ready,
      phase: "dataset",
      selectedDatasetRevisionId: revision.id,
    },
    select: { id: true },
  });

  return revision;
}
