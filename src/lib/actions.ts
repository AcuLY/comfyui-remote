"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildManagedTrashPath,
  moveManagedImageFile,
} from "@/server/services/image-file-service";
import {
  enqueueJobRuns as enqueueJobRunsRepo,
  enqueueJobPositionRun as enqueueJobPositionRunRepo,
  copyJob as copyJobRepo,
} from "@/server/repositories/job-repository";

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
      trashRecord: {
        select: { originalPath: true, restoredAt: true },
      },
    },
  });

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
      trashRecord: {
        select: { originalPath: true, restoredAt: true, trashPath: true },
      },
    },
  });

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

  revalidatePath("/queue");
  revalidatePath("/trash");
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

  revalidatePath("/trash");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 运行整个大任务
// ---------------------------------------------------------------------------

export async function runJob(jobId: string) {
  await enqueueJobRunsRepo(jobId);
  revalidatePath("/jobs");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 运行单个 Position
// ---------------------------------------------------------------------------

export async function runPosition(jobPositionId: string) {
  // 需要先拿到 jobId，因为 repository 函数需要它
  const pos = await prisma.completeJobPosition.findUnique({
    where: { id: jobPositionId },
    select: { completeJobId: true },
  });

  if (!pos) return;

  await enqueueJobPositionRunRepo(pos.completeJobId, jobPositionId);
  revalidatePath("/jobs");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 创建大任务
// ---------------------------------------------------------------------------

export type CreateJobInput = {
  title: string;
  characterId: string;
  scenePresetId: string | null;
  stylePresetId: string | null;
  characterPrompt: string;
  characterLoraPath: string;
  scenePrompt: string | null;
  stylePrompt: string | null;
  notes: string | null;
  positions: {
    positionTemplateId: string;
    sortOrder: number;
    enabled: boolean;
    aspectRatio: string | null;
    batchSize: number | null;
    seedPolicy: string | null;
  }[];
};

export async function createJob(input: CreateJobInput): Promise<string> {
  // 生成唯一 slug
  const baseSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "untitled";
  let slug = baseSlug;
  let i = 1;
  while (await prisma.completeJob.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const job = await prisma.completeJob.create({
    data: {
      title: input.title,
      slug,
      status: "draft",
      characterId: input.characterId,
      scenePresetId: input.scenePresetId,
      stylePresetId: input.stylePresetId,
      characterPrompt: input.characterPrompt,
      characterLoraPath: input.characterLoraPath,
      scenePrompt: input.scenePrompt,
      stylePrompt: input.stylePrompt,
      notes: input.notes,
      positions: {
        create: input.positions.map((pos) => ({
          positionTemplateId: pos.positionTemplateId,
          sortOrder: pos.sortOrder,
          enabled: pos.enabled,
          aspectRatio: pos.aspectRatio,
          batchSize: pos.batchSize,
          seedPolicy: pos.seedPolicy,
        })),
      },
    },
  });

  revalidatePath("/jobs");
  return job.id;
}

// ---------------------------------------------------------------------------
// 更新大任务
// ---------------------------------------------------------------------------

export type UpdateJobInput = {
  jobId: string;
  title?: string;
  characterId?: string;
  scenePresetId?: string | null;
  stylePresetId?: string | null;
  characterPrompt?: string;
  characterLoraPath?: string;
  scenePrompt?: string | null;
  stylePrompt?: string | null;
  notes?: string | null;
  positions?: {
    positionTemplateId: string;
    sortOrder: number;
    enabled: boolean;
    positivePrompt?: string | null;
    negativePrompt?: string | null;
    aspectRatio?: string | null;
    batchSize?: number | null;
    seedPolicy?: string | null;
  }[];
};

export async function updateJob(input: UpdateJobInput) {
  const { jobId, positions, ...jobData } = input;

  // 更新 job 基础字段
  await prisma.completeJob.update({
    where: { id: jobId },
    data: jobData,
  });

  // 如果传了 positions，删除旧的并重建
  if (positions) {
    await prisma.completeJobPosition.deleteMany({
      where: { completeJobId: jobId },
    });

    await prisma.completeJobPosition.createMany({
      data: positions.map((pos) => ({
        completeJobId: jobId,
        positionTemplateId: pos.positionTemplateId,
        sortOrder: pos.sortOrder,
        enabled: pos.enabled,
        positivePrompt: pos.positivePrompt ?? null,
        negativePrompt: pos.negativePrompt ?? null,
        aspectRatio: pos.aspectRatio ?? null,
        batchSize: pos.batchSize ?? null,
        seedPolicy: pos.seedPolicy ?? null,
      })),
    });
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// 复制大任务
// ---------------------------------------------------------------------------

export async function copyJob(jobId: string): Promise<string | null> {
  const newJob = await copyJobRepo(jobId);
  revalidatePath("/jobs");
  return newJob.id;
}

// ---------------------------------------------------------------------------
// LoRA 上传
// ---------------------------------------------------------------------------

const LORA_CATEGORIES = ["characters", "styles", "poses", "misc"] as const;
type LoraCategory = (typeof LORA_CATEGORIES)[number];

export async function uploadLora(formData: FormData) {
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string;

  if (!file || !file.name) {
    throw new Error("请选择文件");
  }

  if (!LORA_CATEGORIES.includes(category as LoraCategory)) {
    throw new Error("无效的分类");
  }

  const fileName = file.name;
  const relativePath = `${category}/${fileName}`;

  // 基础路径（可通过 env 配置）
  const basePath = process.env.LORA_BASE_PATH ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data/assets/loras");
  const absolutePath = path.join(basePath, relativePath);

  // 确保目录存在并写入文件
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  // 登记到数据库
  await prisma.loraAsset.upsert({
    where: { absolutePath },
    create: {
      name: fileName,
      category,
      fileName,
      absolutePath,
      relativePath,
      size: file.size,
      source: "upload",
    },
    update: {
      name: fileName,
      size: file.size,
      source: "upload",
      updatedAt: new Date(),
    },
  });

  revalidatePath("/assets/loras");
}

// ---------------------------------------------------------------------------
// Character CRUD
// ---------------------------------------------------------------------------

export type CharacterInput = {
  name: string;
  slug: string;
  prompt: string;
  loraPath: string;
  notes?: string | null;
  isActive?: boolean;
};

export async function createCharacter(input: CharacterInput) {
  await prisma.character.create({ data: input });
  revalidatePath("/settings/characters");
  revalidatePath("/jobs/new");
}

export async function updateCharacter(id: string, input: Partial<CharacterInput>) {
  await prisma.character.update({ where: { id }, data: input });
  revalidatePath("/settings/characters");
  revalidatePath("/jobs/new");
}

export async function deleteCharacter(id: string) {
  // Soft delete: set isActive = false
  await prisma.character.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/settings/characters");
  revalidatePath("/jobs/new");
}

// ---------------------------------------------------------------------------
// Scene Preset CRUD
// ---------------------------------------------------------------------------

export type ScenePresetInput = {
  name: string;
  slug: string;
  prompt: string;
  notes?: string | null;
  isActive?: boolean;
};

export async function createScenePreset(input: ScenePresetInput) {
  await prisma.scenePreset.create({ data: input });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

export async function updateScenePreset(id: string, input: Partial<ScenePresetInput>) {
  await prisma.scenePreset.update({ where: { id }, data: input });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

export async function deleteScenePreset(id: string) {
  await prisma.scenePreset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

// ---------------------------------------------------------------------------
// Style Preset CRUD
// ---------------------------------------------------------------------------

export type StylePresetInput = {
  name: string;
  slug: string;
  prompt: string;
  notes?: string | null;
  isActive?: boolean;
};

export async function createStylePreset(input: StylePresetInput) {
  await prisma.stylePreset.create({ data: input });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

export async function updateStylePreset(id: string, input: Partial<StylePresetInput>) {
  await prisma.stylePreset.update({ where: { id }, data: input });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

export async function deleteStylePreset(id: string) {
  await prisma.stylePreset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

// ---------------------------------------------------------------------------
// Position Template CRUD
// ---------------------------------------------------------------------------

export type PositionTemplateInput = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  defaultAspectRatio?: string | null;
  defaultBatchSize?: number | null;
  defaultSeedPolicy?: string | null;
  workflowTemplateId?: string | null;
  enabled?: boolean;
};

function buildDefaultParams(
  workflowTemplateId: string | null | undefined,
  existingDefaultParams?: unknown,
): Record<string, unknown> | undefined {
  const existing =
    existingDefaultParams && typeof existingDefaultParams === "object" && !Array.isArray(existingDefaultParams)
      ? { ...(existingDefaultParams as Record<string, unknown>) }
      : {};

  if (workflowTemplateId) {
    existing.workflowTemplateId = workflowTemplateId;
  } else {
    delete existing.workflowTemplateId;
  }

  return Object.keys(existing).length > 0 ? existing : undefined;
}

function toInputJson(value: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined {
  if (value === undefined) return undefined;
  // Round-trip through JSON to produce a Prisma-compatible InputJsonObject
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

export async function createPositionTemplate(input: PositionTemplateInput) {
  const { workflowTemplateId, ...rest } = input;
  const defaultParams = toInputJson(buildDefaultParams(workflowTemplateId));
  await prisma.positionTemplate.create({
    data: {
      ...rest,
      ...(defaultParams !== undefined ? { defaultParams } : {}),
    },
  });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}

export async function updatePositionTemplate(id: string, input: Partial<PositionTemplateInput>) {
  const { workflowTemplateId, ...rest } = input;
  const existingTemplate = await prisma.positionTemplate.findUnique({
    where: { id },
    select: { defaultParams: true },
  });
  const defaultParams = toInputJson(buildDefaultParams(workflowTemplateId, existingTemplate?.defaultParams));
  await prisma.positionTemplate.update({
    where: { id },
    data: {
      ...rest,
      ...(defaultParams !== undefined ? { defaultParams } : {}),
    },
  });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}

export async function deletePositionTemplate(id: string) {
  await prisma.positionTemplate.update({ where: { id }, data: { enabled: false } });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}
