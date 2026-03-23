import { db } from "@/lib/db";
import { ActorType, ReviewStatus } from "@/generated/prisma";

type ReviewableImage = {
  id: string;
  filePath: string;
};

async function ensureRunExists(runId: string) {
  const run = await db.positionRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });

  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }
}

async function getRunImages(runId: string, imageIds: string[]): Promise<ReviewableImage[]> {
  const images = await db.imageResult.findMany({
    where: {
      id: { in: imageIds },
      positionRunId: runId,
    },
    select: {
      id: true,
      filePath: true,
    },
  });

  if (images.length !== imageIds.length) {
    throw new Error("IMAGES_NOT_FOUND");
  }

  return images;
}

export async function keepRunImages(runId: string, imageIds: string[]) {
  await ensureRunExists(runId);
  const images = await getRunImages(runId, imageIds);
  const reviewedAt = new Date();

  await db.$transaction([
    db.imageResult.updateMany({
      where: {
        id: { in: imageIds },
        positionRunId: runId,
      },
      data: {
        reviewStatus: ReviewStatus.kept,
        reviewedAt,
      },
    }),
    db.trashRecord.updateMany({
      where: {
        imageResultId: { in: imageIds },
        restoredAt: null,
      },
      data: {
        restoredAt: reviewedAt,
      },
    }),
  ]);

  return {
    runId,
    updatedCount: images.length,
    imageIds,
    reviewStatus: ReviewStatus.kept,
    reviewedAt,
  };
}

export async function trashRunImages(runId: string, imageIds: string[], reason?: string) {
  await ensureRunExists(runId);
  const images = await getRunImages(runId, imageIds);
  const reviewedAt = new Date();
  const deletedAt = reviewedAt;

  await db.$transaction([
    db.imageResult.updateMany({
      where: {
        id: { in: imageIds },
        positionRunId: runId,
      },
      data: {
        reviewStatus: ReviewStatus.trashed,
        reviewedAt,
      },
    }),
    ...images.map((image) =>
      db.trashRecord.upsert({
        where: { imageResultId: image.id },
        update: {
          originalPath: image.filePath,
          trashPath: image.filePath,
          reason: reason ?? null,
          actorType: ActorType.user,
          deletedAt,
          restoredAt: null,
        },
        create: {
          imageResultId: image.id,
          originalPath: image.filePath,
          trashPath: image.filePath,
          reason: reason ?? null,
          actorType: ActorType.user,
          deletedAt,
        },
      }),
    ),
  ]);

  return {
    runId,
    updatedCount: images.length,
    imageIds,
    reviewStatus: ReviewStatus.trashed,
    reviewedAt,
  };
}

export async function restoreImage(imageId: string) {
  const image = await db.imageResult.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      trashRecord: {
        select: {
          id: true,
          restoredAt: true,
        },
      },
    },
  });

  if (!image) {
    throw new Error("IMAGE_NOT_FOUND");
  }

  if (!image.trashRecord || image.trashRecord.restoredAt) {
    throw new Error("TRASH_RECORD_NOT_FOUND");
  }

  const reviewedAt = new Date();
  const restoredAt = reviewedAt;

  await db.$transaction([
    db.imageResult.update({
      where: { id: imageId },
      data: {
        reviewStatus: ReviewStatus.pending,
        reviewedAt,
      },
    }),
    db.trashRecord.update({
      where: { imageResultId: imageId },
      data: { restoredAt },
    }),
  ]);

  return {
    imageId,
    reviewStatus: ReviewStatus.pending,
    reviewedAt,
    restoredAt,
  };
}
