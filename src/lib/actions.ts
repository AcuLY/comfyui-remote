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
  enqueueProjectRuns as enqueueProjectRunsRepo,
  enqueueProjectSectionRun as enqueueProjectSectionRunRepo,
  copyProject as copyProjectRepo,
} from "@/server/repositories/project-repository";
import { submitRunToComfyUI, pollRunCompletion } from "@/server/services/run-executor";
import { getWorkerRun } from "@/server/worker/repository";
import {
  deleteComfyQueueItems,
  getComfyQueuePosition,
  interruptComfyPrompt,
} from "@/server/services/comfyui-service";
import { env } from "@/lib/env";
import { recordSectionChange } from "@/server/services/section-change-history-service";
import {
  recordPresetChange,
  recordPresetGroupChange,
} from "@/server/services/preset-change-history-service";
import {
  parseSectionLoraConfig,
  serializeSectionLoraConfig,
  type LoraEntry,
} from "@/lib/lora-types";

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

// ---------------------------------------------------------------------------
// 运行整个项目
// ---------------------------------------------------------------------------

export async function runProject(projectId: string, overrideBatchSize?: number | null) {
  // 1. Create Run records with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectRunsRepo(projectId, overrideBatchSize ?? undefined);

  // 2. Submit each created run to ComfyUI synchronously
  let allFailed = true;

  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      // Store comfyPromptId — now "queued" means "in ComfyUI's queue"
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      // Fire-and-forget: poll for completion
      pollRunCompletion(run.runId).catch(() => {});
      allFailed = false;
    } catch (error) {
      // ComfyUI submission failed — delete the Run record
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
    }
  }

  // If all runs were deleted, reset project status from "queued" back to "draft"
  if (allFailed && result.runs.length > 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "draft" },
    }).catch(() => {});
  }

  revalidatePath("/projects");
  revalidatePath("/queue");

  if (allFailed && result.runs.length > 0) {
    throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
  }
}

// ---------------------------------------------------------------------------
// 运行单个 Section
// ---------------------------------------------------------------------------

export async function runSection(sectionId: string, overrideBatchSize?: number | null) {
  // 需要先拿到 projectId，因为 repository 函数需要它
  const pos = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  if (!pos) return;

  // 1. Create Run record with status="queued" (no comfyPromptId yet)
  const result = await enqueueProjectSectionRunRepo(pos.projectId, sectionId, overrideBatchSize ?? undefined);

  // 2. Submit to ComfyUI synchronously
  for (const enqueuedRun of result.runs) {
    const run = await getWorkerRun(enqueuedRun.runId);
    if (!run) continue;

    try {
      const { comfyPromptId } = await submitRunToComfyUI(run);
      await prisma.run.update({
        where: { id: run.runId },
        data: { comfyPromptId },
      });
      pollRunCompletion(run.runId).catch(() => {});
    } catch (error) {
      console.error(`Failed to submit run ${run.runId} to ComfyUI:`, error);
      await prisma.run.delete({ where: { id: run.runId } }).catch(() => {});
      // Reset project status from "queued" back since the run was deleted
      await prisma.project.update({
        where: { id: pos.projectId },
        data: { status: "draft" },
      }).catch(() => {});
      throw new Error("无法连接到 ComfyUI，请检查服务是否运行");
    }
  }

  revalidatePath("/projects");
  revalidatePath("/queue");
}

// ---------------------------------------------------------------------------
// 创建项目
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

export type CreateProjectInput = {
  title: string;
  presetBindings: PresetBinding[];
  notes: string | null;
};

export async function createProject(input: CreateProjectInput): Promise<string> {
  // 生成唯一 slug
  const baseSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "untitled";
  let slug = baseSlug;
  let i = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const project = await prisma.project.create({
    data: {
      title: input.title,
      slug,
      status: "draft",
      presetBindings: input.presetBindings.length > 0 ? input.presetBindings : undefined,
      notes: input.notes,
    },
  });

  revalidatePath("/projects");
  return project.id;
}

// ---------------------------------------------------------------------------
// 更新项目
// ---------------------------------------------------------------------------

