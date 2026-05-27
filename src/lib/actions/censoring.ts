"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  censorSingleImage,
  censorBatchImages,
} from "@/server/services/censoring-service";

export async function censorImage(
  imageResultId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const image = await prisma.imageResult.findUnique({
      where: { id: imageResultId },
    });

    if (!image) {
      return { success: false, message: "图片不存在" };
    }

    if (image.reviewStatus !== "kept") {
      return { success: false, message: "只能对已保留的图片执行打码" };
    }

    await censorSingleImage(imageResultId);

    revalidatePath("/");
    return { success: true, message: "打码完成" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "打码失败";
    return { success: false, message };
  }
}

export type CensoringPreview = {
  totalKept: number;
  alreadyCensored: number;
  needsCensoring: number;
};

export async function getCensoringPreview(
  projectId: string,
): Promise<CensoringPreview> {
  const totalKept = await prisma.imageResult.count({
    where: {
      run: { projectId },
      reviewStatus: "kept",
    },
  });

  const alreadyCensored = await prisma.imageResult.count({
    where: {
      run: { projectId },
      reviewStatus: "kept",
      censoredAt: { not: null },
    },
  });

  return {
    totalKept,
    alreadyCensored,
    needsCensoring: totalKept - alreadyCensored,
  };
}

export async function censorProjectImages(projectId: string): Promise<{
  success: boolean;
  message: string;
  total: number;
  censored: number;
  failed: number;
}> {
  try {
    const images = await prisma.imageResult.findMany({
      where: {
        run: { projectId },
        reviewStatus: "kept",
        censoredAt: null,
      },
      select: { id: true },
    });

    if (images.length === 0) {
      return {
        success: true,
        message: "没有需要打码的图片",
        total: 0,
        censored: 0,
        failed: 0,
      };
    }

    const result = await censorBatchImages(images.map((img) => img.id));

    revalidatePath("/");

    return {
      success: result.failed === 0,
      message:
        result.failed === 0
          ? `成功打码 ${result.success} 张图片`
          : `打码完成：${result.success} 张成功，${result.failed} 张失败`,
      total: images.length,
      censored: result.success,
      failed: result.failed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量打码失败";
    return { success: false, message, total: 0, censored: 0, failed: 0 };
  }
}
