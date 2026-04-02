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
// 运行整个项目
// ---------------------------------------------------------------------------

export async function runProject(projectId: string, overrideBatchSize?: number | null) {
  await enqueueProjectRunsRepo(projectId, overrideBatchSize ?? undefined);
  revalidatePath("/projects");
  revalidatePath("/queue");

  // Fire-and-forget: submit queued runs directly to ComfyUI
  executeQueuedRuns().catch(() => {});
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

  await enqueueProjectSectionRunRepo(pos.projectId, sectionId, overrideBatchSize ?? undefined);
  revalidatePath("/projects");
  revalidatePath("/queue");

  // Fire-and-forget: submit queued runs directly to ComfyUI
  executeQueuedRuns().catch(() => {});
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
  const cat = await prisma.presetCategory.create({ data: input });
  revalidatePath("/assets/prompts");
  return cat;
}

export async function updatePresetCategory(id: string, input: Partial<PresetCategoryInput>) {
  const cat = await prisma.presetCategory.update({ where: { id }, data: input });
  revalidatePath("/assets/prompts");
  return cat;
}

export async function deletePresetCategory(id: string) {
  // Only allow deletion if no presets exist in this category
  const count = await prisma.preset.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(`分类下还有 ${count} 个模板，请先删除或移动它们`);
  }
  await prisma.presetCategory.delete({ where: { id } });
  revalidatePath("/assets/prompts");
}

export async function reorderPresetCategories(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath("/assets/prompts");
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
  revalidatePath("/assets/prompts");
  revalidatePath("/assets/prompts/sort-rules");
}

// ---------------------------------------------------------------------------
// Preset CRUD (unified prompt system with variants)
// ---------------------------------------------------------------------------

export type PresetInput = {
  categoryId: string;
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
  isActive?: boolean;
  sortOrder?: number;
};

export async function createPreset(input: PresetInput) {
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.preset.aggregate({
      where: { categoryId: input.categoryId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }
  const preset = await prisma.preset.create({
    data: input,
  });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
  return preset;
}

export async function createPresetVariant(input: PresetVariantInput) {
  const { lora1, lora2, defaultParams, ...rest } = input;
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
    },
  });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
  return variant;
}

export async function updatePreset(id: string, input: Partial<PresetInput>) {
  const preset = await prisma.preset.update({ where: { id }, data: input });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
  return preset;
}

