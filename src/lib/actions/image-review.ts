"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  buildManagedTrashPath,
  deleteManagedImageFile,
  moveManagedImageFile,
} from "@/server/services/image-file-service";
import { listSectionTrashItems } from "@/server/repositories/trash-repository";
import { buildGenerationProjectWhere } from "@/server/repositories/legacy-training-resource-boundary";

type ReviewImageMutationOptions = {
  revalidate?: boolean;
};

// ---------------------------------------------------------------------------
// 查询小节回收站
// ---------------------------------------------------------------------------

export async function getSectionTrashItems(sectionId: string) {
  const normalizedSectionId = sectionId.trim();
  if (!normalizedSectionId) {
    throw new Error("SECTION_ID_REQUIRED");
  }

  return listSectionTrashItems(normalizedSectionId);
}

// ---------------------------------------------------------------------------
// 审核操作：保留图片
// ---------------------------------------------------------------------------

export async function keepImages(
  imageIds: string[],
  options: ReviewImageMutationOptions = {},
) {
  const uniqueImageIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueImageIds.length === 0) return;

  const images = await prisma.imageResult.findMany({
    where: {
      id: { in: uniqueImageIds },
      run: { project: buildGenerationProjectWhere() },
    },
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
  const projectPaths = new Set<string>();
  for (const img of images) {
    if (img.run) {
      sectionPaths.add(
        `/projects/${img.run.projectSection.projectId}/sections/${img.run.projectSectionId}/results`,
      );
      projectPaths.add(`/projects/${img.run.projectSection.projectId}`);
      projectPaths.add(`/projects/${img.run.projectSection.projectId}/results`);
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
  const planImageIds = plans.map((plan) => plan.imageId);

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
        imageResultId: { in: planImageIds },
        restoredAt: null,
      },
      data: { restoredAt: now },
    }),
  ]);

  if (options.revalidate !== false) {
    for (const p of sectionPaths) revalidatePath(p);
    for (const p of projectPaths) revalidatePath(p);
    revalidatePath("/queue");
  }
}

// ---------------------------------------------------------------------------
// 审核操作：删除图片（移入回收站）
// ---------------------------------------------------------------------------

export async function trashImages(
  imageIds: string[],
  options: ReviewImageMutationOptions = {},
) {
  const uniqueImageIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueImageIds.length === 0) return { count: 0, imageIds: [] };

  const images = await prisma.imageResult.findMany({
    where: {
      id: { in: uniqueImageIds },
      run: { project: buildGenerationProjectWhere() },
    },
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
  const projectPaths = new Set<string>();
  for (const img of images) {
    if (img.run) {
      sectionPaths.add(
        `/projects/${img.run.projectSection.projectId}/sections/${img.run.projectSectionId}/results`,
      );
      projectPaths.add(`/projects/${img.run.projectSection.projectId}`);
      projectPaths.add(`/projects/${img.run.projectSection.projectId}/results`);
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
    prisma.project.updateMany({
      where: buildGenerationProjectWhere({ coverImageId: { in: plans.map((plan) => plan.imageId) } }),
      data: { coverImageId: null },
    }),
  ]);

  if (options.revalidate !== false) {
    for (const p of sectionPaths) revalidatePath(p);
    for (const p of projectPaths) revalidatePath(p);
    revalidatePath("/queue");
  }

  return { count: plans.length, imageIds: plans.map((plan) => plan.imageId) };
}

export async function trashProjectImages(projectId: string) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("PROJECT_ID_REQUIRED");
  }

  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: normalizedProjectId }),
    select: { id: true },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const images = await prisma.imageResult.findMany({
    where: {
      reviewStatus: { not: "trashed" },
      run: {
        projectId: normalizedProjectId,
        project: buildGenerationProjectWhere({ id: normalizedProjectId }),
      },
    },
    select: { id: true },
  });

  const result = await trashImages(images.map((image) => image.id));
  revalidatePath(`/projects/${normalizedProjectId}`);
  revalidatePath(`/projects/${normalizedProjectId}/results`);

  return {
    projectId: normalizedProjectId,
    trashedCount: result?.count ?? 0,
  };
}

export async function clearTrash(): Promise<{
  ok: boolean;
  count: number;
  fileDeleteFailures: number;
  error?: string;
}> {
  try {
    const records = await prisma.trashRecord.findMany({
      where: {
        restoredAt: null,
        imageResult: { run: { project: buildGenerationProjectWhere() } },
      },
      select: {
        id: true,
        imageResultId: true,
        trashPath: true,
        imageResult: {
          select: {
            filePath: true,
            thumbPath: true,
            run: {
              select: {
                projectId: true,
                projectSectionId: true,
              },
            },
          },
        },
      },
    });

    if (records.length === 0) {
      return { ok: true, count: 0, fileDeleteFailures: 0 };
    }

    const imageIds = records.map((record) => record.imageResultId);
    const filePaths = new Set<string>();
    const sectionPaths = new Set<string>();
    const projectPaths = new Set<string>();

    for (const record of records) {
      filePaths.add(record.trashPath);
      filePaths.add(record.imageResult.filePath);
      if (record.imageResult.thumbPath) {
        filePaths.add(record.imageResult.thumbPath);
      }
      sectionPaths.add(
        `/projects/${record.imageResult.run.projectId}/sections/${record.imageResult.run.projectSectionId}/results`,
      );
      projectPaths.add(`/projects/${record.imageResult.run.projectId}`);
      projectPaths.add(`/projects/${record.imageResult.run.projectId}/results`);
    }

    const deleteResult = await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: buildGenerationProjectWhere({ coverImageId: { in: imageIds } }),
        data: { coverImageId: null },
      });

      await tx.trashRecord.deleteMany({
        where: { imageResultId: { in: imageIds } },
      });

      return tx.imageResult.deleteMany({
        where: { id: { in: imageIds } },
      });
    });

    const results = await Promise.allSettled(
      [...filePaths].map((filePath) => deleteManagedImageFile(filePath)),
    );
    const fileDeleteFailures = results.filter((r) => r.status === "rejected").length;

    for (const p of sectionPaths) revalidatePath(p);
    for (const p of projectPaths) revalidatePath(p);
    revalidatePath("/projects");
    revalidatePath("/queue");

    return {
      ok: true,
      count: deleteResult.count,
      fileDeleteFailures,
    };
  } catch (error) {
    console.error("Failed to clear trash:", error);
    return {
      ok: false,
      count: 0,
      fileDeleteFailures: 0,
      error: "清空回收站失败",
    };
  }
}

// ---------------------------------------------------------------------------
// 恢复图片
// ---------------------------------------------------------------------------

export async function restoreImage(trashRecordId: string) {
  const record = await prisma.trashRecord.findFirst({
    where: {
      id: trashRecordId,
      imageResult: { run: { project: buildGenerationProjectWhere() } },
    },
    select: {
      imageResultId: true,
      originalPath: true,
      trashPath: true,
      restoredAt: true,
      imageResult: {
        select: {
          filePath: true,
          run: {
            select: {
              projectId: true,
              projectSectionId: true,
            },
          },
        },
      },
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

  revalidatePath(`/projects/${record.imageResult.run.projectId}`);
  revalidatePath(`/projects/${record.imageResult.run.projectId}/results`);
  revalidatePath(
    `/projects/${record.imageResult.run.projectId}/sections/${record.imageResult.run.projectSectionId}/results`,
  );
  revalidatePath("/queue");
}