export type UpdateProjectInput = {
  projectId: string;
  title?: string;
  presetBindings?: PresetBinding[];
  notes?: string | null;
  sections?: {
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
  projectLevelOverrides?: {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultUpscaleFactor?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
    defaultKsampler1?: Record<string, unknown>;
    defaultKsampler2?: Record<string, unknown>;
  };
};

export async function updateProject(input: UpdateProjectInput) {
  const { projectId, sections, projectLevelOverrides, presetBindings, ...projectData } = input;

  // 更新 project 基础字段（包括 projectLevelOverrides）
  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...projectData,
      ...(presetBindings !== undefined ? { presetBindings } : {}),
      ...(projectLevelOverrides !== undefined ? { projectLevelOverrides: projectLevelOverrides as object } : {}),
    },
  });

  // 如果传了 positions，删除旧的并重建
  if (sections) {
    await prisma.projectSection.deleteMany({
      where: { projectId: projectId },
    });

    await prisma.projectSection.createMany({
      data: sections.map((pos) => ({
        projectId: projectId,
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

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// 复制项目
// ---------------------------------------------------------------------------

export async function copyProject(projectId: string): Promise<string | null> {
  const newProject = await copyProjectRepo(projectId);
  revalidatePath("/projects");
  return newProject.id;
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
// PromptBlock — 提示词块管理（Server Actions）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PresetCategory CRUD (unified prompt system)
// ---------------------------------------------------------------------------

export type PresetCategoryInput = {
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  type?: string; // "preset" | "group"
  slotTemplate?: Array<{ categoryId: string; label?: string }> | null;
  positivePromptOrder?: number;
  negativePromptOrder?: number;
  lora1Order?: number;
  lora2Order?: number;
  sortOrder?: number;
};

export async function createPresetCategory(input: PresetCategoryInput) {
  // Auto-assign sortOrder if not provided
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.presetCategory.aggregate({ _max: { sortOrder: true } });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  // Auto-generate a random HSL color if not provided
  if (!input.color) {
    const hue = Math.floor(Math.random() * 360);
    input.color = `${hue} 50% 55%`;
  }
  const { slotTemplate, ...rest } = input;
  const data = { ...rest } as Record<string, unknown>;
  if (slotTemplate !== undefined) {
    data.slotTemplate = slotTemplate != null ? (slotTemplate as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  const cat = await prisma.presetCategory.create({ data: data as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  revalidatePath("/assets/presets");
  return cat;
}

export async function updatePresetCategory(id: string, input: Partial<PresetCategoryInput>) {
  const { slotTemplate, ...rest } = input;
  const data = { ...rest } as Record<string, unknown>;
  if (slotTemplate !== undefined) {
    data.slotTemplate = slotTemplate != null ? (slotTemplate as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  }
  const cat = await prisma.presetCategory.update({ where: { id }, data: data as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  revalidatePath("/assets/presets");
  return cat;
}

export async function deletePresetCategory(id: string) {
  // Only allow deletion if no presets or groups exist in this category
  const presetCount = await prisma.preset.count({ where: { categoryId: id } });
  if (presetCount > 0) {
    throw new Error(`分类下还有 ${presetCount} 个预制，请先删除或移动它们`);
  }
  const groupCount = await prisma.presetGroup.count({ where: { categoryId: id } });
  if (groupCount > 0) {
    throw new Error(`分类下还有 ${groupCount} 个预制组，请先删除或移动它们`);
  }
  await prisma.presetCategory.delete({ where: { id } });
  revalidatePath("/assets/presets");
}

export async function reorderPresetCategories(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

type SortDimension = "positivePromptOrder" | "negativePromptOrder" | "lora1Order" | "lora2Order";

export async function updateCategorySortOrders(dimension: SortDimension, ids: string[]) {
  const validDimensions: SortDimension[] = [
    "positivePromptOrder",
    "negativePromptOrder",
    "lora1Order",
    "lora2Order",
  ];
  if (!validDimensions.includes(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetCategory.update({
        where: { id },
        data: { [dimension]: index },
      }),
    ),
  );
  revalidatePath("/assets/presets");
  revalidatePath("/assets/presets/sort-rules");
}

// ---------------------------------------------------------------------------
// Preset CRUD (unified prompt system with variants)
// ---------------------------------------------------------------------------

export type PresetInput = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  notes?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type PresetVariantInput = {
  presetId: string;
  name: string;
  slug: string;
  prompt: string;
  negativePrompt?: string | null;
  lora1?: unknown;
  lora2?: unknown;
  defaultParams?: unknown;
  linkedVariants?: unknown;
  isActive?: boolean;
  sortOrder?: number;
};

function presetVariantRosterSnapshot(variant: {
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    name: variant.name,
    slug: variant.slug,
    sortOrder: variant.sortOrder,
    isActive: variant.isActive,
  };
}

function presetVariantLinkedSnapshot(variant: {
  linkedVariants: unknown;
}) {
  return {
    linkedVariants: variant.linkedVariants,
  };
}

function presetVariantContentSnapshot(variant: {
  name: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
}) {
  return {
    name: variant.name,
    prompt: variant.prompt,
    negativePrompt: variant.negativePrompt,
    lora1: variant.lora1,
    lora2: variant.lora2,
  };
}

function groupMetaSnapshot(group: {
  name: string;
  slug: string;
  folderId: string | null;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    name: group.name,
    slug: group.slug,
    folderId: group.folderId,
    isActive: group.isActive,
    sortOrder: group.sortOrder,
  };
}

async function groupMembersSnapshot(groupId: string) {
  const members = await prisma.presetGroupMember.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      presetId: true,
      variantId: true,
      subGroupId: true,
      slotCategoryId: true,
      sortOrder: true,
    },
  });
  return members;
}

export async function createPreset(input: PresetInput) {
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.preset.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  // Check for soft-deleted preset with same slug in same category
  const existing = await prisma.preset.findUnique({
    where: {
      categoryId_slug: { categoryId: input.categoryId, slug: input.slug },
    },
  });

  let preset;
  if (existing && !existing.isActive) {
    // Reactivate and update the soft-deleted record, clearing old variants
    await prisma.presetVariant.deleteMany({ where: { presetId: existing.id } });
    preset = await prisma.preset.update({
      where: { id: existing.id },
      data: { ...input, isActive: true },
    });
  } else {
    preset = await prisma.preset.create({ data: input });
  }

  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function createPresetVariant(input: PresetVariantInput) {
  const { lora1, lora2, defaultParams, linkedVariants, ...rest } = input;
  if (rest.sortOrder === undefined) {
    const maxOrder = await prisma.presetVariant.aggregate({
      where: { presetId: input.presetId },
      _max: { sortOrder: true },
    });
    rest.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  const variant = await prisma.presetVariant.create({
    data: {
      ...rest,
      lora1: toJsonValue(lora1) ?? Prisma.DbNull,
      lora2: toJsonValue(lora2) ?? Prisma.DbNull,
      defaultParams: toJsonValue(defaultParams) ?? Prisma.DbNull,
      linkedVariants: (Array.isArray(linkedVariants) && linkedVariants.length > 0)
        ? (toJsonValue(linkedVariants) ?? Prisma.DbNull)
        : Prisma.DbNull,
    },
  });
  await recordPresetChange({
    presetId: variant.presetId,
    dimension: "variants",
    title: `创建变体：${variant.name}`,
    before: null,
    after: presetVariantRosterSnapshot(variant),
  });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function updatePreset(id: string, input: Partial<PresetInput>) {
  const preset = await prisma.preset.update({ where: { id }, data: input });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return preset;
}

export async function updatePresetVariant(id: string, input: Partial<PresetVariantInput>) {
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const { presetId: _pid, lora1, lora2, defaultParams, linkedVariants, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (defaultParams !== undefined) data.defaultParams = toJsonValue(defaultParams) ?? Prisma.DbNull;
  if (linkedVariants !== undefined) {
    // Empty array → store as DbNull; non-empty → store as JSON array
    if (Array.isArray(linkedVariants) && linkedVariants.length === 0) {
      data.linkedVariants = Prisma.DbNull;
    } else {
      data.linkedVariants = toJsonValue(linkedVariants) ?? Prisma.DbNull;
    }
  }

  const variant = await prisma.presetVariant.update({ where: { id }, data });
  if (before) {
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "variants",
      title: `更新关联变体：${variant.name}`,
      before: presetVariantLinkedSnapshot(before),
      after: presetVariantLinkedSnapshot(variant),
    });
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "content",
      title: `更新提示词与 LoRA：${variant.name}`,
      before: presetVariantContentSnapshot(before),
      after: presetVariantContentSnapshot(variant),
    });
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
  return variant;
}

export async function deletePreset(id: string) {
  // Soft delete: set isActive = false
  await prisma.preset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
}

export async function deletePresetVariant(id: string) {
  // Soft delete: set isActive = false
  const before = await prisma.presetVariant.findUnique({ where: { id } });
  const variant = await prisma.presetVariant.update({ where: { id }, data: { isActive: false } });
  if (before) {
    await recordPresetChange({
      presetId: variant.presetId,
      dimension: "variants",
      title: `删除变体：${variant.name}`,
      before: presetVariantRosterSnapshot(before),
      after: presetVariantRosterSnapshot(variant),
    });
  }
  revalidatePath("/assets/presets");
  revalidatePath("/projects/new");
}

// ---------------------------------------------------------------------------
// Variant content resolution (handles linkedVariants recursively)
// ---------------------------------------------------------------------------

export type ResolvedVariantContent = {
  prompt: string;
  negativePrompt: string | null;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
};

/** Recursively resolve a variant's content including linked variants. */
export async function resolveVariantContent(
  variantId: string,
  visited = new Set<string>(),
): Promise<ResolvedVariantContent> {
  const empty: ResolvedVariantContent = { prompt: "", negativePrompt: null, lora1: [], lora2: [] };
  if (visited.has(variantId)) return empty;
  visited.add(variantId);

  const variant = await prisma.presetVariant.findUnique({ where: { id: variantId } });
  if (!variant || !variant.isActive) return empty;

  let prompt = variant.prompt;
  let negativePrompt = variant.negativePrompt;

  // Parse own LoRAs
  const parseLora = (json: unknown): Array<{ path: string; weight: number; enabled: boolean }> => {
    if (!json || !Array.isArray(json)) return [];
    return json.filter(
      (item): item is { path: string; weight: number; enabled: boolean } =>
        typeof item === "object" && item !== null &&
        typeof item.path === "string" &&
        typeof item.weight === "number" &&
        typeof item.enabled === "boolean",
    );
  };

  const lora1 = parseLora(variant.lora1);
  const lora2 = parseLora(variant.lora2);

  // Resolve linked variants
  const linked = Array.isArray(variant.linkedVariants)
    ? (variant.linkedVariants as Array<{ presetId: string; variantId: string }>)
    : [];

  for (const ref of linked) {
    const resolved = await resolveVariantContent(ref.variantId, visited);
    if (resolved.prompt) prompt += ", " + resolved.prompt;
    if (resolved.negativePrompt) {
      negativePrompt = negativePrompt
        ? negativePrompt + ", " + resolved.negativePrompt
        : resolved.negativePrompt;
    }
    for (const l of resolved.lora1) {
      if (!lora1.some((e) => e.path === l.path)) lora1.push(l);
    }
    for (const l of resolved.lora2) {
      if (!lora2.some((e) => e.path === l.path)) lora2.push(l);
    }
  }

  return { prompt, negativePrompt, lora1, lora2 };
}

// ---------------------------------------------------------------------------
// Preset usage check + cascade operations
// ---------------------------------------------------------------------------

export type PresetUsageInfo = {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    projectTitle: string;
    blockCount: number;
  }>;
  totalBlocks: number;
};

type SectionLoraJsonEntry = Record<string, unknown>;

function sortSectionLoraEntriesByCategoryOrder(
  entries: SectionLoraJsonEntry[],
  orderKey: "lora1Order" | "lora2Order",
  categoryOrderByName: Map<string, { lora1Order: number; lora2Order: number }>,
) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const getOrder = (entry: SectionLoraJsonEntry) => {
        if (entry.source !== "preset" || typeof entry.sourceLabel !== "string") return 999;
        return categoryOrderByName.get(entry.sourceLabel)?.[orderKey] ?? 999;
      };
      return getOrder(a.entry) - getOrder(b.entry) || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** Check which sections reference a given preset via PromptBlock.sourceId */
export async function getPresetUsage(presetId: string): Promise<PresetUsageInfo> {
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      bindingId: true,
      projectSection: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
          project: { select: { title: true } },
        },
      },
    },
  });

  // Group by section
  const sectionMap = new Map<string, { sectionId: string; sectionName: string; projectTitle: string; blockCount: number }>();
  for (const block of blocks) {
    const sec = block.projectSection;
    const existing = sectionMap.get(sec.id);
    if (existing) {
      existing.blockCount++;
    } else {
      sectionMap.set(sec.id, {
        sectionId: sec.id,
        sectionName: sec.name || `小节 ${sec.sortOrder}`,
        projectTitle: sec.project.title,
        blockCount: 1,
      });
    }
  }

  return {
    sections: [...sectionMap.values()],
    totalBlocks: blocks.length,
  };
}

/** Delete preset and cascade-remove all related PromptBlocks + LoRAs in sections */
export async function deletePresetCascade(presetId: string) {
  // 1. Find all blocks referencing this preset
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: { id: true, bindingId: true, projectSectionId: true },
  });

  // 2. Collect unique bindingIds and sectionIds
  const bindingIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const block of blocks) {
    if (block.bindingId) bindingIds.add(block.bindingId);
    sectionIds.add(block.projectSectionId);
  }

  // 3. Delete all blocks with matching bindingIds (includes blocks from same import)
  if (bindingIds.size > 0) {
    await prisma.promptBlock.deleteMany({
      where: { bindingId: { in: [...bindingIds] } },
    });
  }
  // Also delete blocks without bindingId that reference this preset
  await prisma.promptBlock.deleteMany({
    where: { sourceId: presetId, bindingId: null },
  });

  // 4. Remove LoRAs with matching bindingIds from section loraConfig JSON
  for (const sectionId of sectionIds) {
    const section = await prisma.projectSection.findUnique({
      where: { id: sectionId },
      select: { loraConfig: true },
    });
    if (!section?.loraConfig) continue;

    const config = section.loraConfig as { lora1?: Array<Record<string, unknown>>; lora2?: Array<Record<string, unknown>> };
    let changed = false;

    if (config.lora1) {
      const before = config.lora1.length;
      config.lora1 = config.lora1.filter((e) => !e.bindingId || !bindingIds.has(e.bindingId as string));
      if (config.lora1.length !== before) changed = true;
    }
    if (config.lora2) {
      const before = config.lora2.length;
      config.lora2 = config.lora2.filter((e) => !e.bindingId || !bindingIds.has(e.bindingId as string));
      if (config.lora2.length !== before) changed = true;
    }

    if (changed) {
      await prisma.projectSection.update({
        where: { id: sectionId },
        data: { loraConfig: config as Prisma.InputJsonValue },
      });
    }
  }

  // 5. Soft delete the preset
  await prisma.preset.update({ where: { id: presetId }, data: { isActive: false } });

  revalidatePath("/assets/presets");
  revalidatePath("/projects");
}

/** Sync preset variant content to all sections that imported it */
export async function syncPresetToSections(presetId: string) {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { name: true, color: true, lora1Order: true, lora2Order: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset || preset.variants.length === 0) return;

  const defaultVariant = preset.variants[0];
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: {
      id: true,
      variantId: true,
      bindingId: true,
      groupBindingId: true,
      projectSectionId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  if (blocks.length === 0) return;

  const categories = await prisma.presetCategory.findMany({
    select: { name: true, lora1Order: true, lora2Order: true },
  });
  const categoryOrderByName = new Map(
    categories.map((category) => [
      category.name,
      { lora1Order: category.lora1Order, lora2Order: category.lora2Order },
    ]),
  );

  for (const block of blocks) {
    // Determine which variant this block uses
    let variant = defaultVariant;
    if (block.variantId) {
      // Prefer stored variantId
      const found = preset.variants.find((v) => v.id === block.variantId);
      if (found) variant = found;
    } else {
      // Fallback: match by label
      for (const v of preset.variants) {
        const expectedLabel = preset.variants.length === 1
          ? preset.name : `${preset.name} / ${v.name}`;
        if (block.label === expectedLabel) { variant = v; break; }
      }
    }

    const resolved = await resolveVariantContent(variant.id);
    const label = preset.variants.length === 1
      ? preset.name : `${preset.name} / ${variant.name}`;

    const updatedBlock = await prisma.promptBlock.update({
      where: { id: block.id },
      data: { label, positive: resolved.prompt, negative: resolved.negativePrompt },
      select: { id: true, label: true, positive: true, negative: true, sortOrder: true, bindingId: true, groupBindingId: true },
    });
    await recordSectionChange({
      sectionId: block.projectSectionId,
      dimension: "prompt",
      title: `同步预制提示词：${label}`,
      before: {
        id: block.id,
        label: block.label,
        positive: block.positive,
        negative: block.negative,
        sortOrder: block.sortOrder,
        bindingId: block.bindingId,
        groupBindingId: block.groupBindingId,
      },
      after: updatedBlock,
    });

    if (block.bindingId) {
      const section = await prisma.projectSection.findUnique({
        where: { id: block.projectSectionId },
        select: { loraConfig: true },
      });
      if (!section?.loraConfig) continue;

      const config = section.loraConfig as {
        lora1?: SectionLoraJsonEntry[];
        lora2?: SectionLoraJsonEntry[];
      };
      let changed = false;
      const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
        id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        path: b.path, weight: b.weight, enabled: b.enabled,
        source: "preset", sourceLabel: preset.category.name,
        sourceColor: preset.category.color, sourceName: preset.name,
        bindingId: block.bindingId,
      });
      if (Array.isArray(config.lora1)) {
        config.lora1 = sortSectionLoraEntriesByCategoryOrder(
          [...config.lora1.filter((e) => e.bindingId !== block.bindingId), ...resolved.lora1.map(makeLora)],
          "lora1Order",
          categoryOrderByName,
        );
        changed = true;
      }
      if (Array.isArray(config.lora2)) {
        config.lora2 = sortSectionLoraEntriesByCategoryOrder(
          [...config.lora2.filter((e) => e.bindingId !== block.bindingId), ...resolved.lora2.map(makeLora)],
          "lora2Order",
          categoryOrderByName,
        );
        changed = true;
      }
      if (changed) {
        await prisma.projectSection.update({
          where: { id: block.projectSectionId },
          data: { loraConfig: config as Prisma.InputJsonValue },
        });
        await recordSectionChange({
          sectionId: block.projectSectionId,
          dimension: "lora",
          title: `同步预制 LoRA：${label}`,
          before: section.loraConfig,
          after: config,
        });
      }
    }
  }
  revalidatePath("/projects");
}

export async function reorderPresets(categoryId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.preset.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function reorderPresetVariants(presetId: string, ids: string[]) {
  const before = await prisma.presetVariant.findMany({
    where: { presetId, id: { in: ids } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetVariant.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const after = await prisma.presetVariant.findMany({
    where: { presetId, id: { in: ids } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
  await recordPresetChange({
    presetId,
    dimension: "variants",
    title: "调整变体顺序",
    before,
    after,
  });
  revalidatePath("/assets/presets");
}

// ---------------------------------------------------------------------------
// PresetGroup CRUD
// ---------------------------------------------------------------------------

export type PresetGroupInput = {
  categoryId: string;
  folderId?: string | null;
  name: string;
  slug: string;
  sortOrder?: number;
};

export type PresetGroupMemberInput = {
  groupId: string;
  presetId?: string;
  variantId?: string;
  subGroupId?: string;
  slotCategoryId?: string;
};

export async function createPresetGroup(input: PresetGroupInput) {
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.presetGroup.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  // Check for soft-deleted group with same slug in same category
  const existing = await prisma.presetGroup.findUnique({
    where: {
      categoryId_slug: { categoryId: input.categoryId, slug: input.slug },
    },
  });

  let group;
  if (existing && !existing.isActive) {
    // Reactivate and update the soft-deleted record, clearing old members
    await prisma.presetGroupMember.deleteMany({ where: { groupId: existing.id } });
    group = await prisma.presetGroup.update({
      where: { id: existing.id },
      data: { ...input, isActive: true },
    });
  } else {
    group = await prisma.presetGroup.create({ data: input });
  }

  await recordPresetGroupChange({
    groupId: group.id,
    dimension: "meta",
    title: existing && !existing.isActive ? "恢复预制组" : "创建预制组",
    before: null,
    after: groupMetaSnapshot(group),
  });

  revalidatePath("/assets/presets");
  return group;
}

export async function updatePresetGroup(id: string, input: Partial<PresetGroupInput>) {
  const before = await prisma.presetGroup.findUnique({ where: { id } });
  const group = await prisma.presetGroup.update({ where: { id }, data: input });
  if (before) {
    await recordPresetGroupChange({
      groupId: id,
      dimension: "meta",
      title: "更新预制组信息",
      before: groupMetaSnapshot(before),
      after: groupMetaSnapshot(group),
    });
  }
  revalidatePath("/assets/presets");
  return group;
}

export async function deletePresetGroup(id: string) {
  const before = await prisma.presetGroup.findUnique({ where: { id } });
  const group = await prisma.presetGroup.update({ where: { id }, data: { isActive: false } });
  if (before) {
    await recordPresetGroupChange({
      groupId: id,
      dimension: "meta",
      title: "删除预制组",
      before: groupMetaSnapshot(before),
      after: groupMetaSnapshot(group),
    });
  }
  revalidatePath("/assets/presets");
}

export async function addGroupMember(input: PresetGroupMemberInput) {
  const previousMembers = await resolveConcreteGroupMembers(input.groupId);
  const before = await groupMembersSnapshot(input.groupId);
  const maxOrder = await prisma.presetGroupMember.aggregate({
    where: { groupId: input.groupId },
    _max: { sortOrder: true },
  });
  const member = await prisma.presetGroupMember.create({
    data: { ...input, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  const after = await groupMembersSnapshot(input.groupId);
  await recordPresetGroupChange({
    groupId: input.groupId,
    dimension: "members",
    title: "添加预制组成员",
    before,
    after,
  });
  await syncPresetGroupInstances(input.groupId, previousMembers);
  revalidatePath("/assets/presets");
  return member;
}

export async function removeGroupMember(memberId: string) {
  const existing = await prisma.presetGroupMember.findUnique({
    where: { id: memberId },
    select: { groupId: true },
  });
  if (!existing) return;
  const previousMembers = await resolveConcreteGroupMembers(existing.groupId);
  const before = await groupMembersSnapshot(existing.groupId);
  await prisma.presetGroupMember.delete({ where: { id: memberId } });
  const after = await groupMembersSnapshot(existing.groupId);
  await recordPresetGroupChange({
    groupId: existing.groupId,
    dimension: "members",
    title: "移除预制组成员",
    before,
    after,
  });
  await syncPresetGroupInstances(existing.groupId, previousMembers);
  revalidatePath("/assets/presets");
}

export async function reorderPresetGroups(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroup.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

export async function reorderGroupMembers(groupId: string, ids: string[]) {
  const previousMembers = await resolveConcreteGroupMembers(groupId);
  const before = await groupMembersSnapshot(groupId);
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetGroupMember.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const after = await groupMembersSnapshot(groupId);
  await recordPresetGroupChange({
    groupId,
    dimension: "members",
    title: "调整成员顺序",
    before,
    after,
  });
  await syncPresetGroupInstances(groupId, previousMembers);
  revalidatePath("/assets/presets");
}

// ---------------------------------------------------------------------------
// PresetFolder CRUD
// ---------------------------------------------------------------------------

export async function createPresetFolder(
  categoryId: string,
  parentId: string | null,
  name: string,
) {
  const maxSort = await prisma.presetFolder.aggregate({
    where: { categoryId, parentId: parentId ?? undefined },
    _max: { sortOrder: true },
  });
  const folder = await prisma.presetFolder.create({
    data: {
      categoryId,
      parentId,
      name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/assets/presets");
  return folder;
}

export async function renamePresetFolder(id: string, name: string) {
  await prisma.presetFolder.update({ where: { id }, data: { name } });
  revalidatePath("/assets/presets");
}

export async function deletePresetFolder(id: string) {
  // Only allow deleting empty folders (no children, no presets, no groups)
  const [childCount, presetCount, groupCount] = await Promise.all([
    prisma.presetFolder.count({ where: { parentId: id } }),
    prisma.preset.count({ where: { folderId: id } }),
    prisma.presetGroup.count({ where: { folderId: id } }),
  ]);
  if (childCount + presetCount + groupCount > 0) {
    throw new Error(`文件夹不为空，包含 ${childCount} 个子文件夹、${presetCount} 个预制、${groupCount} 个预制组`);
  }
  await prisma.presetFolder.delete({ where: { id } });
  revalidatePath("/assets/presets");
}

export async function moveToFolder(
  type: "preset" | "group",
  id: string,
  folderId: string | null,
) {
  if (type === "preset") {
    await prisma.preset.update({ where: { id }, data: { folderId } });
  } else {
    await prisma.presetGroup.update({ where: { id }, data: { folderId } });
  }
  revalidatePath("/assets/presets");
}

export async function reorderPresetFolders(
  categoryId: string,
  parentId: string | null,
  ids: string[],
) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetFolder.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/presets");
}

// ---------------------------------------------------------------------------
// Category slot template
// ---------------------------------------------------------------------------

export async function updateCategorySlotTemplate(
  categoryId: string,
  slotTemplate: Array<{ categoryId: string; label?: string }>,
) {
  await prisma.presetCategory.update({
    where: { id: categoryId },
    data: { slotTemplate: slotTemplate as Prisma.InputJsonValue },
  });
  revalidatePath("/assets/presets");
}

/** Recursively flatten a group into preset+variant pairs, preventing cycles. */
export async function flattenGroup(
  groupId: string,
  visited = new Set<string>(),
): Promise<Array<{ presetId: string; variantId?: string }>> {
  if (visited.has(groupId)) return [];
  visited.add(groupId);

  const members = await prisma.presetGroupMember.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
  });

  const result: Array<{ presetId: string; variantId?: string }> = [];
  for (const m of members) {
    if (m.subGroupId) {
      const sub = await flattenGroup(m.subGroupId, visited);
      result.push(...sub);
    } else if (m.presetId) {
      result.push({ presetId: m.presetId, variantId: m.variantId ?? undefined });
    }
  }
  return result;
}

type ConcreteGroupMember = {
  presetId: string;
  variantId: string;
  categoryId: string;
  label: string;
  positive: string;
  negative: string | null;
  presetName: string;
  categoryName: string;
  categoryColor?: string;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
};

async function resolveConcreteGroupMembers(groupId: string): Promise<ConcreteGroupMember[]> {
  const members = await flattenGroup(groupId);
  const concreteMembers: ConcreteGroupMember[] = [];

  for (const member of members) {
    const preset = await prisma.preset.findUnique({
      where: { id: member.presetId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!preset) continue;

    const variant = member.variantId
      ? preset.variants.find((v) => v.id === member.variantId)
      : preset.variants[0];
    if (!variant) continue;

    const resolved = await resolveVariantContent(variant.id);
    concreteMembers.push({
      presetId: preset.id,
      variantId: variant.id,
      categoryId: preset.category.id,
      label: preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`,
      positive: resolved.prompt,
      negative: resolved.negativePrompt,
      presetName: preset.name,
      categoryName: preset.category.name,
      categoryColor: preset.category.color ?? undefined,
      lora1: resolved.lora1,
      lora2: resolved.lora2,
    });
  }

  return concreteMembers;
}

function groupMemberSignature(members: Array<{ presetId: string; variantId: string }>) {
  return members.map((m) => `${m.presetId}:${m.variantId}`).join("|");
}

function createBindingId() {
  return `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createLoraEntryId() {
  return `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makePresetLoraEntry(
  binding: { path: string; weight: number; enabled: boolean },
  member: ConcreteGroupMember,
  bindingId: string,
  groupBindingId: string,
): LoraEntry {
  return {
    id: createLoraEntryId(),
    path: binding.path,
    weight: binding.weight,
    enabled: binding.enabled,
    source: "preset",
    sourceLabel: member.categoryName,
    sourceColor: member.categoryColor,
    sourceName: member.presetName,
    bindingId,
    groupBindingId,
  };
}

async function syncPresetGroupInstances(
  groupId: string,
  previousMembers: ConcreteGroupMember[],
) {
  const nextMembers = await resolveConcreteGroupMembers(groupId);
  const previousSignature = groupMemberSignature(previousMembers);
  const nextSignature = groupMemberSignature(nextMembers);

  if (previousSignature === nextSignature) return;
  if (!previousSignature && nextMembers.length === 0) return;

  const groupBindingPrefix = `grp:${groupId}:`;
  const sections = await prisma.projectSection.findMany({
    where: {
      promptBlocks: {
        some: { groupBindingId: { not: null } },
      },
    },
    select: {
      id: true,
      projectId: true,
      loraConfig: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          sourceId: true,
          variantId: true,
          categoryId: true,
          bindingId: true,
          groupBindingId: true,
          label: true,
          positive: true,
          negative: true,
          sortOrder: true,
          createdAt: true,
        },
      },
    },
  });

  const touchedProjectIds = new Set<string>();

  for (const section of sections) {
    const blocksByGroup = new Map<string, typeof section.promptBlocks>();
    for (const block of section.promptBlocks) {
      if (!block.groupBindingId) continue;
      const groupBlocks = blocksByGroup.get(block.groupBindingId) ?? [];
      groupBlocks.push(block);
      blocksByGroup.set(block.groupBindingId, groupBlocks);
    }

    for (const [groupBindingId, groupBlocks] of blocksByGroup) {
      const currentSignature = groupMemberSignature(
        groupBlocks
          .filter((block) => block.type === "preset" && block.sourceId && block.variantId)
          .map((block) => ({
            presetId: block.sourceId as string,
            variantId: block.variantId as string,
          })),
      );
      const isTrackedGroup = groupBindingId.startsWith(groupBindingPrefix);
      const isLegacyMatch = Boolean(previousSignature && currentSignature === previousSignature);
      if (!isTrackedGroup && !isLegacyMatch) continue;

      const oldBindingIds = new Set(
        groupBlocks.map((block) => block.bindingId).filter((id): id is string => Boolean(id)),
      );
      const nextBindingIds = nextMembers.map(() => createBindingId());

      await prisma.$transaction(async (tx) => {
        await tx.promptBlock.deleteMany({
          where: {
            projectSectionId: section.id,
            groupBindingId,
          },
        });

        let nextSortOrder = 0;
        const createBlocks: Prisma.PromptBlockCreateManyInput[] = [];
        let insertedGroup = false;

        for (const block of section.promptBlocks) {
          if (block.groupBindingId === groupBindingId) {
            if (!insertedGroup) {
              nextMembers.forEach((member, index) => {
                createBlocks.push({
                  projectSectionId: section.id,
                  type: "preset",
                  sourceId: member.presetId,
                  variantId: member.variantId,
                  categoryId: member.categoryId,
                  bindingId: nextBindingIds[index],
                  groupBindingId,
                  label: member.label,
                  positive: member.positive,
                  negative: member.negative,
                  sortOrder: nextSortOrder,
                });
                nextSortOrder += 1;
              });
              insertedGroup = true;
            }
            continue;
          }

          if (block.sortOrder !== nextSortOrder) {
            await tx.promptBlock.update({
              where: { id: block.id },
              data: { sortOrder: nextSortOrder },
            });
          }
          nextSortOrder += 1;
        }

        if (createBlocks.length > 0) {
          await tx.promptBlock.createMany({ data: createBlocks });
        }

        const loraConfig = parseSectionLoraConfig(section.loraConfig);
        const shouldRemoveLora = (entry: LoraEntry) =>
          (entry.bindingId ? oldBindingIds.has(entry.bindingId) : false) ||
          entry.groupBindingId === groupBindingId;

        const replaceLoras = (
          existing: LoraEntry[],
          nextEntries: LoraEntry[],
        ) => {
          const insertAt = existing.findIndex(shouldRemoveLora);
          const filtered = existing.filter((entry) => !shouldRemoveLora(entry));
          filtered.splice(insertAt >= 0 ? insertAt : filtered.length, 0, ...nextEntries);
          return filtered;
        };

        const nextLora1 = nextMembers.flatMap((member, index) =>
          member.lora1.map((binding) =>
            makePresetLoraEntry(binding, member, nextBindingIds[index], groupBindingId),
          ),
        );
        const nextLora2 = nextMembers.flatMap((member, index) =>
          member.lora2.map((binding) =>
            makePresetLoraEntry(binding, member, nextBindingIds[index], groupBindingId),
          ),
        );

        await tx.projectSection.update({
          where: { id: section.id },
          data: {
            loraConfig: serializeSectionLoraConfig({
              lora1: replaceLoras(loraConfig.lora1, nextLora1),
              lora2: replaceLoras(loraConfig.lora2, nextLora2),
            }) as Prisma.InputJsonValue,
          },
        });
      });

      touchedProjectIds.add(section.projectId);
    }
  }

  if (touchedProjectIds.size > 0) {
    revalidatePath("/projects");
    for (const projectId of touchedProjectIds) {
      revalidatePath(`/projects/${projectId}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt Block CRUD
// ---------------------------------------------------------------------------

export type PromptBlockData = {
  id: string;
  type: string;
  sourceId: string | null;
  variantId: string | null;
  categoryId: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export async function addSectionBlock(
  sectionId: string,
  input: {
    type: string;
    label: string;
    positive: string;
    negative?: string | null;
    sourceId?: string;
    categoryId?: string | null;
    bindingId?: string | null;
  },
): Promise<PromptBlockData> {
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { PromptBlockType } = await import("@/generated/prisma");
  const { audit } = await import("@/server/services/audit-service");

  const block = await createPromptBlock(sectionId, {
    type: input.type as (typeof PromptBlockType)[keyof typeof PromptBlockType],
    sourceId: input.sourceId ?? null,
    categoryId: input.categoryId ?? null,
    bindingId: input.bindingId ?? null,
    label: input.label,
    positive: input.positive,
    negative: input.negative ?? null,
  });
  audit("PromptBlock", block.id, "create", { sectionId, type: input.type }, "user" as const);
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `添加提示词块：${block.label}`,
    before: null,
    after: block,
  });
  return block;
}

export async function updateSectionBlock(
  blockId: string,
  input: {
    label?: string;
    positive?: string;
    negative?: string | null;
  },
): Promise<PromptBlockData> {
  const { updatePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const before = await prisma.promptBlock.findUnique({
    where: { id: blockId },
    select: {
      id: true,
      projectSectionId: true,
      type: true,
      sourceId: true,
      variantId: true,
      categoryId: true,
      bindingId: true,
      groupBindingId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  const block = await updatePromptBlock(blockId, input);
  audit("PromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), "user" as const);
  if (before) {
    const { projectSectionId, ...beforeForLog } = before;
    await recordSectionChange({
      sectionId: projectSectionId,
      dimension: "prompt",
      title: `编辑提示词块：${before.label}`,
      before: beforeForLog,
      after: block,
    });
  }
  return block;
}

export async function deleteSectionBlock(blockId: string): Promise<void> {
  const { deletePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const before = await prisma.promptBlock.findUnique({
    where: { id: blockId },
    select: {
      id: true,
      projectSectionId: true,
      type: true,
      sourceId: true,
      variantId: true,
      categoryId: true,
      bindingId: true,
      groupBindingId: true,
      label: true,
      positive: true,
      negative: true,
      sortOrder: true,
    },
  });
  await deletePromptBlock(blockId);
  audit("PromptBlock", blockId, "delete", {}, "user" as const);
  if (before) {
    await recordSectionChange({
      sectionId: before.projectSectionId,
      dimension: "prompt",
      title: `删除提示词块：${before.label}`,
      before,
      after: null,
    });
  }
}

export async function reorderSectionBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockData[]> {
  const { reorderPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const before = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, sortOrder: true },
  });
  const reordered = await reorderPromptBlocks(sectionId, blockIds);
  audit("PromptBlock", sectionId, "reorder", { blockIds }, "user" as const);
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: "调整提示词块顺序",
    before,
    after: reordered.map((block) => ({ id: block.id, label: block.label, sortOrder: block.sortOrder })),
  });
  return reordered;
}

// ---------------------------------------------------------------------------
// Import preset to section (resolves linkedVariants server-side)
// ---------------------------------------------------------------------------

export type ImportPresetResult = {
  block: PromptBlockData;
  lora1: Array<{ id: string; path: string; weight: number; enabled: boolean; source: string; sourceLabel: string; sourceColor?: string; sourceName: string; bindingId: string; groupBindingId?: string }>;
  lora2: Array<{ id: string; path: string; weight: number; enabled: boolean; source: string; sourceLabel: string; sourceColor?: string; sourceName: string; bindingId: string; groupBindingId?: string }>;
  categoryOrders: { positivePromptOrder: number; lora1Order: number; lora2Order: number };
};

/** Import a preset variant into a section, resolving linkedVariants server-side */
export async function importPresetToSection(
  sectionId: string,
  presetId: string,
  variantId: string,
  groupBindingId?: string,
): Promise<ImportPresetResult | null> {
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { id: true, name: true, color: true, positivePromptOrder: true, lora1Order: true, lora2Order: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset) return null;

  const variant = preset.variants.find((v) => v.id === variantId) ?? preset.variants[0];
  if (!variant) return null;

  // Resolve with linked variants
  const resolved = await resolveVariantContent(variant.id);

  const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const label = preset.variants.length === 1
    ? preset.name
    : `${preset.name} / ${variant.name}`;

  // --- Compute insertion sortOrder based on category positivePromptOrder ---
  // 1. Get all existing blocks with their category's positivePromptOrder
  const existingBlocks = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    select: { id: true, sortOrder: true, categoryId: true },
    orderBy: { sortOrder: "asc" },
  });

  const myOrder = preset.category.positivePromptOrder;

  // Look up category orders for existing blocks
  const existingCategoryIds = [...new Set(existingBlocks.map((b) => b.categoryId).filter(Boolean))] as string[];
  const catOrders = await prisma.presetCategory.findMany({
    where: { id: { in: existingCategoryIds } },
    select: { id: true, positivePromptOrder: true },
  });
  const catOrderMap = new Map(catOrders.map((c) => [c.id, c.positivePromptOrder]));

  // Find insertion index: after last block whose category positivePromptOrder <= myOrder
  let insertAfterIndex = -1;
  for (let i = 0; i < existingBlocks.length; i++) {
    const catId = existingBlocks[i].categoryId;
    const order = catId ? (catOrderMap.get(catId) ?? 999) : 999;
    if (order <= myOrder) insertAfterIndex = i;
  }

  // Shift blocks after insertion point
  const insertSortOrder = insertAfterIndex >= 0
    ? existingBlocks[insertAfterIndex].sortOrder + 1
    : 0;

  // Bump all blocks at or after insertSortOrder
  await prisma.promptBlock.updateMany({
    where: {
      projectSectionId: sectionId,
      sortOrder: { gte: insertSortOrder },
    },
    data: { sortOrder: { increment: 1 } },
  });

  // Create prompt block at the correct position
  const { createPromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const block = await createPromptBlock(sectionId, {
    type: "preset" as "custom" | "preset",
    sourceId: presetId,
    variantId: variant.id,
    categoryId: preset.category.id,
    bindingId,
    groupBindingId: groupBindingId ?? null,
    label,
    positive: resolved.prompt,
    negative: resolved.negativePrompt,
    sortOrder: insertSortOrder,
  });
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `导入预制：${label}`,
    before: null,
    after: block,
  });

  // Build LoRA entries
  const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
    id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path: b.path,
    weight: b.weight,
    enabled: b.enabled,
    source: "preset" as const,
    sourceLabel: preset.category.name,
    sourceColor: preset.category.color ?? undefined,
    sourceName: preset.name,
    bindingId,
    groupBindingId: groupBindingId ?? undefined,
  });

  return {
    block,
    lora1: resolved.lora1.map(makeLora),
    lora2: resolved.lora2.map(makeLora),
    categoryOrders: {
      positivePromptOrder: myOrder,
      lora1Order: preset.category.lora1Order,
      lora2Order: preset.category.lora2Order,
    },
  };
}

// ---------------------------------------------------------------------------
// Switch variant for an imported preset binding
// ---------------------------------------------------------------------------

export async function switchBindingVariant(
  sectionId: string,
  bindingId: string,
  newVariantId: string,
): Promise<{ block: PromptBlockData; lora1: ImportPresetResult["lora1"]; lora2: ImportPresetResult["lora2"] } | null> {
  // Find the block with this bindingId
  const block = await prisma.promptBlock.findFirst({
    where: { projectSectionId: sectionId, bindingId },
  });
  if (!block || !block.sourceId) return null;
  const beforeBlock = {
    id: block.id,
    type: block.type,
    sourceId: block.sourceId,
    variantId: block.variantId,
    categoryId: block.categoryId,
    bindingId: block.bindingId,
    groupBindingId: block.groupBindingId,
    label: block.label,
    positive: block.positive,
    negative: block.negative,
    sortOrder: block.sortOrder,
  };

  // Get preset + category info
  const preset = await prisma.preset.findUnique({
    where: { id: block.sourceId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset) return null;

  const variant = preset.variants.find((v) => v.id === newVariantId);
  if (!variant) return null;

  // Resolve with linked variants
  const resolved = await resolveVariantContent(variant.id);

  const label = preset.variants.length === 1
    ? preset.name
    : `${preset.name} / ${variant.name}`;

  // Update prompt block
  const updatedBlock = await prisma.promptBlock.update({
    where: { id: block.id },
    data: {
      variantId: newVariantId,
      label,
      positive: resolved.prompt,
      negative: resolved.negativePrompt,
    },
    select: { id: true, type: true, sourceId: true, variantId: true, categoryId: true, bindingId: true, groupBindingId: true, label: true, positive: true, negative: true, sortOrder: true },
  });
  await recordSectionChange({
    sectionId,
    dimension: "prompt",
    title: `切换预制变体：${label}`,
    before: beforeBlock,
    after: updatedBlock,
  });

  // Update LoRAs in section loraConfig
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { loraConfig: true },
  });
  const beforeLoraConfig = section?.loraConfig ?? null;

  const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
    id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path: b.path,
    weight: b.weight,
    enabled: b.enabled,
    source: "preset" as const,
    sourceLabel: preset.category.name,
    sourceColor: preset.category.color ?? undefined,
    sourceName: preset.name,
    bindingId,
    groupBindingId: block.groupBindingId ?? undefined,
  });

  const newLora1 = resolved.lora1.map(makeLora);
  const newLora2 = resolved.lora2.map(makeLora);

  if (section?.loraConfig) {
    const config = section.loraConfig as {
      lora1?: Array<Record<string, unknown>>;
      lora2?: Array<Record<string, unknown>>;
    };
    if (config.lora1) {
      const idx = config.lora1.findIndex((e) => e.bindingId === bindingId);
      const filtered = config.lora1.filter((e) => e.bindingId !== bindingId);
      const insertAt = idx >= 0 ? Math.min(idx, filtered.length) : filtered.length;
      filtered.splice(insertAt, 0, ...newLora1);
      config.lora1 = filtered;
    }
    if (config.lora2) {
      const idx = config.lora2.findIndex((e) => e.bindingId === bindingId);
      const filtered = config.lora2.filter((e) => e.bindingId !== bindingId);
      const insertAt = idx >= 0 ? Math.min(idx, filtered.length) : filtered.length;
      filtered.splice(insertAt, 0, ...newLora2);
      config.lora2 = filtered;
    }
    await prisma.projectSection.update({
      where: { id: sectionId },
      data: { loraConfig: config as Prisma.InputJsonValue },
    });
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: `切换预制 LoRA：${label}`,
      before: beforeLoraConfig,
      after: config,
    });
  }

  revalidatePath("/projects");

  return {
    block: updatedBlock as PromptBlockData,
    lora1: newLora1,
    lora2: newLora2,
  };
}

// ---------------------------------------------------------------------------
// 取消任务（Run）
// ---------------------------------------------------------------------------

export async function cancelRun(runId: string): Promise<{ ok: boolean; error?: string }> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, status: true, projectId: true, comfyPromptId: true },
  });
  if (!run) return { ok: false, error: "任务不存在" };
  if (run.status !== "queued" && run.status !== "running") {
    return { ok: false, error: `任务状态为「${run.status}」，无法取消` };
  }

  // Use ComfyUI's real queue state. /interrupt is global, so only call it
  // when this prompt is actually in queue_running.
  if (run.comfyPromptId) {
    try {
      const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
      if (position === "running") {
        await interruptComfyPrompt(env.comfyApiUrl);
      } else if (position === "pending") {
        await deleteComfyQueueItems(env.comfyApiUrl, [run.comfyPromptId]);
      }
    } catch (e) {
      // Best-effort: still mark as cancelled in DB even if ComfyUI call fails
      console.warn("Failed to cancel in ComfyUI:", e);
    }
  }

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });

  // Recalculate project status
  const activeRuns = await prisma.run.count({
    where: { projectId: run.projectId, status: { in: ["queued", "running"] } },
  });
  if (activeRuns === 0) {
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: "draft" },
    });
  }

  revalidatePath("/queue");
  revalidatePath(`/projects/${run.projectId}`);
  return { ok: true };
}

/** Cancel all queued/running runs for a project */
export async function cancelProjectRuns(projectId: string): Promise<number> {
  // Find all active runs with comfyPromptIds to cancel in ComfyUI
  const activeRuns = await prisma.run.findMany({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    select: { id: true, status: true, comfyPromptId: true },
  });

  const promptIdsToDelete: string[] = [];
  let shouldInterrupt = false;

  // Only interrupt the prompt that ComfyUI is actually executing. Pending
  // prompts should be deleted from the queue instead.
  try {
    for (const run of activeRuns) {
      if (!run.comfyPromptId) continue;
      const position = await getComfyQueuePosition(env.comfyApiUrl, run.comfyPromptId);
      if (position === "running") {
        shouldInterrupt = true;
      } else if (position === "pending") {
        promptIdsToDelete.push(run.comfyPromptId);
      }
    }

    if (promptIdsToDelete.length > 0) {
      await deleteComfyQueueItems(env.comfyApiUrl, promptIdsToDelete);
    }
    if (shouldInterrupt) {
      await interruptComfyPrompt(env.comfyApiUrl);
    }
  } catch (e) {
    console.warn("Failed to cancel in ComfyUI:", e);
  }

  const result = await prisma.run.updateMany({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    data: {
      status: "cancelled",
      finishedAt: new Date(),
      errorMessage: "用户取消",
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "draft" },
  });
  revalidatePath("/queue");
  revalidatePath(`/projects/${projectId}`);
  return result.count;
}

// ---------------------------------------------------------------------------
// 一键清空运行记录（删除 done / failed / cancelled 状态的 Run）
// ---------------------------------------------------------------------------

export async function clearRuns(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const result = await prisma.run.deleteMany({
      where: { status: { in: ["done", "failed", "cancelled"] } },
    });
    revalidatePath("/queue");
    return { ok: true, count: result.count };
  } catch (e) {
    console.error("Failed to clear runs:", e);
    return { ok: false, count: 0, error: "清空失败" };
  }
}

// ---------------------------------------------------------------------------
// 添加小节（Section）
// ---------------------------------------------------------------------------

export async function addSection(projectId: string, name?: string): Promise<string> {
  // 获取项目信息以创建初始 PromptBlocks
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      presetBindings: true,
      // 读取项目级别的默认值
      projectLevelOverrides: true,
      _count: { select: { sections: true } },
    },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const sortOrder = project._count.sections + 1;

  // 解析项目级别的默认值覆盖
  const overrides = (project.projectLevelOverrides ?? {}) as {
    defaultAspectRatio?: string;
    defaultShortSidePx?: number;
    defaultBatchSize?: number;
    defaultUpscaleFactor?: number;
    defaultSeedPolicy1?: string;
    defaultSeedPolicy2?: string;
    defaultKsampler1?: Record<string, unknown>;
    defaultKsampler2?: Record<string, unknown>;
  };

  // 默认值：2:3 竖图、短边 512、batch 2、放大 2
  const defaultAspectRatio = overrides.defaultAspectRatio ?? "2:3";
  const defaultShortSidePx = overrides.defaultShortSidePx ?? 512;
  const defaultBatchSize = overrides.defaultBatchSize ?? 2;
  const defaultUpscaleFactor = overrides.defaultUpscaleFactor ?? 2;
  const defaultSeedPolicy1 = overrides.defaultSeedPolicy1 ?? "random";
  const defaultSeedPolicy2 = overrides.defaultSeedPolicy2 ?? "random";
  const defaultKsampler1 = overrides.defaultKsampler1 ?? null;
  const defaultKsampler2 = overrides.defaultKsampler2 ?? null;

  // 创建小节（ProjectSection）
  const section = await prisma.projectSection.create({
    data: {
      projectId: projectId,
      sortOrder,
      enabled: true,
      name: name || null,
      aspectRatio: defaultAspectRatio,
      shortSidePx: defaultShortSidePx,
      batchSize: defaultBatchSize,
      upscaleFactor: defaultUpscaleFactor,
      seedPolicy1: defaultSeedPolicy1,
      seedPolicy2: defaultSeedPolicy2,
      ksampler1: (defaultKsampler1 as object) ?? undefined,
      ksampler2: (defaultKsampler2 as object) ?? undefined,
    },
  });

  // 创建初始 PromptBlocks
  let blockSortOrder = 0;

  // New path: use presetBindings if available
  const bindings = Array.isArray(project.presetBindings) ? (project.presetBindings as PresetBinding[]) : [];
  if (bindings.length > 0) {
    // Resolve presets with category info, sorted by category sortOrder
    const presetIds = bindings.map((b) => b.presetId);
    const presets = await prisma.preset.findMany({
      where: { id: { in: presetIds } },
      include: {
        category: true,
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }
      },
    });
    const presetMap = new Map(presets.map((p) => [p.id, p]));

    // Sort bindings by category positivePromptOrder (controls block insertion order)
    const sortedBindings = [...bindings].sort((a, b) => {
      const catA = presetMap.get(a.presetId)?.category.positivePromptOrder ?? 999;
      const catB = presetMap.get(b.presetId)?.category.positivePromptOrder ?? 999;
      return catA - catB;
    });

    const loraConfig: { lora1: Array<Record<string, unknown>>; lora2: Array<Record<string, unknown>> } = { lora1: [], lora2: [] };

    for (const binding of sortedBindings) {
      const preset = presetMap.get(binding.presetId);
      if (!preset) continue;

      // 获取变体（如果指定了 variantId，否则使用第一个变体）
      const variant = binding.variantId
        ? preset.variants.find(v => v.id === binding.variantId)
        : preset.variants[0];

      if (variant) {
        // Resolve with linked variants
        const resolved = await resolveVariantContent(variant.id);

        // Generate a bindingId to link this block with its LoRAs
        const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        await prisma.promptBlock.create({
          data: {
            projectSectionId: section.id,
            type: "preset",
            sourceId: preset.id,
            variantId: variant.id,
            categoryId: preset.categoryId,
            bindingId,
            label: `${preset.name} / ${variant.name}`,
            positive: resolved.prompt,
            negative: resolved.negativePrompt,
            sortOrder: blockSortOrder++,
          },
        });

        // Also write LoRAs to loraConfig with bindingId
        const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
          id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          path: b.path,
          weight: b.weight,
          enabled: b.enabled,
          source: "preset",
          sourceLabel: preset.category?.name,
          sourceColor: preset.category?.color,
          sourceName: preset.name,
          bindingId,
        });
        for (const l of resolved.lora1) {
          if (!loraConfig.lora1.some((e) => e.path === l.path)) {
            loraConfig.lora1.push(makeLora(l));
          }
        }
        for (const l of resolved.lora2) {
          if (!loraConfig.lora2.some((e) => e.path === l.path)) {
            loraConfig.lora2.push(makeLora(l));
          }
        }
      }
    }

    // Persist the composed loraConfig
    if (loraConfig.lora1.length > 0 || loraConfig.lora2.length > 0) {
      await prisma.projectSection.update({
        where: { id: section.id },
        data: { loraConfig: loraConfig as Prisma.InputJsonValue },
      });
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return section.id;
}

// ---------------------------------------------------------------------------
// 批量创建小节：按模板创建（含额外导入 + 变体覆盖 + 画幅配置）
// ---------------------------------------------------------------------------

export type CreateSectionFromTemplateInput = {
  projectId: string;
  name?: string;
  aspectRatio?: string;
  shortSidePx?: number;
  extraImports: Array<{
    presetId: string;
    variantId: string;
    groupBindingId?: string;
  }>;
  bindingVariantOverrides: Array<{
    presetId: string;
    variantId: string;
  }>;
};

export async function createSectionFromTemplate(
  input: CreateSectionFromTemplateInput,
): Promise<string> {
  const { projectId, name, aspectRatio, shortSidePx, extraImports, bindingVariantOverrides } = input;

  // 1. 创建小节（自动导入项目级绑定）
  const sectionId = await addSection(projectId, name);

  // 2. 覆盖项目级绑定的变体
  if (bindingVariantOverrides.length > 0) {
    const blocks = await prisma.promptBlock.findMany({
      where: { projectSectionId: sectionId, type: "preset" },
      select: { id: true, bindingId: true, sourceId: true },
    });

    for (const override of bindingVariantOverrides) {
      // 找到 sourceId 匹配的 binding
      const block = blocks.find((b) => b.sourceId === override.presetId);
      if (block?.bindingId) {
        await switchBindingVariant(sectionId, block.bindingId, override.variantId);
      }
    }
  }

  // 3. 导入额外预制
  for (const imp of extraImports) {
    await importPresetToSection(sectionId, imp.presetId, imp.variantId, imp.groupBindingId);
  }

  // 4. 更新画幅配置
  if (aspectRatio || shortSidePx) {
    await prisma.projectSection.update({
      where: { id: sectionId },
      data: {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(shortSidePx ? { shortSidePx } : {}),
      },
    });
    revalidatePath(`/projects/${projectId}`);
  }

  return sectionId;
}

// ---------------------------------------------------------------------------
// 重命名小节
// ---------------------------------------------------------------------------

export async function renameSection(sectionId: string, name: string): Promise<void> {
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section) return;

  await prisma.projectSection.update({
    where: { id: sectionId },
    data: { name: name.trim() || null },
  });

  revalidatePath(`/projects/${section.projectId}`);
}

