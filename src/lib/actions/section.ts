"use server";

import { revalidatePath } from "next/cache";
import { rm } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { cleanupProjectSectionFiles } from "@/server/services/section-cleanup-service";
import { isPathInsideDirectory, resolveDataPath, resolveProjectPath } from "@/server/services/runtime-data-path";
import { createBindingId } from "./_helpers";
import {
  assertOrdinaryPresetLibraryBindingRefs,
  assertOrdinaryProjectPresetBindingRefs,
} from "./preset-resource-scope";
import { importPresetGroupToSection, importPresetToSection } from "./prompt-block";
import { switchBindingVariant } from "./prompt-block";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateSectionFromTemplateInput = {
  projectId: string;
  name?: string;
  aspectRatio?: string;
  aspectRatios?: string[];
  shortSidePx?: number;
  extraImports: Array<
    | {
        presetId: string;
        variantId: string;
        groupBindingId?: string;
      }
    | {
        presetGroupId: string;
      }
  >;
  bindingVariantOverrides: Array<{
    presetId: string;
    variantId: string;
  }>;
};

export type ReorderSectionsResult =
  | { ok: true }
  | { ok: false; message: string };

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("static generation store missing")
    ) {
      return;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 添加小节（Section）
// ---------------------------------------------------------------------------

export async function addSection(projectId: string, name?: string, folderId?: string | null): Promise<string> {
  // 获取项目信息以创建初始 PromptBlocks
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: {
      id: true,
      presetBindingRows: {
        orderBy: { sortOrder: "asc" },
        select: {
          categoryId: true,
          presetId: true,
          variantId: true,
          sortOrder: true,
          category: { select: { positivePromptOrder: true } },
        },
      },
      // 读取项目级别的默认值
      projectLevelOverrides: true,
      _count: { select: { sections: true } },
    },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");
  await assertOrdinaryProjectPresetBindingRefs(project.presetBindingRows);
  if (folderId) {
    const folder = await prisma.projectSectionFolder.findFirst({
      where: {
        id: folderId,
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
      select: { id: true },
    });
    if (!folder) throw new Error("SECTION_FOLDER_NOT_FOUND");
  }

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
      folderId: folderId ?? null,
      sortOrder,
      enabled: true,
      name: name || null,
      aspectRatio: defaultAspectRatio,
      aspectRatios: [defaultAspectRatio],
      shortSidePx: defaultShortSidePx,
      batchSize: defaultBatchSize,
      upscaleFactor: defaultUpscaleFactor,
      useTwoStageKSampler: true,
      seedPolicy1: defaultSeedPolicy1,
      seedPolicy2: defaultSeedPolicy2,
      ksampler1: (defaultKsampler1 as object) ?? undefined,
      ksampler2: (defaultKsampler2 as object) ?? undefined,
    },
  });

  type InitialSectionBinding = {
    categoryId: string;
    presetId: string;
    variantId: string | null;
    sortOrder: number;
    categoryOrder: number;
  };
  const initialBindings: InitialSectionBinding[] = project.presetBindingRows.map((binding) => ({
    categoryId: binding.categoryId,
    presetId: binding.presetId,
    variantId: binding.variantId,
    sortOrder: binding.sortOrder,
    categoryOrder: binding.category.positivePromptOrder,
  }));

  initialBindings.sort((left, right) =>
    left.categoryOrder - right.categoryOrder || left.sortOrder - right.sortOrder,
  );

  if (initialBindings.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const [index, binding] of initialBindings.entries()) {
        const sectionBinding = await tx.sectionPresetBinding.create({
          data: {
            projectSectionId: section.id,
            bindingKey: createBindingId(),
            categoryId: binding.categoryId,
            presetId: binding.presetId,
            variantId: binding.variantId,
            sortOrder: index,
          },
        });
        await tx.sectionPromptBlock.create({
          data: {
            projectSectionId: section.id,
            sectionBindingId: sectionBinding.id,
            type: "preset",
            sortOrder: index,
          },
        });
      }
    });
  }

  safeRevalidatePath(`/projects/${projectId}`);
  return section.id;
}

