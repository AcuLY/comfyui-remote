"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildManagedTrashPath,
  moveManagedImageFile,
} from "@/server/services/image-file-service";

// ---------------------------------------------------------------------------
// 审核操作：保留图片
// ---------------------------------------------------------------------------

export async function keepImages(imageIds: string[]) {
  if (imageIds.length === 0) return;

  const images = await prisma.imageResult.findMany({
    where: { id: { in: imageIds } },
    select: {
      id: true,
      filePath: true,
      run: { select: { projectSectionId: true, projectSection: { select: { projectId: true } } } },
      trashRecord: {
        select: { originalPath: true, restoredAt: true },
      },
    },
  });

  // 收集需要 revalidate 的 section results 路径
  const sectionPaths = new Set<string>();
  for (const img of images) {
    if (img.run) {
      sectionPaths.add(
        `/projects/${img.run.projectSection.projectId}/sections/${img.run.projectSectionId}/results`,
      );
    }
  }

  const now = new Date();

  // 如果图片在回收站中，先移回原始位置
  const plans = await Promise.all(
    images.map(async (img) => {
      const activeTrash =
        img.trashRecord && !img.trashRecord.restoredAt ? img.trashRecord : null;
      const nextFilePath = activeTrash ? activeTrash.originalPath : img.filePath;

      if (activeTrash) {
        try {
          await moveManagedImageFile(img.filePath, nextFilePath);
        } catch {
          // 文件移动失败不阻塞 DB 更新
        }
      }

      return { imageId: img.id, nextFilePath, hadTrash: !!activeTrash };
    }),
  );

  await prisma.$transaction([
    ...plans.map((plan) =>
      prisma.imageResult.update({
        where: { id: plan.imageId },
        data: {
          filePath: plan.nextFilePath,
          reviewStatus: "kept",
          reviewedAt: now,
        },
      }),
    ),
    // 标记所有活跃 trash record 为已恢复
    prisma.trashRecord.updateMany({
      where: {
        imageResultId: { in: imageIds },
        restoredAt: null,
      },
      data: { restoredAt: now },
    }),
  ]);

  for (const p of sectionPaths) revalidatePath(p);
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 审核操作：删除图片（移入回收站）
// ---------------------------------------------------------------------------

export async function trashImages(imageIds: string[]) {
  if (imageIds.length === 0) return;

  const images = await prisma.imageResult.findMany({
    where: { id: { in: imageIds } },
    select: {
      id: true,
      filePath: true,
      run: { select: { projectSectionId: true, projectSection: { select: { projectId: true } } } },
      trashRecord: {
        select: { originalPath: true, restoredAt: true, trashPath: true },
      },
    },
  });

  // 收集需要 revalidate 的 section results 路径
  const sectionPaths = new Set<string>();
  for (const img of images) {
    if (img.run) {
      sectionPaths.add(
        `/projects/${img.run.projectSection.projectId}/sections/${img.run.projectSectionId}/results`,
      );
    }
  }

  const now = new Date();

  // 1. 计算每张图的 trash path 并移动文件
  const plans = await Promise.all(
    images.map(async (img) => {
      const activeTrash =
        img.trashRecord && !img.trashRecord.restoredAt ? img.trashRecord : null;
      const originalPath = activeTrash ? activeTrash.originalPath : img.filePath;
      const trashPath = activeTrash
        ? activeTrash.trashPath
        : buildManagedTrashPath(img.id, originalPath);

      let moveStatus: "moved" | "skipped" | "missing" = "skipped";
      try {
        moveStatus = await moveManagedImageFile(img.filePath, trashPath);
      } catch {
        // 文件移动失败不阻塞 DB 更新——可能文件本就不在 data/images 下
      }

      return { imageId: img.id, originalPath, trashPath, nextFilePath: trashPath, moveStatus };
    }),
  );

  // 2. 批量更新 DB
  await prisma.$transaction([
    ...plans.map((plan) =>
      prisma.imageResult.update({
        where: { id: plan.imageId },
        data: {
          filePath: plan.nextFilePath,
          reviewStatus: "trashed",
          reviewedAt: now,
        },
      }),
    ),
    ...plans.map((plan) =>
      prisma.trashRecord.upsert({
        where: { imageResultId: plan.imageId },
        create: {
          imageResultId: plan.imageId,
          originalPath: plan.originalPath,
          trashPath: plan.trashPath,
          actorType: "user",
          deletedAt: now,
        },
        update: {
          originalPath: plan.originalPath,
          trashPath: plan.trashPath,
          deletedAt: now,
          restoredAt: null,
          actorType: "user",
        },
      }),
    ),
  ]);

  for (const p of sectionPaths) revalidatePath(p);
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 恢复图片
// ---------------------------------------------------------------------------

export async function restoreImage(trashRecordId: string) {
  const record = await prisma.trashRecord.findUnique({
    where: { id: trashRecordId },
    select: {
      imageResultId: true,
      originalPath: true,
      trashPath: true,
      restoredAt: true,
      imageResult: { select: { filePath: true } },
    },
  });

  if (!record || record.restoredAt) return;

  const now = new Date();

  // 1. 将文件从回收站移回原始位置
  try {
    await moveManagedImageFile(record.imageResult.filePath, record.originalPath);
  } catch {
    // 文件移动失败不阻塞 DB 更新
  }

  // 2. 更新 DB
  await prisma.$transaction([
    prisma.trashRecord.update({
      where: { id: trashRecordId },
      data: { restoredAt: now },
    }),
    prisma.imageResult.update({
      where: { id: record.imageResultId },
      data: {
        filePath: record.originalPath,
        reviewStatus: "pending",
        reviewedAt: null,
      },
    }),
  ]);

  revalidatePath("/queue");
}