// ---------------------------------------------------------------------------
// 小节排序
// ---------------------------------------------------------------------------

export type ReorderSectionsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function reorderSections(projectId: string, sectionIds: string[]): Promise<ReorderSectionsResult> {
  // 0. 检查是否有正在执行的 run，避免重排序导致输出路径不一致
  const runningCount = await prisma.run.count({
    where: {
      projectId: projectId,
      status: { in: ["queued", "running"] },
    },
  });
  if (runningCount > 0) {
    return { ok: false, message: "有正在执行或排队中的任务，请等待完成后再调整顺序" };
  }

  // 1. 查询旧 sortOrder、name 和 project title（用于文件夹重命名）
  const sections = await prisma.projectSection.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, sortOrder: true, name: true },
  });
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });

  const oldSortMap = new Map(sections.map((s) => [s.id, {
    sortOrder: s.sortOrder,
    name: s.name || "position",
  }]));

  // 2. 批量更新 sortOrder
  await prisma.$transaction(
    sectionIds.map((id, index) =>
      prisma.projectSection.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 复制小节
// ---------------------------------------------------------------------------

export async function copySection(sectionId: string): Promise<string | null> {
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    include: {
      promptBlocks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!section) return null;

  // 获取当前任务的小节数量以确定新的 sortOrder
  const count = await prisma.projectSection.count({
    where: { projectId: section.projectId },
  });

  // 创建新小节
  const newSection = await prisma.projectSection.create({
    data: {
      projectId: section.projectId,
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
      upscaleFactor: section.upscaleFactor ?? undefined,
      loraConfig: section.loraConfig ?? undefined,
      extraParams: section.extraParams ?? undefined,
    },
  });

  // 复制所有 PromptBlocks
  if (section.promptBlocks.length > 0) {
    await prisma.promptBlock.createMany({
      data: section.promptBlocks.map((block) => ({
        projectSectionId: newSection.id,
        type: block.type,
        sourceId: block.sourceId,
        variantId: block.variantId,
        categoryId: block.categoryId,
        bindingId: block.bindingId,
        groupBindingId: block.groupBindingId,
        label: block.label,
        positive: block.positive,
        negative: block.negative,
        sortOrder: block.sortOrder,
      })),
    });
  }

  revalidatePath(`/projects/${section.projectId}`);
  return newSection.id;
}

// ---------------------------------------------------------------------------
// 删除小节
// ---------------------------------------------------------------------------

export async function deleteSection(sectionId: string): Promise<void> {
  const section = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section) return;

  // 先删除所有 PromptBlocks
  await prisma.promptBlock.deleteMany({
    where: { projectSectionId: sectionId },
  });

  // 再删除小节
  await prisma.projectSection.delete({
    where: { id: sectionId },
  });

  revalidatePath(`/projects/${section.projectId}`);
}

// ---------------------------------------------------------------------------
// 批量删除小节
// ---------------------------------------------------------------------------

export async function deleteSections(sectionIds: string[]): Promise<void> {
  if (sectionIds.length === 0) return;

  // Get projectIds for revalidation
  const sections = await prisma.projectSection.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, projectId: true },
  });

  // Delete all PromptBlocks for these sections
  await prisma.promptBlock.deleteMany({
    where: { projectSectionId: { in: sectionIds } },
  });

  // Delete the sections
  await prisma.projectSection.deleteMany({
    where: { id: { in: sectionIds } },
  });

  // Revalidate unique project paths
  const uniqueProjectIds = [...new Set(sections.map((s) => s.projectId))];
  for (const projectId of uniqueProjectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
}

