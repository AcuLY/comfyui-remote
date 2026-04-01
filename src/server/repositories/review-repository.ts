import { db } from "@/lib/db";
import { toImageUrl } from "@/lib/image-url";
import { ActorType, ReviewStatus } from "@/lib/db-enums";
import {
  buildManagedTrashPath,
  type ManagedImageMoveStatus,
  moveManagedImageFile,
} from "@/server/services/image-file-service";

type ReviewableImage = {
  id: string;
  filePath: string;
  trashRecord: {
    originalPath: string;
    restoredAt: Date | null;
    trashPath: string;
  } | null;
};

type ImagePathChangePlan = {
  currentPath: string;
  imageId: string;
  moveStatus: ManagedImageMoveStatus;
  nextFilePath: string;
};

type TrashPlan = ImagePathChangePlan & {
  originalPath: string;
  trashPath: string;
};

async function getRunReviewBase(runId: string) {
  const run = await db.positionRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      runIndex: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      outputDir: true,
      errorMessage: true,
      comfyPromptId: true,
      resolvedConfigSnapshot: true,
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          presetBindings: true,
        },
      },
      projectSection: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
      images: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          filePath: true,
          thumbPath: true,
          width: true,
          height: true,
          fileSize: true,
          reviewStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  return run;
}

export async function getRunReviewGroup(runId: string) {
  const run = await getRunReviewBase(runId);

  // Resolve preset names from presetBindings
  type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;
  const bindings = run.project.presetBindings as PresetBindingJson | null;
  const presetNames: string[] = [];
  if (bindings && bindings.length > 0) {
    const presetIds = bindings.map((b) => b.presetId);
    const presets = await db.preset.findMany({
      where: { id: { in: presetIds } },
      select: { id: true, name: true },
    });
    for (const preset of presets) {
      presetNames.push(preset.name);
    }
  }

  const images = run.images.map((image, index) => ({
    id: image.id,
    src: toImageUrl(image.thumbPath ?? image.filePath) ?? "",
    label: String(index + 1).padStart(2, "0"),
    status: image.reviewStatus,
  }));

  return {
    id: run.id,
    projectId: run.project.id,
    sectionId: run.projectSection.id,
    title: run.project.title,
    presetNames,
    sectionName: run.projectSection.name ?? "Unknown",
    createdAt: run.createdAt,
    pendingCount: images.filter((image) => image.status === ReviewStatus.pending).length,
    totalCount: images.length,
    images,
  };
}

export async function getRunAgentContext(runId: string) {
  const run = await getRunReviewBase(runId);

  // Resolve preset info from presetBindings
  type PresetBindingJson2 = Array<{ categoryId: string; presetId: string }>;
  const bindings2 = run.project.presetBindings as PresetBindingJson2 | null;
  const presetInfos: { id: string; name: string; slug: string }[] = [];
  if (bindings2 && bindings2.length > 0) {
    const presetIds = bindings2.map((b) => b.presetId);
    const presets = await db.preset.findMany({
      where: { id: { in: presetIds } },
      select: { id: true, name: true, slug: true },
    });
    for (const preset of presets) {
      presetInfos.push({ id: preset.id, name: preset.name, slug: preset.slug });
    }
  }

  const imageSummary = run.images.reduce(
    (summary, image) => {
      summary.totalCount += 1;
      summary[`${image.reviewStatus}Count` as "pendingCount" | "keptCount" | "trashedCount"] += 1;
      return summary;
    },
    {
      totalCount: 0,
      pendingCount: 0,
      keptCount: 0,
      trashedCount: 0,
    },
  );

  return {
    run: {
      id: run.id,
      runIndex: run.runIndex,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      outputDir: run.outputDir,
      errorMessage: run.errorMessage,
      comfyPromptId: run.comfyPromptId,
      resolvedConfigSnapshot: run.resolvedConfigSnapshot,
    },
    project: {
      id: run.project.id,
      title: run.project.title,
      slug: run.project.slug,
      status: run.project.status,
      presets: presetInfos,
    },
    section: {
      id: run.projectSection.id,
      sortOrder: run.projectSection.sortOrder,
      template: null,
    },
    summary: imageSummary,
    images: run.images.map((image, index) => ({
      id: image.id,
      index,
      label: String(index + 1).padStart(2, "0"),
      reviewStatus: image.reviewStatus,
      filePath: image.filePath,
      thumbPath: image.thumbPath,
      width: image.width,
      height: image.height,
      fileSize: image.fileSize,
      createdAt: image.createdAt.toISOString(),
    })),
  };
}

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
      trashRecord: {
        select: {
          originalPath: true,
          restoredAt: true,
          trashPath: true,
        },
      },
    },
  });

  if (images.length !== imageIds.length) {
    throw new Error("IMAGES_NOT_FOUND");
  }

  return images;
}

