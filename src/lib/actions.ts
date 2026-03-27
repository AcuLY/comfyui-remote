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
import { executeQueuedRuns } from "@/server/services/run-executor";

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

  // Fire-and-forget: submit queued runs directly to ComfyUI
  executeQueuedRuns().catch(() => {});
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

  // Fire-and-forget: submit queued runs directly to ComfyUI
  executeQueuedRuns().catch(() => {});
}

// ---------------------------------------------------------------------------
// 创建大任务
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string };

export type CreateJobInput = {
  title: string;
  presetBindings: PresetBinding[];
  notes: string | null;
  // Legacy (optional, for backward compat)
  characterId?: string;
  scenePresetId?: string | null;
  stylePresetId?: string | null;
  characterPrompt?: string;
  characterLoraPath?: string;
  scenePrompt?: string | null;
  stylePrompt?: string | null;
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

  // Resolve legacy fields from presetBindings for backward compat
  let characterId = input.characterId ?? "";
  let characterPrompt = input.characterPrompt ?? "";
  let characterLoraPath = input.characterLoraPath ?? "";
  let scenePresetId = input.scenePresetId ?? null;
  let scenePrompt = input.scenePrompt ?? null;
  let stylePresetId = input.stylePresetId ?? null;
  let stylePrompt = input.stylePrompt ?? null;

  if (input.presetBindings.length > 0) {
    // Resolve presets to populate legacy fields
    const presetIds = input.presetBindings.map((b) => b.presetId);
    const presets = await prisma.promptPreset.findMany({
      where: { id: { in: presetIds } },
      include: { category: true },
    });

    const presetMap = new Map(presets.map((p) => [p.id, p]));

    for (const binding of input.presetBindings) {
      const preset = presetMap.get(binding.presetId);
      if (!preset) continue;

      const catSlug = preset.category.slug;
      if (catSlug === "character" && !input.characterId) {
        // Find or use a dummy character for legacy FK compat
        const legacyChar = await prisma.character.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true, loraPath: true },
        });
        if (legacyChar) {
          characterId = legacyChar.id;
          characterPrompt = legacyChar.prompt;
          characterLoraPath = legacyChar.loraPath;
        } else {
          // Fall back: use first character as placeholder
          const firstChar = await prisma.character.findFirst({
            select: { id: true, prompt: true, loraPath: true },
          });
          if (firstChar) {
            characterId = firstChar.id;
            characterPrompt = preset.prompt;
            characterLoraPath = firstChar.loraPath;
          }
        }
      } else if (catSlug === "scene" && !input.scenePresetId) {
        const legacyScene = await prisma.scenePreset.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true },
        });
        if (legacyScene) {
          scenePresetId = legacyScene.id;
          scenePrompt = legacyScene.prompt;
        }
      } else if (catSlug === "style" && !input.stylePresetId) {
        const legacyStyle = await prisma.stylePreset.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true },
        });
        if (legacyStyle) {
          stylePresetId = legacyStyle.id;
          stylePrompt = legacyStyle.prompt;
        }
      }
    }
  }

  if (!characterId) {
    throw new Error("CHARACTER_REQUIRED: must select a preset from character category or provide characterId");
  }

  const job = await prisma.completeJob.create({
    data: {
      title: input.title,
      slug,
      status: "draft",
      characterId,
      scenePresetId,
      stylePresetId,
      characterPrompt,
      characterLoraPath,
      scenePrompt,
      stylePrompt,
      presetBindings: input.presetBindings.length > 0 ? input.presetBindings : undefined,
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
  presetBindings?: PresetBinding[];
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
    seedPolicy1?: string | null;
    seedPolicy2?: string | null;
    ksampler1?: Record<string, unknown> | null;
    ksampler2?: Record<string, unknown> | null;
  }[];
  // 小节默认值覆盖
  jobLevelOverrides?: {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
  };
};

export async function updateJob(input: UpdateJobInput) {
  const { jobId, positions, jobLevelOverrides, presetBindings, ...jobData } = input;

  // If presetBindings provided, resolve legacy fields for backward compat
  const legacyUpdate: Record<string, unknown> = {};
  if (presetBindings && presetBindings.length > 0) {
    const presetIds = presetBindings.map((b) => b.presetId);
    const presets = await prisma.promptPreset.findMany({
      where: { id: { in: presetIds } },
      include: { category: true },
    });
    const presetMap = new Map(presets.map((p) => [p.id, p]));

    for (const binding of presetBindings) {
      const preset = presetMap.get(binding.presetId);
      if (!preset) continue;

      const catSlug = preset.category.slug;
      if (catSlug === "character" && !jobData.characterId) {
        const legacyChar = await prisma.character.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true, loraPath: true },
        });
        if (legacyChar) {
          legacyUpdate.characterId = legacyChar.id;
          legacyUpdate.characterPrompt = legacyChar.prompt;
          legacyUpdate.characterLoraPath = legacyChar.loraPath;
        }
      } else if (catSlug === "scene" && !jobData.scenePresetId) {
        const legacyScene = await prisma.scenePreset.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true },
        });
        if (legacyScene) {
          legacyUpdate.scenePresetId = legacyScene.id;
          legacyUpdate.scenePrompt = legacyScene.prompt;
        } else {
          legacyUpdate.scenePresetId = null;
          legacyUpdate.scenePrompt = null;
        }
      } else if (catSlug === "style" && !jobData.stylePresetId) {
        const legacyStyle = await prisma.stylePreset.findFirst({
          where: { slug: preset.slug },
          select: { id: true, prompt: true },
        });
        if (legacyStyle) {
          legacyUpdate.stylePresetId = legacyStyle.id;
          legacyUpdate.stylePrompt = legacyStyle.prompt;
        } else {
          legacyUpdate.stylePresetId = null;
          legacyUpdate.stylePrompt = null;
        }
      }
    }
  }

  // 更新 job 基础字段（包括 jobLevelOverrides）
  await prisma.completeJob.update({
    where: { id: jobId },
    data: {
      ...jobData,
      ...legacyUpdate,
      ...(presetBindings !== undefined ? { presetBindings } : {}),
      ...(jobLevelOverrides !== undefined ? { jobLevelOverrides } : {}),
    },
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
        seedPolicy1: pos.seedPolicy1 ?? null,
        seedPolicy2: pos.seedPolicy2 ?? null,
        ksampler1: pos.ksampler1 ? (pos.ksampler1 as Prisma.InputJsonValue) : undefined,
        ksampler2: pos.ksampler2 ? (pos.ksampler2 as Prisma.InputJsonValue) : undefined,
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
// JSON 辅助函数
// ---------------------------------------------------------------------------

function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === null) return Prisma.DbNull;
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Character CRUD
// ---------------------------------------------------------------------------

export type CharacterInput = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  loraPath: string;
  loraBindings?: unknown[] | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function createCharacter(input: CharacterInput) {
  const { loraBindings, ...rest } = input;
  await prisma.character.create({
    data: {
      ...rest,
      loraBindings: toJsonValue(loraBindings) ?? Prisma.DbNull,
    },
  });
  revalidatePath("/settings/characters");
  revalidatePath("/jobs/new");
}

export async function updateCharacter(id: string, input: Partial<CharacterInput>) {
  const { loraBindings, ...rest } = input;
  const loraData = toJsonValue(loraBindings);
  await prisma.character.update({
    where: { id },
    data: {
      ...rest,
      ...(loraData !== undefined ? { loraBindings: loraData } : {}),
    },
  });
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
// Scene Preset CRUD (v0.3: loraBindings removed)
// ---------------------------------------------------------------------------

export type ScenePresetInput = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function createScenePreset(input: ScenePresetInput) {
  await prisma.scenePreset.create({
    data: input,
  });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

export async function updateScenePreset(id: string, input: Partial<ScenePresetInput>) {
  await prisma.scenePreset.update({
    where: { id },
    data: input,
  });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

export async function deleteScenePreset(id: string) {
  await prisma.scenePreset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/settings/scenes");
  revalidatePath("/jobs/new");
}

// ---------------------------------------------------------------------------
// Style Preset CRUD (v0.3: loraBindings removed)
// ---------------------------------------------------------------------------

export type StylePresetInput = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function createStylePreset(input: StylePresetInput) {
  await prisma.stylePreset.create({
    data: input,
  });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

export async function updateStylePreset(id: string, input: Partial<StylePresetInput>) {
  await prisma.stylePreset.update({
    where: { id },
    data: input,
  });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

export async function deleteStylePreset(id: string) {
  await prisma.stylePreset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/settings/styles");
  revalidatePath("/jobs/new");
}

// ---------------------------------------------------------------------------
// Position Template CRUD (v0.3: loraBindings → lora1 + lora2)
// ---------------------------------------------------------------------------

export type PositionTemplateInput = {
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  lora1?: unknown[] | null;           // v0.3: replaces loraBindings
  lora2?: unknown[] | null;           // v0.3: new field
  defaultAspectRatio?: string | null;
  defaultBatchSize?: number | null;
  defaultSeedPolicy1?: string | null; // v0.3: replaces defaultSeedPolicy
  defaultSeedPolicy2?: string | null; // v0.3: new field
  defaultKsampler1?: Record<string, unknown> | null;  // v0.3: new field
  defaultKsampler2?: Record<string, unknown> | null;  // v0.3: new field
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
  const { workflowTemplateId, lora1, lora2, defaultKsampler1, defaultKsampler2, ...rest } = input;
  const defaultParams = toInputJson(buildDefaultParams(workflowTemplateId));
  await prisma.positionTemplate.create({
    data: {
      ...rest,
      lora1: toJsonValue(lora1) ?? Prisma.DbNull,
      lora2: toJsonValue(lora2) ?? Prisma.DbNull,
      defaultKsampler1: defaultKsampler1 ? (JSON.parse(JSON.stringify(defaultKsampler1)) as Prisma.InputJsonValue) : Prisma.DbNull,
      defaultKsampler2: defaultKsampler2 ? (JSON.parse(JSON.stringify(defaultKsampler2)) as Prisma.InputJsonValue) : Prisma.DbNull,
      ...(defaultParams !== undefined ? { defaultParams } : {}),
    },
  });
  revalidatePath("/settings/positions");
  revalidatePath("/jobs/new");
}

export async function updatePositionTemplate(id: string, input: Partial<PositionTemplateInput>) {
  const { workflowTemplateId, lora1, lora2, defaultKsampler1, defaultKsampler2, ...rest } = input;
  const existingTemplate = await prisma.positionTemplate.findUnique({
    where: { id },
    select: { defaultParams: true },
  });
  const defaultParams = toInputJson(buildDefaultParams(workflowTemplateId, existingTemplate?.defaultParams));
  const lora1Data = toJsonValue(lora1);
  const lora2Data = toJsonValue(lora2);
  await prisma.positionTemplate.update({
    where: { id },
    data: {
      ...rest,
      ...(lora1Data !== undefined ? { lora1: lora1Data } : {}),
      ...(lora2Data !== undefined ? { lora2: lora2Data } : {}),
      ...(defaultKsampler1 !== undefined ? { defaultKsampler1: defaultKsampler1 ? (JSON.parse(JSON.stringify(defaultKsampler1)) as Prisma.InputJsonValue) : Prisma.DbNull } : {}),
      ...(defaultKsampler2 !== undefined ? { defaultKsampler2: defaultKsampler2 ? (JSON.parse(JSON.stringify(defaultKsampler2)) as Prisma.InputJsonValue) : Prisma.DbNull } : {}),
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

// ---------------------------------------------------------------------------
// PromptCategory CRUD (unified prompt system)
// ---------------------------------------------------------------------------

export type PromptCategoryInput = {
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  positivePromptOrder?: number;
  negativePromptOrder?: number;
  lora1Order?: number;
  lora2Order?: number;
  sortOrder?: number;
};

export async function createPromptCategory(input: PromptCategoryInput) {
  // Auto-assign sortOrder if not provided
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.promptCategory.aggregate({ _max: { sortOrder: true } });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  const cat = await prisma.promptCategory.create({ data: input });
  revalidatePath("/assets/prompts");
  return cat;
}

export async function updatePromptCategory(id: string, input: Partial<PromptCategoryInput>) {
  const cat = await prisma.promptCategory.update({ where: { id }, data: input });
  revalidatePath("/assets/prompts");
  return cat;
}

export async function deletePromptCategory(id: string) {
  // Only allow deletion if no presets exist in this category
  const count = await prisma.promptPreset.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(`分类下还有 ${count} 个模板，请先删除或移动它们`);
  }
  await prisma.promptCategory.delete({ where: { id } });
  revalidatePath("/assets/prompts");
}

export async function reorderPromptCategories(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.promptCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/prompts");
}

// ---------------------------------------------------------------------------
// PromptPreset CRUD (unified prompt system)
// ---------------------------------------------------------------------------

export type PromptPresetInput = {
  categoryId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  lora1?: unknown;
  lora2?: unknown;
  defaultParams?: unknown;
  notes?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export async function createPromptPreset(input: PromptPresetInput) {
  const { lora1, lora2, defaultParams, ...rest } = input;
  if (rest.sortOrder === undefined) {
    const maxOrder = await prisma.promptPreset.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    rest.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  const preset = await prisma.promptPreset.create({
    data: {
      ...rest,
      lora1: toJsonValue(lora1) ?? Prisma.DbNull,
      lora2: toJsonValue(lora2) ?? Prisma.DbNull,
      defaultParams: toJsonValue(defaultParams) ?? Prisma.DbNull,
    },
  });
  revalidatePath("/assets/prompts");
  revalidatePath("/jobs/new");
  return preset;
}

export async function updatePromptPreset(id: string, input: Partial<PromptPresetInput>) {
  const { lora1, lora2, defaultParams, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (defaultParams !== undefined) data.defaultParams = toJsonValue(defaultParams) ?? Prisma.DbNull;

  const preset = await prisma.promptPreset.update({ where: { id }, data });
  revalidatePath("/assets/prompts");
  revalidatePath("/jobs/new");
  return preset;
}

export async function deletePromptPreset(id: string) {
  // Soft delete: set isActive = false
  await prisma.promptPreset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets/prompts");
  revalidatePath("/jobs/new");
}

export async function reorderPromptPresets(categoryId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.promptPreset.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/prompts");
}

// ---------------------------------------------------------------------------
// Prompt Block CRUD
// ---------------------------------------------------------------------------

export type PromptBlockData = {
  id: string;
  type: string;
  sourceId: string | null;
  categoryId: string | null;
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
    sourceId?: string;
    categoryId?: string | null;
  },
): Promise<PromptBlockData> {
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { PromptBlockType } = await import("@/generated/prisma");
  const { audit } = await import("@/server/services/audit-service");

  const block = await createPromptBlock(jobPositionId, {
    type: input.type as (typeof PromptBlockType)[keyof typeof PromptBlockType],
    sourceId: input.sourceId ?? null,
    categoryId: input.categoryId ?? null,
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
      presetBindings: true,
      // 读取大任务级别的默认值
      jobLevelOverrides: true,
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

  // 解析大任务级别的默认值覆盖
  const overrides = (job.jobLevelOverrides ?? {}) as {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
  };

  // 默认值：2:3 竖图、短边 512、batch 2
  const defaultAspectRatio = overrides.defaultAspectRatio ?? "2:3";
  const defaultShortSidePx = overrides.defaultShortSidePx ?? 512;
  const defaultBatchSize = overrides.defaultBatchSize ?? 2;
  // v0.3: dual seedPolicy support
  const defaultSeedPolicy1 = overrides.defaultSeedPolicy1 ?? "random";
  const defaultSeedPolicy2 = overrides.defaultSeedPolicy2 ?? "random";

  // 创建小节（CompleteJobPosition）
  const section = await prisma.completeJobPosition.create({
    data: {
      completeJobId: jobId,
      sortOrder,
      enabled: true,
      name: name || null,
      aspectRatio: defaultAspectRatio,
      shortSidePx: defaultShortSidePx,
      batchSize: defaultBatchSize,
      seedPolicy1: defaultSeedPolicy1,
      seedPolicy2: defaultSeedPolicy2,
    },
  });

  // 创建初始 PromptBlocks
  let blockSortOrder = 0;

  // New path: use presetBindings if available
  const bindings = Array.isArray(job.presetBindings) ? (job.presetBindings as PresetBinding[]) : [];
  if (bindings.length > 0) {
    // Resolve presets with category info, sorted by category sortOrder
    const presetIds = bindings.map((b) => b.presetId);
    const presets = await prisma.promptPreset.findMany({
      where: { id: { in: presetIds } },
      include: { category: true },
    });
    const presetMap = new Map(presets.map((p) => [p.id, p]));

    // Sort bindings by category sortOrder
    const sortedBindings = [...bindings].sort((a, b) => {
      const catA = presetMap.get(a.presetId)?.category.sortOrder ?? 999;
      const catB = presetMap.get(b.presetId)?.category.sortOrder ?? 999;
      return catA - catB;
    });

    for (const binding of sortedBindings) {
      const preset = presetMap.get(binding.presetId);
      if (!preset) continue;

      await prisma.promptBlock.create({
        data: {
          completeJobPositionId: section.id,
          type: "preset",
          sourceId: preset.id,
          categoryId: preset.categoryId,
          label: preset.name,
          positive: preset.prompt,
          negative: preset.negativePrompt,
          sortOrder: blockSortOrder++,
        },
      });
    }
  } else {
    // Legacy path: use character/scene/style FKs
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
  // 0. 检查是否有正在执行的 run，避免重排序导致输出路径不一致
  const runningCount = await prisma.positionRun.count({
    where: {
      completeJobId: jobId,
      status: { in: ["queued", "running"] },
    },
  });
  if (runningCount > 0) {
    throw new Error("有正在执行或排队中的任务，请等待完成后再调整顺序");
  }

  // 1. 查询旧 sortOrder、name 和 job title（用于文件夹重命名）
  const sections = await prisma.completeJobPosition.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, sortOrder: true, name: true, positionTemplate: { select: { name: true } } },
  });
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    select: { title: true },
  });

  const oldSortMap = new Map(sections.map((s) => [s.id, {
    sortOrder: s.sortOrder,
    name: s.name || s.positionTemplate?.name || "position",
  }]));

  // 2. 批量更新 sortOrder
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
      // v0.3: dual seedPolicy
      seedPolicy1: section.seedPolicy1,
      seedPolicy2: section.seedPolicy2,
      // v0.3: ksampler params
      ksampler1: section.ksampler1 ?? undefined,
      ksampler2: section.ksampler2 ?? undefined,
      loraConfig: section.loraConfig ?? undefined,
      extraParams: section.extraParams ?? undefined,
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