// ---------------------------------------------------------------------------
// 删除项目（级联删除所有小节、提示词块、运行记录、图片记录）
// ---------------------------------------------------------------------------

export async function deleteProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return;

  // Prisma onDelete: Cascade handles sections, runs, blocks, images
  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Project Template CRUD
// ---------------------------------------------------------------------------

import type { ProjectTemplateSectionData } from "@/lib/server-data";

export type CreateProjectTemplateInput = {
  name: string;
  description?: string | null;
  sections: ProjectTemplateSectionData[];
};

export async function createProjectTemplate(
  input: CreateProjectTemplateInput,
): Promise<string> {
  const template = await prisma.projectTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      sections: {
        create: input.sections.map((s, index) => ({
          sortOrder: s.sortOrder ?? index,
          name: s.name,
          aspectRatio: s.aspectRatio,
          shortSidePx: s.shortSidePx,
          batchSize: s.batchSize,
          seedPolicy1: s.seedPolicy1,
          seedPolicy2: s.seedPolicy2,
          ksampler1: s.ksampler1 ? toJsonValue(s.ksampler1) : undefined,
          ksampler2: s.ksampler2 ? toJsonValue(s.ksampler2) : undefined,
          upscaleFactor: s.upscaleFactor,
          loraConfig: s.loraConfig ? toJsonValue(s.loraConfig) : undefined,
          extraParams: s.extraParams ? toJsonValue(s.extraParams) : undefined,
          promptBlocks:
            s.promptBlocks.length > 0 ? toJsonValue(s.promptBlocks) : undefined,
        })),
      },
    },
  });
  revalidatePath("/assets/templates");
  return template.id;
}