// ---------------------------------------------------------------------------
// 批量创建小节：按模板创建（含额外导入 + 变体覆盖 + 画幅配置）
// ---------------------------------------------------------------------------

export async function createSectionFromTemplate(
  input: CreateSectionFromTemplateInput,
): Promise<string> {
  const { projectId, name, aspectRatio, aspectRatios, shortSidePx, extraImports, bindingVariantOverrides } = input;

  // 1. 创建小节（自动导入项目级绑定）
  const sectionId = await addSection(projectId, name);

  // 2. 覆盖项目级绑定的变体
  if (bindingVariantOverrides.length > 0) {
    const sectionBindings = await prisma.sectionPresetBinding.findMany({
      where: { projectSectionId: sectionId },
      select: { bindingKey: true, presetId: true },
    });

    for (const override of bindingVariantOverrides) {
      const binding = sectionBindings.find((item) => item.presetId === override.presetId);
      if (binding) {
        await switchBindingVariant(sectionId, binding.bindingKey, override.variantId);
      }
    }
  }

  // 3. 导入额外预制
  for (const imp of extraImports) {
    if ("presetGroupId" in imp) {
      await importPresetGroupToSection(sectionId, imp.presetGroupId);
      continue;
    }

    await importPresetToSection(sectionId, imp.presetId, imp.variantId, imp.groupBindingId);
  }

  // 4. 更新画幅配置
  if (aspectRatio || aspectRatios || shortSidePx) {
    await prisma.projectSection.update({
      where: { id: sectionId },
      data: {
        ...(aspectRatios && aspectRatios.length > 0
          ? { aspectRatio: aspectRatios[0], aspectRatios }
          : aspectRatio ? { aspectRatio, aspectRatios: [aspectRatio] } : {}),
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
  const section = await prisma.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    select: { projectId: true },
  });
  if (!section) return;

  await prisma.projectSection.updateMany({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
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
      project: buildGenerationProjectWhere({ id: projectId }),
      status: { in: ["queued", "running"] },
    },
  });
  if (runningCount > 0) {
    return { ok: false, message: "有正在执行或排队中的任务，请等待完成后再调整顺序" };
  }

  // 1. 批量更新 sortOrder
  await prisma.$transaction(
    sectionIds.map((id, index) =>
      prisma.projectSection.updateMany({
        where: {
          id,
          projectId,
          project: buildGenerationProjectWhere({ id: projectId }),
        },
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
  const section = await prisma.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    include: {
      presetBindingRows: {
        orderBy: { sortOrder: "asc" },
      },
      sectionPromptBlocks: {
        orderBy: { sortOrder: "asc" },
      },
      manualLoraEntries: {
        orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (!section) return null;
  await assertOrdinaryPresetLibraryBindingRefs(section.presetBindingRows);

  const newSection = await prisma.$transaction(async (tx) => {
    const insertSortOrder = section.sortOrder + 1;
    await tx.projectSection.updateMany({
      where: {
        projectId: section.projectId,
        project: buildGenerationProjectWhere({ id: section.projectId }),
        sortOrder: { gt: section.sortOrder },
      },
      data: { sortOrder: { increment: 1 } },
    });

    const createdSection = await tx.projectSection.create({
      data: {
        projectId: section.projectId,
        folderId: section.folderId,
        sortOrder: insertSortOrder,
          enabled: section.enabled,
          name: section.name ? `${section.name} (副本)` : null,
          aspectRatio: section.aspectRatio,
          aspectRatios: section.aspectRatios ?? undefined,
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
        useTwoStageKSampler: section.useTwoStageKSampler,
        extraParams: section.extraParams ?? undefined,
      },
    });

    const bindingIdBySourceId = new Map<string, string>();

    for (const binding of section.presetBindingRows) {
      const copiedBinding = await tx.sectionPresetBinding.create({
        data: {
          projectSectionId: createdSection.id,
          bindingKey: binding.bindingKey,
          categoryId: binding.categoryId,
          presetId: binding.presetId,
          variantId: binding.variantId,
          presetGroupId: binding.presetGroupId,
          groupBindingKey: binding.groupBindingKey,
          sortOrder: binding.sortOrder,
        },
      });
      bindingIdBySourceId.set(binding.id, copiedBinding.id);
    }

    for (const block of section.sectionPromptBlocks) {
      await tx.sectionPromptBlock.create({
        data: {
          projectSectionId: createdSection.id,
          sectionBindingId: block.sectionBindingId ? bindingIdBySourceId.get(block.sectionBindingId) ?? null : null,
          type: block.type,
          customLabel: block.customLabel,
          customPositive: block.customPositive,
          customNegative: block.customNegative,
          sortOrder: block.sortOrder,
        },
      });
    }

    for (const entry of section.manualLoraEntries) {
      await tx.sectionManualLoraEntry.create({
        data: {
          projectSectionId: createdSection.id,
          sectionBindingId: entry.sectionBindingId ? bindingIdBySourceId.get(entry.sectionBindingId) ?? null : null,
          stage: entry.stage,
          path: entry.path,
          weight: entry.weight,
          enabled: entry.enabled,
          detachedFromBindingKey: entry.detachedFromBindingKey,
          detachedFromPresetId: entry.detachedFromPresetId,
          detachedFromVariantId: entry.detachedFromVariantId,
          detachedFromPath: entry.detachedFromPath,
          metadata: entry.metadata ?? undefined,
          sortOrder: entry.sortOrder,
        },
      });
    }
    return createdSection;
  });

  safeRevalidatePath(`/projects/${section.projectId}`);
  return newSection.id;
}

// ---------------------------------------------------------------------------
// 删除小节
// ---------------------------------------------------------------------------

export async function deleteSection(sectionId: string): Promise<void> {
  const section = await prisma.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { slug: true } },
      runs: { select: { comfyOutputSubfolder: true } },
    },
  });
  if (!section) return;

  // Clean up disk files BEFORE database deletion
  // This prevents orphaned latent files and image directories
  try {
    await cleanupProjectSectionFiles(section.project.slug, [section]);
  } catch (error) {
    // Log but don't block deletion if cleanup fails
    console.warn("Failed to cleanup section files", { sectionId, error });
  }

  // Then delete from database (cascade handles runs, images, blocks)
  await prisma.projectSection.deleteMany({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
  });

  revalidatePath(`/projects/${section.projectId}`);
}

// ---------------------------------------------------------------------------
// 批量删除小节
// ---------------------------------------------------------------------------

export async function deleteSections(sectionIds: string[]): Promise<void> {
  if (sectionIds.length === 0) return;

  // Get projectIds and fetch all section data for cleanup
  const sections = await prisma.projectSection.findMany({
    where: {
      id: { in: sectionIds },
      project: buildGenerationProjectWhere(),
    },
    select: {
      id: true,
      projectId: true,
      project: { select: { slug: true } },
      runs: { select: { comfyOutputSubfolder: true } },
    },
  });

  // Group sections by projectId
  const sectionsByProject = new Map<string, typeof sections>();
  for (const section of sections) {
    if (!sectionsByProject.has(section.projectId)) {
      sectionsByProject.set(section.projectId, []);
    }
    sectionsByProject.get(section.projectId)!.push(section);
  }

  // Clean up files for each project before database deletion
  for (const [projectId, projectSections] of sectionsByProject) {
    // Get project slug for cleanup
    const project = projectSections[0]?.project;
    if (project) {
      try {
        await cleanupProjectSectionFiles(project.slug, projectSections);
      } catch (error) {
        // Log but don't block deletion if cleanup fails
        console.warn("Failed to cleanup section files for project", { projectId, error });
      }
    }
  }

  // Cascade delete handles PromptBlocks automatically
  await prisma.projectSection.deleteMany({
    where: {
      id: { in: sections.map((section) => section.id) },
      project: buildGenerationProjectWhere(),
    },
  });

  // Revalidate unique project paths
  const uniqueProjectIds = [...new Set(sections.map((s) => s.projectId))];
  for (const projectId of uniqueProjectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
}

// ---------------------------------------------------------------------------
// 获取清空小节预览数据
// ---------------------------------------------------------------------------

export type ClearSectionsPreview = {
  sectionCount: number;
  runCount: number;
  imageCount: number;
  hasActiveRuns: boolean;
};

export async function getClearSectionsPreview(projectId: string): Promise<ClearSectionsPreview> {
  const [sectionCount, runCount, imageCount, activeRunCount] = await Promise.all([
    prisma.projectSection.count({
      where: {
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
    }),
    prisma.run.count({
      where: {
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
    }),
    prisma.imageResult.count({
      where: {
        run: {
          projectId,
          project: buildGenerationProjectWhere({ id: projectId }),
        },
      },
    }),
    prisma.run.count({
      where: {
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
        status: { in: ["queued", "running"] },
      },
    }),
  ]);

  return {
    sectionCount,
    runCount,
    imageCount,
    hasActiveRuns: activeRunCount > 0,
  };
}

// ---------------------------------------------------------------------------
// 清空所有小节（含文件清理）
// ---------------------------------------------------------------------------

export type ClearAllSectionsResult =
  | { ok: true; deletedSections: number }
  | { ok: false; message: string };

export async function clearAllSections(projectId: string): Promise<ClearAllSectionsResult> {
  // 1. Query project with sections and runs
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: {
      id: true,
      slug: true,
      sections: {
        select: {
          id: true,
          runs: { select: { comfyOutputSubfolder: true, status: true } },
        },
      },
    },
  });

  if (!project) return { ok: false, message: "项目不存在" };
  if (project.sections.length === 0) return { ok: false, message: "项目没有小节" };

  // 2. Check for active runs
  const hasActiveRuns = project.sections.some((s) =>
    s.runs.some((r) => r.status === "queued" || r.status === "running"),
  );
  if (hasActiveRuns) {
    return { ok: false, message: "有正在执行或排队中的任务，请等待完成后再清空" };
  }

  // 3. Clean up disk files
  await cleanupProjectSectionFiles(project.slug, project.sections);

  // 4. Delete trash records for this project's images
  const trashedImages = await prisma.imageResult.findMany({
    where: {
      run: {
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
      reviewStatus: "trashed",
    },
    select: { trashRecord: { select: { id: true, trashPath: true } } },
  });
  const trashRecordIds: string[] = [];
  for (const image of trashedImages) {
    if (image.trashRecord) {
      if (image.trashRecord.trashPath) {
        const dataBase = resolveDataPath();
        const trashFilePath = resolveProjectPath(image.trashRecord.trashPath);
        if (isPathInsideDirectory(trashFilePath, dataBase)) {
          try {
            await rm(trashFilePath, { force: true });
          } catch {
            // ignore
          }
        }
      }
      trashRecordIds.push(image.trashRecord.id);
    }
  }
  if (trashRecordIds.length > 0) {
    await prisma.trashRecord.deleteMany({ where: { id: { in: trashRecordIds } } });
  }

  // 5. Delete all sections (cascade handles runs/images/promptBlocks)
  const deleteResult = await prisma.projectSection.deleteMany({
    where: {
      projectId,
      project: buildGenerationProjectWhere({ id: projectId }),
    },
  });

  // 6. Also delete section folders for this project
  await prisma.projectSectionFolder.deleteMany({
    where: {
      projectId,
      project: buildGenerationProjectWhere({ id: projectId }),
    },
  });

  // 7. Reset project status to draft
  await prisma.project.updateMany({
    where: buildGenerationProjectWhere({ id: projectId }),
    data: { status: "draft" },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, deletedSections: deleteResult.count };
}
