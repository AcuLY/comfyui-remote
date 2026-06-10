import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { runAutoCensorMosaicBatch } from "@/server/services/auto-censor-runner";

const log = createLogger({ module: "censoring" });
const THUMBNAIL_WIDTH = 300;

type ImageResultForCensor = {
  id: string;
  filePath: string;
  reviewStatus: string;
};

type ProcessCensorTaskInput = {
  imageResultId: string;
  taskId?: string;
};

export type ProcessCensorTaskResult = {
  detections?: number;
  error?: string;
  imageResultId: string;
  persisted: boolean;
  selectedDetections?: number;
  taskId?: string;
};

type PreparedCensorTask = {
  imageResult: ImageResultForCensor;
  input: ProcessCensorTaskInput;
  tempOutputPath: string;
};

type PreparedCensorTaskWithIndex = {
  inputIndex: number;
  task: PreparedCensorTask;
};

type PersistedCensoredImage = {
  censoredAt: Date;
  censoredFilePath: string;
  censoredThumbPath: string;
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
): Promise<PersistedCensoredImage> {
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

  const updatedImage = await prisma.imageResult.update({
    where: { id: imageResult.id },
    data: {
      censoredFilePath,
      censoredThumbPath,
      censoredAt: new Date(),
    },
    select: {
      censoredAt: true,
    },
  });

  return { censoredAt: updatedImage.censoredAt!, censoredFilePath, censoredThumbPath };
}

function normalizeProcessCensorTaskInput(
  input: string | ProcessCensorTaskInput,
): ProcessCensorTaskInput {
  if (typeof input === "string") {
    return { imageResultId: input };
  }

  return input;
}

async function shouldPersistForTaskContext(taskId: string | undefined): Promise<boolean> {
  if (!taskId) return true;

  const task = await prisma.censoringTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

  if (task?.status !== "running") {
    log.info("Skipping censored image persistence for inactive task", {
      taskId,
      status: task?.status ?? "missing",
    });
    return false;
  }

  return true;
}

function taskResult(
  input: ProcessCensorTaskInput,
  result: Omit<ProcessCensorTaskResult, "imageResultId" | "taskId">,
): ProcessCensorTaskResult {
  return {
    imageResultId: input.imageResultId,
    taskId: input.taskId,
    ...result,
  };
}

async function prepareCensorTask(
  input: ProcessCensorTaskInput,
): Promise<PreparedCensorTask | ProcessCensorTaskResult> {
  const imageResult = await prisma.imageResult.findUnique({
    where: { id: input.imageResultId },
    select: {
      id: true,
      filePath: true,
      reviewStatus: true,
    },
  });

  if (!imageResult) {
    return taskResult(input, {
      persisted: false,
      error: `ImageResult not found: ${input.imageResultId}`,
    });
  }

  if (imageResult.reviewStatus !== "kept" && imageResult.reviewStatus !== "pending") {
    return taskResult(input, {
      persisted: false,
      error: `ImageResult ${input.imageResultId} has status "${imageResult.reviewStatus}", expected "kept" or "pending"`,
    });
  }

  const sourceAbsPath = resolve(process.cwd(), imageResult.filePath);
  try {
    await access(sourceAbsPath);
  } catch (error) {
    return taskResult(input, {
      persisted: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const tempOutputPath = `data/images/.tmp/auto-censor-${imageResult.id}-${randomUUID()}.png`;
  await mkdir(dirname(resolve(process.cwd(), tempOutputPath)), { recursive: true });

  return {
    imageResult,
    input,
    tempOutputPath,
  };
}

function isPreparedCensorTask(
  value: PreparedCensorTask | ProcessCensorTaskResult,
): value is PreparedCensorTask {
  return "imageResult" in value;
}

export async function processCensorTasksBatch(
  rawInputs: Array<string | ProcessCensorTaskInput>,
): Promise<ProcessCensorTaskResult[]> {
  const inputs = rawInputs.map(normalizeProcessCensorTaskInput);
  const preparedResults = await Promise.all(inputs.map(prepareCensorTask));
  const preparedTasks: PreparedCensorTaskWithIndex[] = [];
  const results: Array<ProcessCensorTaskResult | undefined> = new Array(inputs.length);

  for (const [index, result] of preparedResults.entries()) {
    if (!isPreparedCensorTask(result)) {
      results[index] = result;
    } else {
      preparedTasks.push({ inputIndex: index, task: result });
    }
  }

  try {
    const runnerResults = await runAutoCensorMosaicBatch(
      preparedTasks.map(({ task }) => ({
        id: task.imageResult.id,
        sourcePath: task.imageResult.filePath,
        outputPath: task.tempOutputPath,
      })),
    );

    for (const [index, { inputIndex, task: preparedTask }] of preparedTasks.entries()) {
      const runnerResult = runnerResults[index];

      if (!runnerResult) {
        results[inputIndex] = taskResult(preparedTask.input, {
          persisted: false,
          error: "Auto-censor batch did not return a result for this image.",
        });
        continue;
      }

      if (!runnerResult.ok) {
        results[inputIndex] = taskResult(preparedTask.input, {
          persisted: false,
          error: runnerResult.error,
        });
        continue;
      }

      if (!(await shouldPersistForTaskContext(preparedTask.input.taskId))) {
        results[inputIndex] = taskResult(preparedTask.input, {
          persisted: false,
        });
        continue;
      }

      const { censoredFilePath } = await persistCensoredImage(
        preparedTask.imageResult,
        preparedTask.tempOutputPath,
      );

      log.info("Censoring complete", {
        imageResultId: preparedTask.imageResult.id,
        detections: runnerResult.detections,
        selectedDetections: runnerResult.selectedDetections,
        censoredFilePath,
      });

      results[inputIndex] = taskResult(preparedTask.input, {
        detections: runnerResult.detections,
        persisted: true,
        selectedDetections: runnerResult.selectedDetections,
      });
    }
  } finally {
    await Promise.all(
      preparedTasks.map(({ task }) => (
        unlink(resolve(process.cwd(), task.tempOutputPath)).catch(() => {})
      )),
    );
  }

  return inputs.map((input, index) => (
    results[index] ??
    taskResult(input, {
      persisted: false,
      error: "Auto-censor batch did not produce a result.",
    })
  ));
}

export async function processCensorTask(
  input: string | ProcessCensorTaskInput,
): Promise<ProcessCensorTaskResult> {
  const { imageResultId, taskId } = normalizeProcessCensorTaskInput(input);
  const [result] = await processCensorTasksBatch([
    {
      imageResultId,
      taskId,
    },
  ]);

  if (!result) {
    throw new Error(`Auto-censor batch returned no result for ImageResult ${imageResultId}`);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

export async function censorSingleImage(imageResultId: string): Promise<void> {
  await processCensorTask(imageResultId);
}

export async function persistManualCensoredImage(
  imageResultId: string,
  manualCensoredImage: Buffer,
): Promise<PersistedCensoredImage> {
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
    throw new Error(`ImageResult ${imageResultId} has status "${imageResult.reviewStatus}", expected "kept" or "pending"`);
  }

  const manualCensoredImagePath = `data/images/.tmp/manual-censor-${imageResult.id}-${randomUUID()}.jpg`;
  const manualCensoredImageAbsPath = resolve(process.cwd(), manualCensoredImagePath);
  await mkdir(dirname(manualCensoredImageAbsPath), { recursive: true });
  await writeFile(manualCensoredImageAbsPath, manualCensoredImage);

  try {
    return await persistCensoredImage(imageResult, manualCensoredImagePath);
  } finally {
    await unlink(manualCensoredImageAbsPath).catch(() => {});
  }
}