export type UpdateProjectTemplateInput = {
  id: string;
  name?: string;
  description?: string | null;
  sections?: ProjectTemplateSectionData[];
};

export async function updateProjectTemplate(
  input: UpdateProjectTemplateInput,
): Promise<void> {
  const { id, sections, ...rest } = input;

  await prisma.$transaction(async (tx) => {
    await tx.projectTemplate.update({
      where: { id },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
      },
    });

    if (sections) {
      await tx.projectTemplateSection.deleteMany({
        where: { projectTemplateId: id },
      });
      if (sections.length > 0) {
        await tx.projectTemplateSection.createMany({
          data: sections.map((s, index) => ({
            projectTemplateId: id,
            sortOrder: s.sortOrder ?? index,
            name: s.name,
            aspectRatio: s.aspectRatio,
            shortSidePx: s.shortSidePx,
            batchSize: s.batchSize,
            seedPolicy1: s.seedPolicy1,
            seedPolicy2: s.seedPolicy2,
            ksampler1: s.ksampler1
              ? (JSON.parse(JSON.stringify(s.ksampler1)) as Prisma.InputJsonValue)
              : undefined,
            ksampler2: s.ksampler2
              ? (JSON.parse(JSON.stringify(s.ksampler2)) as Prisma.InputJsonValue)
              : undefined,
            upscaleFactor: s.upscaleFactor,
            loraConfig: s.loraConfig
              ? (JSON.parse(JSON.stringify(s.loraConfig)) as Prisma.InputJsonValue)
              : undefined,
            extraParams: s.extraParams
              ? (JSON.parse(JSON.stringify(s.extraParams)) as Prisma.InputJsonValue)
              : undefined,
            promptBlocks:
              s.promptBlocks.length > 0
                ? (JSON.parse(JSON.stringify(s.promptBlocks)) as Prisma.InputJsonValue)
                : undefined,
          })),
        });
      }
    }
  });

  revalidatePath("/assets/templates");
  revalidatePath(`/assets/templates/${id}/edit`);
}