function getActiveTrashRecord(image: ReviewableImage) {
  if (!image.trashRecord || image.trashRecord.restoredAt) {
    return null;
  }

  return image.trashRecord;
}

async function rollbackFileMoves(plans: ImagePathChangePlan[]) {
  for (const plan of [...plans].reverse()) {
    if (plan.moveStatus !== "moved") {
      continue;
    }

    try {
      await moveManagedImageFile(plan.nextFilePath, plan.currentPath);
    } catch {
      // Best-effort rollback only.
    }
  }
}

async function prepareKeepPlans(images: ReviewableImage[]) {
  const plans: ImagePathChangePlan[] = [];

  try {
    for (const image of images) {
      const activeTrashRecord = getActiveTrashRecord(image);
      const nextFilePath = activeTrashRecord ? activeTrashRecord.originalPath : image.filePath;
      const moveStatus = activeTrashRecord
        ? await moveManagedImageFile(image.filePath, nextFilePath)
        : "skipped";

      plans.push({
        imageId: image.id,
        currentPath: image.filePath,
        nextFilePath,
        moveStatus,
      });
    }
  } catch (error) {
    await rollbackFileMoves(plans);
    throw error;
  }

  return plans;
}

async function prepareTrashPlans(images: ReviewableImage[]) {
  const plans: TrashPlan[] = [];

  try {
    for (const image of images) {
      const activeTrashRecord = getActiveTrashRecord(image);
      const originalPath = activeTrashRecord ? activeTrashRecord.originalPath : image.filePath;
      const trashPath = activeTrashRecord
        ? activeTrashRecord.trashPath
        : buildManagedTrashPath(image.id, originalPath);
      const moveStatus = await moveManagedImageFile(image.filePath, trashPath);

      plans.push({
        imageId: image.id,
        currentPath: image.filePath,
        nextFilePath: trashPath,
        moveStatus,
        originalPath,
        trashPath,
      });
    }
  } catch (error) {
    await rollbackFileMoves(plans);
    throw error;
  }

  return plans;
}

export async function keepRunImages(runId: string, imageIds: string[]) {
  await ensureRunExists(runId);
  const images = await getRunImages(runId, imageIds);
  const reviewedAt = new Date();
  const plans = await prepareKeepPlans(images);

  try {
    await db.$transaction([
      ...plans.map((plan) =>
        db.imageResult.update({
          where: { id: plan.imageId },
          data: {
            filePath: plan.nextFilePath,
            reviewStatus: ReviewStatus.kept,
            reviewedAt,
          },
        }),
      ),
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
  } catch (error) {
    await rollbackFileMoves(plans);
    throw error;
  }

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
  const plans = await prepareTrashPlans(images);

  try {
    await db.$transaction([
      ...plans.map((plan) =>
        db.imageResult.update({
          where: { id: plan.imageId },
          data: {
            filePath: plan.nextFilePath,
            reviewStatus: ReviewStatus.trashed,
            reviewedAt,
          },
        }),
      ),
      ...plans.map((plan) =>
        db.trashRecord.upsert({
          where: { imageResultId: plan.imageId },
          update: {
            originalPath: plan.originalPath,
            trashPath: plan.trashPath,
            reason: reason ?? null,
            actorType: ActorType.user,
            deletedAt,
            restoredAt: null,
          },
          create: {
            imageResultId: plan.imageId,
            originalPath: plan.originalPath,
            trashPath: plan.trashPath,
            reason: reason ?? null,
            actorType: ActorType.user,
            deletedAt,
          },
        }),
      ),
    ]);
  } catch (error) {
    await rollbackFileMoves(plans);
    throw error;
  }

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
      filePath: true,
      trashRecord: {
        select: {
          originalPath: true,
          id: true,
          restoredAt: true,
          trashPath: true,
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
  const plan: ImagePathChangePlan = {
    imageId,
    currentPath: image.filePath,
    nextFilePath: image.trashRecord.originalPath,
    moveStatus: await moveManagedImageFile(image.filePath, image.trashRecord.originalPath),
  };

  try {
    await db.$transaction([
      db.imageResult.update({
        where: { id: imageId },
        data: {
          filePath: plan.nextFilePath,
          reviewStatus: ReviewStatus.pending,
          reviewedAt,
        },
      }),
      db.trashRecord.update({
        where: { imageResultId: imageId },
        data: { restoredAt },
      }),
    ]);
  } catch (error) {
    await rollbackFileMoves([plan]);
    throw error;
  }

  return {
    imageId,
    reviewStatus: ReviewStatus.pending,
    reviewedAt,
    restoredAt,
  };
}
