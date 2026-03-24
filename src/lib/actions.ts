"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function toNullableJsonInput(value: Prisma.JsonValue | null | undefined) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

// ---------------------------------------------------------------------------
// 审核操作：保留图片
// ---------------------------------------------------------------------------

export async function keepImages(imageIds: string[]) {
  if (imageIds.length === 0) return;

  await prisma.imageResult.updateMany({
    where: { id: { in: imageIds } },
    data: { reviewStatus: "kept", reviewedAt: new Date() },
  });

  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 审核操作：删除图片（移入回收站）
// ---------------------------------------------------------------------------

export async function trashImages(imageIds: string[]) {
  if (imageIds.length === 0) return;

  const images = await prisma.imageResult.findMany({
    where: { id: { in: imageIds } },
    select: { id: true, filePath: true },
  });

  // 批量创建 TrashRecord + 更新 reviewStatus
  await prisma.$transaction(
    images.map((img) =>
      prisma.trashRecord.upsert({
        where: { imageResultId: img.id },
        create: {
          imageResultId: img.id,
          originalPath: img.filePath,
          trashPath: img.filePath.replace("/raw/", "/.trash/"),
          actorType: "user",
        },
        update: {
          deletedAt: new Date(),
          restoredAt: null,
          actorType: "user",
        },
      })
    )
  );

  await prisma.imageResult.updateMany({
    where: { id: { in: imageIds } },
    data: { reviewStatus: "trashed", reviewedAt: new Date() },
  });

  revalidatePath("/queue");
  revalidatePath("/trash");
}

// ---------------------------------------------------------------------------
// 恢复图片
// ---------------------------------------------------------------------------

export async function restoreImage(trashRecordId: string) {
  const record = await prisma.trashRecord.findUnique({
    where: { id: trashRecordId },
    select: { imageResultId: true },
  });

  if (!record) return;

  await prisma.$transaction([
    prisma.trashRecord.update({
      where: { id: trashRecordId },
      data: { restoredAt: new Date() },
    }),
    prisma.imageResult.update({
      where: { id: record.imageResultId },
      data: { reviewStatus: "pending", reviewedAt: null },
    }),
  ]);

  revalidatePath("/trash");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 运行整个大任务
// ---------------------------------------------------------------------------

export async function runJob(jobId: string) {
  // 获取任务下所有启用的 position
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      positions: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!job) return;

  // 为每个启用的 position 创建 PositionRun
  const runs = await prisma.$transaction(
    job.positions.map((pos) =>
      prisma.positionRun.create({
        data: {
          completeJobId: jobId,
          completeJobPositionId: pos.id,
          status: "queued",
          resolvedConfigSnapshot: {
            positionTemplateId: pos.positionTemplateId,
            batchSize: pos.batchSize,
            aspectRatio: pos.aspectRatio,
            loraConfig: pos.loraConfig,
            extraParams: pos.extraParams,
          },
        },
      })
    )
  );

  // 更新 job 状态为 queued
  await prisma.completeJob.update({
    where: { id: jobId },
    data: { status: "queued" },
  });

  // 更新每个 position 的 latestRunId
  await prisma.$transaction(
    runs.map((run, i) =>
      prisma.completeJobPosition.update({
        where: { id: job.positions[i].id },
        data: { latestRunId: run.id },
      })
    )
  );

  revalidatePath("/jobs");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 运行单个 Position
// ---------------------------------------------------------------------------

export async function runPosition(jobPositionId: string) {
  const pos = await prisma.completeJobPosition.findUnique({
    where: { id: jobPositionId },
    select: {
      id: true,
      completeJobId: true,
      positionTemplateId: true,
      batchSize: true,
      aspectRatio: true,
      loraConfig: true,
      extraParams: true,
    },
  });

  if (!pos) return;

  const run = await prisma.positionRun.create({
    data: {
      completeJobId: pos.completeJobId,
      completeJobPositionId: pos.id,
      status: "queued",
      resolvedConfigSnapshot: {
        positionTemplateId: pos.positionTemplateId,
        batchSize: pos.batchSize,
        aspectRatio: pos.aspectRatio,
        loraConfig: pos.loraConfig,
        extraParams: pos.extraParams,
      },
    },
  });

  await prisma.completeJobPosition.update({
    where: { id: pos.id },
    data: { latestRunId: run.id },
  });

  revalidatePath("/jobs");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 复制大任务
// ---------------------------------------------------------------------------

export async function copyJob(jobId: string): Promise<string | null> {
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      positions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!job) return null;

  // 生成唯一 slug
  const baseSlug = `${job.slug}-copy`;
  let slug = baseSlug;
  let i = 1;
  while (await prisma.completeJob.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const newJob = await prisma.completeJob.create({
    data: {
      title: `${job.title} (副本)`,
      slug,
      status: "draft",
      characterId: job.characterId,
      scenePresetId: job.scenePresetId,
      stylePresetId: job.stylePresetId,
      characterPrompt: job.characterPrompt,
      characterLoraPath: job.characterLoraPath,
      scenePrompt: job.scenePrompt,
      stylePrompt: job.stylePrompt,
      jobLevelOverrides: toNullableJsonInput(job.jobLevelOverrides),
      notes: job.notes,
      positions: {
        create: job.positions.map((pos) => ({
          positionTemplateId: pos.positionTemplateId,
          sortOrder: pos.sortOrder,
          enabled: pos.enabled,
          positivePrompt: pos.positivePrompt,
          negativePrompt: pos.negativePrompt,
          aspectRatio: pos.aspectRatio,
          batchSize: pos.batchSize,
          seedPolicy: pos.seedPolicy,
          loraConfig: toNullableJsonInput(pos.loraConfig),
          extraParams: toNullableJsonInput(pos.extraParams),
        })),
      },
    },
  });

  revalidatePath("/jobs");
  return newJob.id;
}