export async function deleteProjectTemplate(
  templateId: string,
): Promise<void> {
  await prisma.projectTemplate.delete({ where: { id: templateId } });
  revalidatePath("/assets/templates");
}

export async function getTemplateOptionsForClient(): Promise<
  Array<{ id: string; name: string; sectionCount: number }>
> {
  const templates = await prisma.projectTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, _count: { select: { sections: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    sectionCount: t._count.sections,
  }));
}

// ---------------------------------------------------------------------------
// Import Template into Project
// ---------------------------------------------------------------------------

export async function importTemplateToProject(
  projectId: string,
  templateId: string,
): Promise<number> {
  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { presetBindings: true },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const currentSectionCount = await prisma.projectSection.count({
    where: { projectId },
  });

  // Resolve project presetBindings
  const bindings = Array.isArray(project.presetBindings)
    ? (project.presetBindings as PresetBinding[])
    : [];

  // Fetch presets for project bindings
  const presets = bindings.length > 0
    ? await prisma.preset.findMany({
        where: { id: { in: bindings.map((b) => b.presetId) } },
        include: {
          category: true,
          variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      })
    : [];
  const presetMap = new Map(presets.map((p) => [p.id, p]));

  // Fetch all categories for order lookup
  const allCategories = await prisma.presetCategory.findMany({
    select: { id: true, name: true, positivePromptOrder: true, lora1Order: true, lora2Order: true },
  });
  const catByIdMap = new Map(allCategories.map((c) => [c.id, c]));
  const catByNameMap = new Map(allCategories.map((c) => [c.name, c]));

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < template.sections.length; i++) {
      const ts = template.sections[i];

      // 1. Create section with basic params
      const section = await tx.projectSection.create({
        data: {
          projectId,
          sortOrder: currentSectionCount + i + 1,
          enabled: true,
          name: ts.name,
          ...(ts.aspectRatio ? { aspectRatio: ts.aspectRatio } : {}),
          ...(ts.shortSidePx ? { shortSidePx: ts.shortSidePx } : {}),
          ...(ts.batchSize ? { batchSize: ts.batchSize } : {}),
          ...(ts.seedPolicy1 ? { seedPolicy1: ts.seedPolicy1 } : {}),
          ...(ts.seedPolicy2 ? { seedPolicy2: ts.seedPolicy2 } : {}),
          ...(ts.ksampler1 ? { ksampler1: ts.ksampler1 } : {}),
          ...(ts.ksampler2 ? { ksampler2: ts.ksampler2 } : {}),
          ...(ts.upscaleFactor ? { upscaleFactor: ts.upscaleFactor } : {}),
          extraParams: ts.extraParams ?? undefined,
        },
      });

      // 2. Collect all blocks (from project bindings + from template)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allBlocks: Array<{
        type: "preset" | "custom";
        sourceId: string | null;
        variantId: string | null;
        categoryId: string | null;
        bindingId: string | null;
        groupBindingId: string | null;
        label: string;
        positive: string;
        negative: string | null;
        positivePromptOrder: number;
        loras: { lora1: any[]; lora2: any[] };
      }> = [];

      // 2a. Add blocks from project bindings
      for (const binding of bindings) {
        const preset = presetMap.get(binding.presetId);
        if (!preset) continue;

        const variant = binding.variantId
          ? preset.variants.find((v) => v.id === binding.variantId)
          : preset.variants[0];
        if (!variant) continue;

        const resolved = await resolveVariantContent(variant.id);
        const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const catOrder = preset.category?.positivePromptOrder ?? 999;

        const makeLora = (b: { path: string; weight: number; enabled: boolean }) => ({
          id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          path: b.path,
          weight: b.weight,
          enabled: b.enabled,
          source: "preset" as const,
          sourceLabel: preset.category?.name,
          sourceColor: preset.category?.color,
          sourceName: preset.name,
          bindingId,
        });

        allBlocks.push({
          type: "preset",
          sourceId: preset.id,
          variantId: variant.id,
          categoryId: preset.categoryId,
          bindingId,
          groupBindingId: null,
          label: preset.variants.length === 1 ? preset.name : `${preset.name} / ${variant.name}`,
          positive: resolved.prompt,
          negative: resolved.negativePrompt,
          positivePromptOrder: catOrder,
          loras: {
            lora1: resolved.lora1.map(makeLora),
            lora2: resolved.lora2.map(makeLora),
          },
        });
      }

      // 2b. Add blocks from template
      const tplBlocks = ts.promptBlocks;
      if (Array.isArray(tplBlocks)) {
        // Build mapping for bindingIds (old -> new)
        const bindingIdMap = new Map<string, string>();
        const groupBindingIdMap = new Map<string, string>();

        for (const rawBlock of tplBlocks) {
          if (!rawBlock || typeof rawBlock !== "object") continue;
          const block = rawBlock as Record<string, unknown>;

          if (block.type === "preset") {
            if (typeof block.bindingId === "string" && !bindingIdMap.has(block.bindingId)) {
              bindingIdMap.set(block.bindingId, `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
            }
            if (typeof block.groupBindingId === "string" && !groupBindingIdMap.has(block.groupBindingId)) {
              groupBindingIdMap.set(block.groupBindingId, `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
            }
          }
        }

        for (const rawBlock of tplBlocks) {
          if (!rawBlock || typeof rawBlock !== "object") continue;
          const block = rawBlock as Record<string, unknown>;
          const positive = typeof block.positive === "string" ? block.positive : "";
          if (!positive.trim()) continue;

          const blockType = block.type === "preset" ? "preset" : "custom";
          const categoryId = typeof block.categoryId === "string" ? block.categoryId : null;
          const catOrder = categoryId ? (catByIdMap.get(categoryId)?.positivePromptOrder ?? 999) : 999;

          const oldBindingId = typeof block.bindingId === "string" ? block.bindingId : null;
          const oldGroupBindingId = typeof block.groupBindingId === "string" ? block.groupBindingId : null;
          const newBindingId = oldBindingId ? (bindingIdMap.get(oldBindingId) ?? null) : null;
          const newGroupBindingId = oldGroupBindingId ? (groupBindingIdMap.get(oldGroupBindingId) ?? null) : null;

          // Collect loras for this block (will be merged later)
          const blockLoras: { lora1: any[]; lora2: any[] } = { lora1: [], lora2: [] };

          allBlocks.push({
            type: blockType,
            sourceId: null,
            variantId: null,
            categoryId,
            bindingId: newBindingId,
            groupBindingId: newGroupBindingId,
            label: (typeof block.label === "string" ? block.label : null) || `Block ${allBlocks.length + 1}`,
            positive,
            negative: typeof block.negative === "string" ? block.negative : null,
            positivePromptOrder: catOrder,
            loras: blockLoras, // Template blocks don't carry loras directly; loras are in loraConfig
          });
        }
      }

      // 3. Sort all blocks by positivePromptOrder
      allBlocks.sort((a, b) => a.positivePromptOrder - b.positivePromptOrder);

      // 4. Create blocks in sorted order
      const positiveParts: string[] = [];
      const negativeParts: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loraConfig: { lora1: any[]; lora2: any[] } = { lora1: [], lora2: [] };

      for (let sortOrder = 0; sortOrder < allBlocks.length; sortOrder++) {
        const block = allBlocks[sortOrder];

        await tx.promptBlock.create({
          data: {
            projectSectionId: section.id,
            type: block.type,
            sourceId: block.sourceId,
            variantId: block.variantId,
            categoryId: block.categoryId,
            bindingId: block.bindingId,
            groupBindingId: block.groupBindingId,
            label: block.label,
            positive: block.positive,
            negative: block.negative,
            sortOrder,
          },
        });

        if (block.positive?.trim()) positiveParts.push(block.positive.trim());
        if (block.negative?.trim()) negativeParts.push(block.negative.trim());

        // Add loras from this block (deduplicate by path)
        for (const l of block.loras.lora1) {
          if (!loraConfig.lora1.some((e) => e.path === l.path)) {
            loraConfig.lora1.push(l);
          }
        }
        for (const l of block.loras.lora2) {
          if (!loraConfig.lora2.some((e) => e.path === l.path)) {
            loraConfig.lora2.push(l);
          }
        }
      }

      // 5. Add loras from template loraConfig (not associated with specific blocks)
      const tplLoraConfig = ts.loraConfig as Record<string, unknown> | null;
      if (tplLoraConfig) {
        // Build bindingId mapping for template loras
        const loraBindingIdMap = new Map<string, string>();
        const loraGroupBindingIdMap = new Map<string, string>();

        const buildLoraBindingMaps = (arr: unknown) => {
          if (!Array.isArray(arr)) return;
          for (const e of arr) {
            if (typeof e !== "object" || e === null) continue;
            const entry = e as Record<string, unknown>;
            if (entry.source === "preset") {
              if (typeof entry.bindingId === "string" && !loraBindingIdMap.has(entry.bindingId)) {
                loraBindingIdMap.set(entry.bindingId, `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
              }
              if (typeof entry.groupBindingId === "string" && !loraGroupBindingIdMap.has(entry.groupBindingId)) {
                loraGroupBindingIdMap.set(entry.groupBindingId, `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
              }
            }
          }
        };
        buildLoraBindingMaps(tplLoraConfig.lora1);
        buildLoraBindingMaps(tplLoraConfig.lora2);

        const appendTemplateLoras = (arr: unknown, dimension: "lora1" | "lora2") => {
          if (!Array.isArray(arr)) return;
          for (const entry of arr) {
            if (typeof entry !== "object" || entry === null) continue;
            const e = entry as Record<string, unknown>;
            const path = typeof e.path === "string" ? e.path : "";
            if (!path) continue;
            if (loraConfig[dimension].some((existing) => existing.path === path)) continue;

            const source = typeof e.source === "string" && e.source === "preset" ? "preset" : "manual";
            const sourceLabel = typeof e.sourceLabel === "string" ? e.sourceLabel : undefined;
            const sourceColor = typeof e.sourceColor === "string" ? e.sourceColor : undefined;
            const sourceName = typeof e.sourceName === "string" ? e.sourceName : undefined;

            const oldBindingId = typeof e.bindingId === "string" ? e.bindingId : undefined;
            const oldGroupBindingId = typeof e.groupBindingId === "string" ? e.groupBindingId : undefined;
            const newBindingId = oldBindingId ? (loraBindingIdMap.get(oldBindingId) ?? undefined) : undefined;
            const newGroupBindingId = oldGroupBindingId ? (loraGroupBindingIdMap.get(oldGroupBindingId) ?? undefined) : undefined;

            loraConfig[dimension].push({
              id: e.id ?? `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              path,
              weight: typeof e.weight === "number" ? e.weight : 1,
              enabled: typeof e.enabled === "boolean" ? e.enabled : true,
              source,
              sourceLabel,
              sourceColor,
              sourceName,
              bindingId: newBindingId,
              groupBindingId: newGroupBindingId,
            });
          }
        };
        appendTemplateLoras(tplLoraConfig.lora1, "lora1");
        appendTemplateLoras(tplLoraConfig.lora2, "lora2");
      }

      // 6. Sort loras by category order
      for (const dim of ["lora1", "lora2"] as const) {
        const orderKey = dim === "lora1" ? "lora1Order" : "lora2Order";
        loraConfig[dim].sort((a, b) => {
          const aOrder = a.source === "preset" && a.sourceLabel
            ? (catByNameMap.get(a.sourceLabel)?.[orderKey] ?? 999)
            : 999;
          const bOrder = b.source === "preset" && b.sourceLabel
            ? (catByNameMap.get(b.sourceLabel)?.[orderKey] ?? 999)
            : 999;
          return aOrder - bOrder;
        });
      }

      // 7. Update section with composed prompts and loraConfig
      await tx.projectSection.update({
        where: { id: section.id },
        data: {
          positivePrompt: positiveParts.length > 0 ? positiveParts.join(" BREAK ") : undefined,
          negativePrompt: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : undefined,
          loraConfig: (loraConfig.lora1.length > 0 || loraConfig.lora2.length > 0)
            ? (loraConfig as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }
  });

  revalidatePath(`/projects/${projectId}`);
  return template.sections.length;
}

// ---------------------------------------------------------------------------
// Save Project as Template
// ---------------------------------------------------------------------------

export async function saveProjectAsTemplate(
  projectId: string,
  templateName: string,
  templateDescription?: string | null,
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      presetBindings: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          promptBlocks: {
            orderBy: { sortOrder: "asc" },
            select: {
              type: true,
              sourceId: true,
              variantId: true,
              categoryId: true,
              bindingId: true,
              groupBindingId: true,
              label: true,
              positive: true,
              negative: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  // Get project-level presetIds (these should NOT be saved to template)
  const projectPresetIds = new Set<string>();
  if (Array.isArray(project.presetBindings)) {
    for (const binding of project.presetBindings as PresetBinding[]) {
      projectPresetIds.add(binding.presetId);
    }
  }

  const template = await prisma.projectTemplate.create({
    data: {
      name: templateName,
      description: templateDescription ?? null,
      sections: {
        create: project.sections.map((section) => {
          // Filter out blocks from project-level bindings, keep section-level imports
          // For section-level imports, preserve bindingId/groupBindingId for group relationship
          const templateBlocks = section.promptBlocks
            .filter((block) => {
              // Keep custom blocks
              if (block.type === "custom") return true;
              // For preset blocks: only keep if NOT from project-level binding
              if (block.sourceId && projectPresetIds.has(block.sourceId)) return false;
              return true;
            })
            .map((block) => ({
              type: block.type,
              label: block.label,
              positive: block.positive,
              negative: block.negative,
              sortOrder: block.sortOrder,
              categoryId: block.categoryId,
              // Preserve bindingId and groupBindingId for section-level imports
              bindingId: block.type === "preset" ? block.bindingId : undefined,
              groupBindingId: block.type === "preset" ? block.groupBindingId : undefined,
            }));

          // Filter out loras from project-level bindings, keep section-level imports
          const loraCfg = section.loraConfig as Record<string, unknown> | null;
          const filterSectionLoras = (arr: unknown) => {
            if (!Array.isArray(arr)) return [];
            return arr
              .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
              .filter((e) => {
                // Keep manual loras
                if (e.source !== "preset") return true;
                // For preset loras: check if from project-level binding
                // Loras from project-level bindings don't have bindingId that matches section-level imports
                // But we need another way to identify them...
                // Actually, loras from project-level bindings also have bindingId.
                // We need to check if the bindingId corresponds to a project-level preset.
                // But we don't have sourceId on loras...
                // 
                // Alternative: check sourceName against project presetIds by looking up preset names.
                // But that's complex. Let me think...
                //
                // Simpler approach: loras from project-level bindings have the same bindingId
                // as prompt blocks from project-level bindings. So if we filter those blocks,
                // we should also filter loras with matching bindingIds.
                return true; // Keep for now, will filter below
              });
          };
          
          // Get bindingIds from project-level blocks (to filter loras)
          const projectLevelBindingIds = new Set<string>();
          for (const block of section.promptBlocks) {
            if (block.type === "preset" && block.sourceId && projectPresetIds.has(block.sourceId) && block.bindingId) {
              projectLevelBindingIds.add(block.bindingId);
            }
          }

          const filterLorasByBinding = (arr: unknown) => {
            if (!Array.isArray(arr)) return [];
            return arr
              .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
              .filter((e) => {
                // Keep manual loras
                if (e.source !== "preset") return true;
                // Filter out loras from project-level bindings
                if (e.bindingId && projectLevelBindingIds.has(e.bindingId as string)) return false;
                return true;
              })
              .map((e) => ({
                id: e.id,
                path: e.path,
                weight: e.weight,
                enabled: e.enabled,
                source: e.source,
                sourceLabel: e.sourceLabel,
                sourceColor: e.sourceColor,
                sourceName: e.sourceName,
                // Preserve bindingId and groupBindingId for section-level imports
                bindingId: e.source === "preset" ? e.bindingId : undefined,
                groupBindingId: e.source === "preset" ? e.groupBindingId : undefined,
              }));
          };
          
          const templateLoraConfig = loraCfg
            ? { lora1: filterLorasByBinding(loraCfg.lora1), lora2: filterLorasByBinding(loraCfg.lora2) }
            : null;

          return {
            sortOrder: section.sortOrder,
            name: section.name,
            aspectRatio: section.aspectRatio,
            shortSidePx: section.shortSidePx,
            batchSize: section.batchSize,
            seedPolicy1: section.seedPolicy1,
            seedPolicy2: section.seedPolicy2,
            ksampler1: section.ksampler1 ?? undefined,
            ksampler2: section.ksampler2 ?? undefined,
            upscaleFactor: section.upscaleFactor ?? undefined,
            loraConfig: (templateLoraConfig && (templateLoraConfig.lora1.length > 0 || templateLoraConfig.lora2.length > 0))
              ? templateLoraConfig
              : undefined,
            extraParams: section.extraParams ?? undefined,
            promptBlocks: templateBlocks.length > 0 ? templateBlocks : undefined,
          };
        }),
      },
    },
  });

  revalidatePath("/assets/templates");
  return template.id;
}
