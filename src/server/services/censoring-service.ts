import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { runAutoCensorMosaic } from "@/server/services/auto-censor-runner";

const log = createLogger({ module: "censoring" });
const THUMBNAIL_WIDTH = 300;

type ImageResultForCensor = {
  id: string;
  filePath: string;
  reviewStatus: string;
};

async function atomicWriteFile(targetPath: string, data: Buffer): Promise<void> {
  const tempPath = `${targetPath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, data);

  try {
    await unlink(targetPath);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      await unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function safeFileNameForSource(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter(Boolean);
  const fileName = segments.length > 0 ? segments[segments.length - 1] : "";
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "image.jpg";
}

function censoredPathsForSource(filePath: string): {
  censoredFilePath: string;
  censoredThumbPath: string;
} {
  if (filePath.includes("/raw/")) {
    return {
      censoredFilePath: filePath.replace("/raw/", "/censored/"),
      censoredThumbPath: filePath.replace("/raw/", "/censored-thumb/"),
    };
  }

  const fallbackId = randomUUID();
  const fileName = safeFileNameForSource(filePath);
  return {
    censoredFilePath: `data/images/censored/${fallbackId}/${fileName}`,
    censoredThumbPath: `data/images/censored-thumb/${fallbackId}/${fileName}`,
  };
}

async function persistCensoredImage(
  imageResult: ImageResultForCensor,
  sourceImagePath: string,
): Promise<{ censoredFilePath: string; censoredThumbPath: string }> {
  const { censoredFilePath, censoredThumbPath } = censoredPathsForSource(
    imageResult.filePath,
  );

  const jpegBuffer = await sharp(resolve(process.cwd(), sourceImagePath))
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer();

  const censoredAbsPath = resolve(process.cwd(), censoredFilePath);
  await mkdir(dirname(censoredAbsPath), { recursive: true });
  await atomicWriteFile(censoredAbsPath, jpegBuffer);

  const thumbBuffer = await sharp(jpegBuffer)
    .resize({ width: THUMBNAIL_WIDTH })
    .jpeg({ quality: 80 })
    .toBuffer();

  const censoredThumbAbsPath = resolve(process.cwd(), censoredThumbPath);
  await mkdir(dirname(censoredThumbAbsPath), { recursive: true });
  await atomicWriteFile(censoredThumbAbsPath, thumbBuffer);

  await prisma.imageResult.update({
    where: { id: imageResult.id },
    data: {
      censoredFilePath,
      censoredThumbPath,
      censoredAt: new Date(),
    },
  });

  return { censoredFilePath, censoredThumbPath };
}

export async function processCensorTask(imageResultId: string): Promise<void> {
  const imageResult = await prisma.imageResult.findUnique({
    where: { id: imageResultId },
    select: {
      id: true,
      filePath: true,
      reviewStatus: true,
    },
  });

  if (!imageResult) {
    throw new Error(`ImageResult not found: ${imageResultId}`);
  }

  if (imageResult.reviewStatus !== "kept" && imageResult.reviewStatus !== "pending") {
    throw new Error(
      `ImageResult ${imageResultId} has status "${imageResult.reviewStatus}", expected "kept" or "pending"`,
    );
  }

  const sourceAbsPath = resolve(process.cwd(), imageResult.filePath);
  await access(sourceAbsPath);

  const tempOutputPath = `data/images/.tmp/auto-censor-${imageResult.id}-${randomUUID()}.png`;
  await mkdir(dirname(resolve(process.cwd(), tempOutputPath)), { recursive: true });

  try {
    const result = await runAutoCensorMosaic({
      sourcePath: imageResult.filePath,
      outputPath: tempOutputPath,
    });

    const { censoredFilePath } = await persistCensoredImage(
      imageResult,
      tempOutputPath,
    );

    log.info("Censoring complete", {
      imageResultId: imageResult.id,
      detections: result.detections,
      selectedDetections: result.selectedDetections,
      censoredFilePath,
    });
  } finally {
    await unlink(resolve(process.cwd(), tempOutputPath)).catch(() => {});
  }
}

export async function censorSingleImage(imageResultId: string): Promise<void> {
  await processCensorTask(imageResultId);
}
