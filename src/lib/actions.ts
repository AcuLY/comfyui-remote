"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
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
  // 获取任务下所有启用的 position（含模板信息用于快照）
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      positions: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
        include: { positionTemplate: true },
      },
    },
  });

  if (!job) return;

  // 为每个启用的 position 创建 PositionRun，快照包含完整配置
  const runs = await prisma.$transaction(
    job.positions.map((pos) =>
      prisma.positionRun.create({
        data: {
          completeJobId: jobId,
          completeJobPositionId: pos.id,
          status: "queued",
          resolvedConfigSnapshot: {
            positionTemplateId: pos.positionTemplateId,
            positionName: pos.positionTemplate.name,
            batchSize: pos.batchSize ?? pos.positionTemplate.defaultBatchSize ?? 1,
            aspectRatio: pos.aspectRatio ?? pos.positionTemplate.defaultAspectRatio ?? "3:4",
            seedPolicy: pos.seedPolicy ?? pos.positionTemplate.defaultSeedPolicy ?? "random",
            characterPrompt: job.characterPrompt,
            characterLoraPath: job.characterLoraPath,
            scenePrompt: job.scenePrompt,
            stylePrompt: job.stylePrompt,
            positionPrompt: pos.positionTemplate.prompt,
            negativePrompt: pos.negativePrompt ?? pos.positionTemplate.negativePrompt,
            positivePromptOverride: pos.positivePrompt,
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
    include: {
      positionTemplate: true,
      completeJob: true,
    },
  });

  if (!pos) return;

  const job = pos.completeJob;
  const tmpl = pos.positionTemplate;

  const run = await prisma.positionRun.create({
    data: {
      completeJobId: pos.completeJobId,
      completeJobPositionId: pos.id,
      status: "queued",
      resolvedConfigSnapshot: {
        positionTemplateId: pos.positionTemplateId,
        positionName: tmpl.name,
        batchSize: pos.batchSize ?? tmpl.defaultBatchSize ?? 1,
        aspectRatio: pos.aspectRatio ?? tmpl.defaultAspectRatio ?? "3:4",
        seedPolicy: pos.seedPolicy ?? tmpl.defaultSeedPolicy ?? "random",
        characterPrompt: job.characterPrompt,
        characterLoraPath: job.characterLoraPath,
        scenePrompt: job.scenePrompt,
        stylePrompt: job.stylePrompt,
        positionPrompt: tmpl.prompt,
        negativePrompt: pos.negativePrompt ?? tmpl.negativePrompt,
        positivePromptOverride: pos.positivePrompt,
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
  enabled?: boolean;
};

export async function createPositionTemplate(input: PositionTemplateInput) {
  await prisma.positionTemplate.create({ data: input });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}

export async function updatePositionTemplate(id: string, input: Partial<PositionTemplateInput>) {
  await prisma.positionTemplate.update({ where: { id }, data: input });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}

export async function deletePositionTemplate(id: string) {
  await prisma.positionTemplate.update({ where: { id }, data: { enabled: false } });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}