export async function updatePresetVariant(id: string, input: Partial<PresetVariantInput>) {
  const { lora1, lora2, defaultParams, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
  if (lora1 !== undefined) data.lora1 = toJsonValue(lora1) ?? Prisma.DbNull;
  if (lora2 !== undefined) data.lora2 = toJsonValue(lora2) ?? Prisma.DbNull;
  if (defaultParams !== undefined) data.defaultParams = toJsonValue(defaultParams) ?? Prisma.DbNull;

  const variant = await prisma.presetVariant.update({ where: { id }, data });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
  return variant;
}

export async function deletePreset(id: string) {
  // Soft delete: set isActive = false
  await prisma.preset.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
}

export async function deletePresetVariant(id: string) {
  // Soft delete: set isActive = false
  await prisma.presetVariant.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/assets/prompts");
  revalidatePath("/projects/new");
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

  revalidatePath("/assets/prompts");
  revalidatePath("/projects");
}

/** Sync preset variant content to all sections that imported it */
export async function syncPresetToSections(presetId: string) {
  // 1. Load preset with active variants
  const preset = await prisma.preset.findUnique({
    where: { id: presetId },
    include: {
      category: { select: { name: true, color: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!preset || preset.variants.length === 0) return;

  const defaultVariant = preset.variants[0];

  // 2. Find all blocks referencing this preset
  const blocks = await prisma.promptBlock.findMany({
    where: { sourceId: presetId },
    select: { id: true, bindingId: true, projectSectionId: true, label: true },
  });

  if (blocks.length === 0) return;

  // 3. Update each block's prompt content
  for (const block of blocks) {
    // Try to match variant by label, fallback to default
    let variant = defaultVariant;
    for (const v of preset.variants) {
      const expectedLabel = preset.variants.length === 1
        ? preset.name
        : `${preset.name} / ${v.name}`;
      if (block.label === expectedLabel) {
        variant = v;
        break;
      }
    }

    const label = preset.variants.length === 1
      ? preset.name
      : `${preset.name} / ${variant.name}`;

    await prisma.promptBlock.update({
      where: { id: block.id },
      data: {
        label,
        positive: variant.prompt,
        negative: variant.negativePrompt,
      },
    });

    // 4. Update LoRA in section's loraConfig if this block has a bindingId
    if (block.bindingId) {
      const section = await prisma.projectSection.findUnique({
        where: { id: block.projectSectionId },
        select: { loraConfig: true },
      });
      if (!section?.loraConfig) continue;

      const config = section.loraConfig as {
        lora1?: Array<Record<string, unknown>>;
        lora2?: Array<Record<string, unknown>>;
      };
      let changed = false;

      // Parse variant LoRA bindings
      const variantLora1 = Array.isArray(variant.lora1) ? (variant.lora1 as Array<{ path: string; weight: number; enabled: boolean }>) : [];
      const variantLora2 = Array.isArray(variant.lora2) ? (variant.lora2 as Array<{ path: string; weight: number; enabled: boolean }>) : [];

      // Replace LoRAs with this bindingId in lora1
      if (config.lora1) {
        const otherLoras = config.lora1.filter((e) => e.bindingId !== block.bindingId);
        const newLoras = variantLora1.map((b) => ({
          id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          path: b.path,
          weight: b.weight,
          enabled: b.enabled,
          source: "preset",
          sourceLabel: preset.category.name,
          sourceColor: preset.category.color,
          sourceName: preset.name,
          bindingId: block.bindingId,
        }));
        config.lora1 = [...otherLoras, ...newLoras];
        changed = true;
      }

      // Replace LoRAs with this bindingId in lora2
      if (config.lora2) {
        const otherLoras = config.lora2.filter((e) => e.bindingId !== block.bindingId);
        const newLoras = variantLora2.map((b) => ({
          id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          path: b.path,
          weight: b.weight,
          enabled: b.enabled,
          source: "preset",
          sourceLabel: preset.category.name,
          sourceColor: preset.category.color,
          sourceName: preset.name,
          bindingId: block.bindingId,
        }));
        config.lora2 = [...otherLoras, ...newLoras];
        changed = true;
      }

      if (changed) {
        await prisma.projectSection.update({
          where: { id: block.projectSectionId },
          data: { loraConfig: config as Prisma.InputJsonValue },
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
  revalidatePath("/assets/prompts");
}

export async function reorderPresetVariants(presetId: string, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.presetVariant.update({ where: { id }, data: { sortOrder: index } }),
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
  bindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export async function listSectionBlocks(sectionId: string): Promise<PromptBlockData[]> {
  const { listPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const blocks = await listPromptBlocks(sectionId);
  return blocks;
}

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

  const block = await updatePromptBlock(blockId, input);
  audit("PromptBlock", blockId, "update", Object.fromEntries(Object.entries(input)), "user" as const);
  return block;
}

export async function deleteSectionBlock(blockId: string): Promise<void> {
  const { deletePromptBlock } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  await deletePromptBlock(blockId);
  audit("PromptBlock", blockId, "delete", {}, "user" as const);
}

export async function reorderSectionBlocks(
  sectionId: string,
  blockIds: string[],
): Promise<PromptBlockData[]> {
  const { reorderPromptBlocks } = await import("@/server/repositories/prompt-block-repository");
  const { audit } = await import("@/server/services/audit-service");

  const reordered = await reorderPromptBlocks(sectionId, blockIds);
  audit("PromptBlock", sectionId, "reorder", { blockIds }, "user" as const);
  return reordered;
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

    for (const binding of sortedBindings) {
      const preset = presetMap.get(binding.presetId);
      if (!preset) continue;

      // 获取变体（如果指定了 variantId，否则使用第一个变体）
      const variant = binding.variantId
        ? preset.variants.find(v => v.id === binding.variantId)
        : preset.variants[0];

      if (variant) {
        // Generate a bindingId to link this block with its LoRAs
        const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        await prisma.promptBlock.create({
          data: {
            projectSectionId: section.id,
            type: "preset",
            sourceId: preset.id,
            categoryId: preset.categoryId,
            bindingId,
            label: `${preset.name} - ${variant.name}`,
            positive: variant.prompt,
            negative: variant.negativePrompt,
            sortOrder: blockSortOrder++,
          },
        });
      }
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return section.id;
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

export async function reorderSections(projectId: string, sectionIds: string[]): Promise<void> {
  // 0. 检查是否有正在执行的 run，避免重排序导致输出路径不一致
  const runningCount = await prisma.run.count({
    where: {
      projectId: projectId,
      status: { in: ["queued", "running"] },
    },
  });
  if (runningCount > 0) {
    throw new Error("有正在执行或排队中的任务，请等待完成后再调整顺序");
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
