"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildManagedTrashPath,
  moveManagedImageFile,
} from "@/server/services/image-file-service";
import { saveUploadedLora } from "@/server/services/lora-upload-service";
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

export async function runJob(jobId: string, overrideBatchSize?: number | null) {
  await enqueueJobRunsRepo(jobId, overrideBatchSize ?? undefined);
  revalidatePath("/jobs");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 运行单个 Position
// ---------------------------------------------------------------------------

export async function runPosition(jobPositionId: string, overrideBatchSize?: number | null) {
  // 需要先拿到 jobId，因为 repository 函数需要它
  const pos = await prisma.completeJobPosition.findUnique({
    where: { id: jobPositionId },
    select: { completeJobId: true },
  });

  if (!pos) return;

  await enqueueJobPositionRunRepo(pos.completeJobId, jobPositionId, overrideBatchSize ?? undefined);
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
// LoRA 上传 — 委托给 lora-upload-service（统一使用 LORA_BASE_DIR）
// ---------------------------------------------------------------------------

export async function uploadLora(formData: FormData) {
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string;

  if (!file || !file.name) {
    throw new Error("请选择文件");
  }

  await saveUploadedLora(file, category);

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

// ---------------------------------------------------------------------------
// PromptBlock — 提示词块管理（Server Actions）
// ---------------------------------------------------------------------------

export type PromptBlockData = {
  id: string;
  type: string;
  sourceId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export async function listPositionBlocks(jobPositionId: string): Promise<PromptBlockData[]> {
  const { listPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const blocks = await listPromptBlocks(jobPositionId);
  return blocks;
}

export async function addPositionBlock(
  jobPositionId: string,
  input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
  },
): Promise<PromptBlockData> {
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { PromptBlockType } = await import("@/generated/prisma");
  const { audit } = await import("@/server/services/audit-service");

  const block = await createPromptBlock(jobPositionId, {
    type: input.type as (typeof PromptBlockType)[keyof typeof PromptBlockType],
    label: input.label,
    positive: input.positive,
    negative: input.negative ?? null,
  });
  audit("PromptBlock", block.id, "create", { jobPositionId, type: input.type }, "user" as const);
  return block;
}

export async function updatePositionBlock(
  blockId: string,
  input: {
    label?: string;
    positive?: string;
    negative?: string | null;
  },
): Promise<PromptBlockData> {
  const { updatePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const block = await updatePromptBlock(blockId, input);
  audit("PromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), "user" as const);
  return block;
}

export async function deletePositionBlock(blockId: string): Promise<void> {
  const { deletePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  await deletePromptBlock(blockId);
  audit("PromptBlock", blockId, "delete", {}, "user" as const);
}

export async function reorderPositionBlocks(
  jobPositionId: string,
  blockIds: string[],
): Promise<PromptBlockData[]> {
  const { reorderPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const reordered = await reorderPromptBlocks(jobPositionId, blockIds);
  audit("PromptBlock", jobPositionId, "reorder", { blockIds }, "user" as const);
  return reordered;
}

// ---------------------------------------------------------------------------
// 添加小节（Section）
// ---------------------------------------------------------------------------

export async function addSection(jobId: string, name?: string): Promise<string> {
  // 获取大任务信息以创建初始 PromptBlocks
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      characterId: true,
      scenePresetId: true,
      stylePresetId: true,
      characterPrompt: true,
      scenePrompt: true,
      stylePrompt: true,
      character: {
        select: { id: true, name: true, prompt: true, negativePrompt: true },
      },
      scenePreset: {
        select: { id: true, name: true, prompt: true, negativePrompt: true },
      },
      stylePreset: {
        select: { id: true, name: true, prompt: true, negativePrompt: true },
      },
      _count: { select: { positions: true } },
    },
  });

  if (!job) throw new Error("JOB_NOT_FOUND");

  const sortOrder = job._count.positions + 1;

  // 创建小节（CompleteJobPosition）
  const section = await prisma.completeJobPosition.create({
    data: {
      completeJobId: jobId,
      sortOrder,
      enabled: true,
      name: name || null,
    },
  });

  // 创建初始 PromptBlocks（从大任务的 character/scene/style 复制）
  let blockSortOrder = 0;

  await prisma.promptBlock.create({
    data: {
      completeJobPositionId: section.id,
      type: "character",
      sourceId: job.character.id,
      label: job.character.name,
      positive: job.character.prompt,
      negative: job.character.negativePrompt,
      sortOrder: blockSortOrder++,
    },
  });

  if (job.scenePreset) {
    await prisma.promptBlock.create({
      data: {
        completeJobPositionId: section.id,
        type: "scene",
        sourceId: job.scenePreset.id,
        label: job.scenePreset.name,
        positive: job.scenePreset.prompt,
        negative: job.scenePreset.negativePrompt,
        sortOrder: blockSortOrder++,
      },
    });
  }

  if (job.stylePreset) {
    await prisma.promptBlock.create({
      data: {
        completeJobPositionId: section.id,
        type: "style",
        sourceId: job.stylePreset.id,
        label: job.stylePreset.name,
        positive: job.stylePreset.prompt,
        negative: job.stylePreset.negativePrompt,
        sortOrder: blockSortOrder++,
      },
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  return section.id;
}

// ---------------------------------------------------------------------------
// 重命名小节
// ---------------------------------------------------------------------------

export async function renameSection(sectionId: string, name: string): Promise<void> {
  const section = await prisma.completeJobPosition.findUnique({
    where: { id: sectionId },
    select: { completeJobId: true },
  });
  if (!section) return;

  await prisma.completeJobPosition.update({
    where: { id: sectionId },
    data: { name: name.trim() || null },
  });

  revalidatePath(`/jobs/${section.completeJobId}`);
}

// ---------------------------------------------------------------------------
// 小节排序
// ---------------------------------------------------------------------------

export async function reorderSections(jobId: string, sectionIds: string[]): Promise<void> {
  // 批量更新 sortOrder
  await prisma.$transaction(
    sectionIds.map((id, index) =>
      prisma.completeJobPosition.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidatePath(`/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// 复制小节
// ---------------------------------------------------------------------------

export async function copySection(sectionId: string): Promise<string | null> {
  const section = await prisma.completeJobPosition.findUnique({
    where: { id: sectionId },
    include: {
      promptBlocks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!section) return null;

  // 获取当前任务的小节数量以确定新的 sortOrder
  const count = await prisma.completeJobPosition.count({
    where: { completeJobId: section.completeJobId },
  });

  // 创建新小节
  const newSection = await prisma.completeJobPosition.create({
    data: {
      completeJobId: section.completeJobId,
      positionTemplateId: section.positionTemplateId,
      sortOrder: count + 1,
      enabled: section.enabled,
      name: section.name ? `${section.name} (副本)` : null,
      positivePrompt: section.positivePrompt,
      negativePrompt: section.negativePrompt,
      aspectRatio: section.aspectRatio,
      shortSidePx: section.shortSidePx,
      batchSize: section.batchSize,
      seedPolicy: section.seedPolicy,
      overrideParams: section.overrideParams ?? undefined,
    },
  });

  // 复制所有 PromptBlocks
  if (section.promptBlocks.length > 0) {
    await prisma.promptBlock.createMany({
      data: section.promptBlocks.map((block) => ({
        completeJobPositionId: newSection.id,
        type: block.type,
        sourceId: block.sourceId,
        label: block.label,
        positive: block.positive,
        negative: block.negative,
        sortOrder: block.sortOrder,
      })),
    });
  }

  revalidatePath(`/jobs/${section.completeJobId}`);
  return newSection.id;
}

// ---------------------------------------------------------------------------
// 删除小节
// ---------------------------------------------------------------------------

export async function deleteSection(sectionId: string): Promise<void> {
  const section = await prisma.completeJobPosition.findUnique({
    where: { id: sectionId },
    select: { completeJobId: true },
  });
  if (!section) return;

  // 先删除所有 PromptBlocks
  await prisma.promptBlock.deleteMany({
    where: { completeJobPositionId: sectionId },
  });

  // 再删除小节
  await prisma.completeJobPosition.delete({
    where: { id: sectionId },
  });

  revalidatePath(`/jobs/${section.completeJobId}`);
}
