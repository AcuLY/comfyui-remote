"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { PresetBinding } from "./project";
import { resolveVariantContent } from "./preset-variant";
import { createBindingId, createLoraEntryId } from "./_helpers";
import { importPresetToSection } from "./prompt-block";
import { switchBindingVariant } from "./prompt-block";

// ---------------------------------------------------------------------------
// Types
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

export type ReorderSectionsResult =
  | { ok: true }
  | { ok: false; message: string };

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
        const bindingId = createBindingId();

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
          id: createLoraEntryId(),
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

  // 1. 批量更新 sortOrder
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
      checkpointName: section.checkpointName,
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
