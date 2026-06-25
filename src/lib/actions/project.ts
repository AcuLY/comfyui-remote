"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import {
  TRAINING_RESERVED_RESOURCE_WRITE_ERROR,
  buildGenerationProjectWhere,
  hasReservedTrainingPurposeNotes,
} from "@/server/repositories/generation-resource-boundary";
import { copyProject as copyProjectRepo } from "@/server/repositories/project-repository";
import { archiveProject as archiveProjectService } from "@/server/services/project-archive-service";
import { deleteProjectCompletely } from "@/server/services/project-deletion-service";
import {
  assertOrdinaryPresetLibraryBindingRefs,
  assertOrdinaryProjectPresetBindingRefs,
  PresetResourceScopeError,
} from "./preset-resource-scope";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

export type CreateProjectInput = {
  title: string;
  checkpointName: string;
  folderId?: string | null;
  presetBindings: PresetBinding[];
  notes: string | null;
};

export type CreateProjectFromExistingInput = CreateProjectInput & {
  sourceProjectId: string;
};

export type UpdateProjectInput = {
  projectId: string;
  title?: string;
  checkpointName?: string | null;
  presetBindings?: PresetBinding[];
  notes?: string | null;
  sections?: {
    sortOrder: number;
    enabled: boolean;
    positivePrompt?: string | null;
      negativePrompt?: string | null;
      aspectRatio?: string | null;
      aspectRatios?: string[] | null;
      batchSize?: number | null;
    seedPolicy1?: string | null;
    seedPolicy2?: string | null;
    ksampler1?: Record<string, unknown> | null;
    ksampler2?: Record<string, unknown> | null;
    useTwoStageKSampler?: boolean | null;
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

// ---------------------------------------------------------------------------
// 创建项目
// ---------------------------------------------------------------------------

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

function normalizeProjectPresetBindings(bindings: readonly PresetBinding[]) {
  const seen = new Set<string>();
  const normalized: Array<{
    categoryId: string;
    presetId: string;
    variantId: string | null;
    sortOrder: number;
  }> = [];

  for (const [index, binding] of bindings.entries()) {
    if (seen.has(binding.categoryId)) continue;
    seen.add(binding.categoryId);
    normalized.push({
      categoryId: binding.categoryId,
      presetId: binding.presetId,
      variantId: binding.variantId ?? null,
      sortOrder: index,
    });
  }

  return normalized;
}

function projectBindingKey(categoryId: string) {
  return `project:${categoryId}`;
}

function isProjectBindingKey(bindingKey: string) {
  return bindingKey.startsWith("project:");
}

async function assertOrdinaryProjectPresetBindings(bindings: readonly PresetBinding[]) {
  const normalized = normalizeProjectPresetBindings(bindings);
  await assertOrdinaryProjectPresetBindingRefs(normalized);
}

function assertGenerationProjectNotes(notes: string | null | undefined) {
  if (!hasReservedTrainingPurposeNotes(notes)) return;
  throw new Error(TRAINING_RESERVED_RESOURCE_WRITE_ERROR);
}

async function replaceProjectPresetBindingRows(
  tx: Prisma.TransactionClient,
  projectId: string,
  bindings: readonly PresetBinding[],
) {
  await tx.projectPresetBinding.deleteMany({ where: { projectId } });
  for (const binding of normalizeProjectPresetBindings(bindings)) {
    await tx.projectPresetBinding.create({
      data: {
        projectId,
        categoryId: binding.categoryId,
        presetId: binding.presetId,
        variantId: binding.variantId,
        sortOrder: binding.sortOrder,
      },
    });
  }
}

function cloneJsonValueForCreate(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.DbNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const checkpointName = input.checkpointName.trim() || DEFAULT_CHECKPOINT_NAME;
  await assertOrdinaryProjectPresetBindings(input.presetBindings);
  assertGenerationProjectNotes(input.notes);

  // 生成唯一 slug
  const baseSlug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "untitled";
  let slug = baseSlug;
  let i = 1;

  // Find a starting point (best effort)
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  // Retry loop to handle TOCTOU race on slug uniqueness
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const project = await prisma.$transaction(async (tx) => {
        const createdProject = await tx.project.create({
          data: {
            title: input.title,
            slug,
            status: "draft",
            folderId: input.folderId ?? null,
            checkpointName,
            notes: input.notes,
          },
        });
        await replaceProjectPresetBindingRows(tx, createdProject.id, input.presetBindings);
        return createdProject;
      });

      safeRevalidatePath("/projects");
      return project.id;
    } catch (error) {
      // If it's a unique constraint violation on slug, try next suffix
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | undefined)?.includes("slug")
      ) {
        slug = `${baseSlug}-${i++}`;
        continue;
      }
      throw error; // Re-throw non-slug errors
    }
  }

  throw new Error("Failed to generate unique slug after multiple attempts");
}

export async function createProjectFromExisting(input: CreateProjectFromExistingInput): Promise<string> {
  const sourceProjectId = input.sourceProjectId.trim();
  if (!sourceProjectId) {
    throw new Error("Source project is required");
  }

  const checkpointName = input.checkpointName.trim() || DEFAULT_CHECKPOINT_NAME;
  await assertOrdinaryProjectPresetBindings(input.presetBindings);
  assertGenerationProjectNotes(input.notes);

  const sourceProject = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: sourceProjectId }),
    select: {
      id: true,
      projectLevelOverrides: true,
      sections: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          enabled: true,
          aspectRatio: true,
          aspectRatios: true,
          shortSidePx: true,
          batchSize: true,
          seedPolicy1: true,
          seedPolicy2: true,
          ksampler1: true,
          ksampler2: true,
          upscaleFactor: true,
          useTwoStageKSampler: true,
          extraParams: true,
          presetBindingRows: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              bindingKey: true,
              categoryId: true,
              presetId: true,
              variantId: true,
              presetGroupId: true,
              groupBindingKey: true,
              sortOrder: true,
            },
          },
          sectionPromptBlocks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              sectionBindingId: true,
              type: true,
              customLabel: true,
              customPositive: true,
              customNegative: true,
              sortOrder: true,
            },
          },
          manualLoraEntries: {
            orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
            select: {
              sectionBindingId: true,
              stage: true,
              path: true,
              weight: true,
              enabled: true,
              detachedFromBindingKey: true,
              detachedFromPresetId: true,
              detachedFromVariantId: true,
              detachedFromPath: true,
              metadata: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  if (!sourceProject) {
    throw new Error("Source project not found");
  }

  await assertOrdinaryPresetLibraryBindingRefs(
    sourceProject.sections
      .flatMap((section) => section.presetBindingRows)
      .filter((binding) => !isProjectBindingKey(binding.bindingKey)),
  );

  const normalizedProjectBindings = normalizeProjectPresetBindings(input.presetBindings);

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

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const project = await prisma.$transaction(async (tx) => {
        const createdProject = await tx.project.create({
          data: {
            title: input.title,
            slug,
            status: "draft",
            folderId: input.folderId ?? null,
            checkpointName,
            projectLevelOverrides: cloneJsonValueForCreate(sourceProject.projectLevelOverrides),
            notes: input.notes,
            sections: {
              create: sourceProject.sections.map((section) => ({
                name: section.name,
                sortOrder: section.sortOrder,
                enabled: section.enabled,
                aspectRatio: section.aspectRatio,
                aspectRatios: cloneJsonValueForCreate(section.aspectRatios),
                shortSidePx: section.shortSidePx,
                batchSize: section.batchSize,
                seedPolicy1: section.seedPolicy1,
                seedPolicy2: section.seedPolicy2,
                ksampler1: cloneJsonValueForCreate(section.ksampler1),
                ksampler2: cloneJsonValueForCreate(section.ksampler2),
                upscaleFactor: section.upscaleFactor,
                useTwoStageKSampler: section.useTwoStageKSampler,
                checkpointName,
                extraParams: cloneJsonValueForCreate(section.extraParams),
              })),
            },
          },
          select: {
            id: true,
            sections: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: { id: true },
            },
          },
        });

        await replaceProjectPresetBindingRows(tx, createdProject.id, input.presetBindings);

        const copiedSectionIdBySourceId = new Map<string, string>();
        for (const [index, sourceSection] of sourceProject.sections.entries()) {
          const copiedSectionId = createdProject.sections[index]?.id;
          if (copiedSectionId) copiedSectionIdBySourceId.set(sourceSection.id, copiedSectionId);
        }

        for (const sourceSection of sourceProject.sections) {
          const copiedSectionId = copiedSectionIdBySourceId.get(sourceSection.id);
          if (!copiedSectionId) continue;

          const sourceBindingById = new Map(sourceSection.presetBindingRows.map((binding) => [binding.id, binding]));
          const sourceProjectBindingIds = new Set(
            sourceSection.presetBindingRows
              .filter((binding) => isProjectBindingKey(binding.bindingKey))
              .map((binding) => binding.id),
          );
          const sourceProjectPromptByBindingKey = new Map(
            sourceSection.sectionPromptBlocks
              .map((block) => {
                const binding = block.sectionBindingId ? sourceBindingById.get(block.sectionBindingId) : null;
                return binding && isProjectBindingKey(binding.bindingKey)
                  ? [binding.bindingKey, block] as const
                  : null;
              })
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
          );

          const copiedBindingIdBySourceId = new Map<string, string>();
          const copiedProjectBindingIdByKey = new Map<string, string>();

          for (const binding of normalizedProjectBindings) {
            const bindingKey = projectBindingKey(binding.categoryId);
            const copiedBinding = await tx.sectionPresetBinding.create({
              data: {
                projectSectionId: copiedSectionId,
                bindingKey,
                categoryId: binding.categoryId,
                presetId: binding.presetId,
                variantId: binding.variantId,
                sortOrder: binding.sortOrder,
              },
              select: { id: true },
            });
            copiedProjectBindingIdByKey.set(bindingKey, copiedBinding.id);
          }

          for (const binding of sourceSection.presetBindingRows) {
            if (isProjectBindingKey(binding.bindingKey)) continue;

            const copiedBinding = await tx.sectionPresetBinding.create({
              data: {
                projectSectionId: copiedSectionId,
                bindingKey: binding.bindingKey,
                categoryId: binding.categoryId,
                presetId: binding.presetId,
                variantId: binding.variantId,
                presetGroupId: binding.presetGroupId,
                groupBindingKey: binding.groupBindingKey,
                sortOrder: binding.sortOrder,
              },
              select: { id: true },
            });
            copiedBindingIdBySourceId.set(binding.id, copiedBinding.id);
          }

          for (const binding of normalizedProjectBindings) {
            const bindingKey = projectBindingKey(binding.categoryId);
            const copiedBindingId = copiedProjectBindingIdByKey.get(bindingKey);
            if (!copiedBindingId) continue;
            const sourcePrompt = sourceProjectPromptByBindingKey.get(bindingKey);
            await tx.sectionPromptBlock.create({
              data: {
                projectSectionId: copiedSectionId,
                sectionBindingId: copiedBindingId,
                type: "preset",
                sortOrder: sourcePrompt?.sortOrder ?? binding.sortOrder,
              },
            });
          }

          for (const block of sourceSection.sectionPromptBlocks) {
            if (block.sectionBindingId && sourceProjectBindingIds.has(block.sectionBindingId)) continue;
            const copiedBindingId = block.sectionBindingId
              ? copiedBindingIdBySourceId.get(block.sectionBindingId) ?? null
              : null;
            await tx.sectionPromptBlock.create({
              data: {
                projectSectionId: copiedSectionId,
                sectionBindingId: copiedBindingId,
                type: block.type,
                customLabel: block.customLabel,
                customPositive: block.customPositive,
                customNegative: block.customNegative,
                sortOrder: block.sortOrder,
              },
            });
          }

          for (const entry of sourceSection.manualLoraEntries) {
            if (entry.sectionBindingId && sourceProjectBindingIds.has(entry.sectionBindingId)) continue;
            if (entry.detachedFromBindingKey && isProjectBindingKey(entry.detachedFromBindingKey)) continue;

            const copiedBindingId = entry.sectionBindingId
              ? copiedBindingIdBySourceId.get(entry.sectionBindingId) ?? null
              : null;
            await tx.sectionManualLoraEntry.create({
              data: {
                projectSectionId: copiedSectionId,
                sectionBindingId: copiedBindingId,
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
        }

        return createdProject;
      });

      safeRevalidatePath("/projects");
      return project.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | undefined)?.includes("slug")
      ) {
        slug = `${baseSlug}-${i++}`;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate unique slug after multiple attempts");
}

// ---------------------------------------------------------------------------
// 更新项目
// ---------------------------------------------------------------------------

export async function updateProject(input: UpdateProjectInput) {
  const { projectId, sections, projectLevelOverrides, presetBindings, ...projectData } = input;
  if (presetBindings !== undefined) {
    await assertOrdinaryProjectPresetBindings(presetBindings);
  }
  if (projectData.notes !== undefined) {
    assertGenerationProjectNotes(projectData.notes);
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: buildGenerationProjectWhere({ id: projectId }),
      select: { id: true },
    });
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // 更新 project 基础字段（包括 projectLevelOverrides）
    const projectUpdateData = {
      ...projectData,
      ...(projectLevelOverrides !== undefined ? { projectLevelOverrides: projectLevelOverrides as object } : {}),
    };
    if (Object.keys(projectUpdateData).length > 0) {
      await tx.project.updateMany({
        where: buildGenerationProjectWhere({ id: projectId }),
        data: projectUpdateData,
      });
    }

    if (presetBindings !== undefined) {
      await replaceProjectPresetBindingRows(tx, projectId, presetBindings);
    }

    // 如果传了 sections，更新现有小节的排序和字段
    if (sections) {
      // Update existing sections' sortOrder and enabled status.
      // We fetch existing sections and update them individually rather than
      // delete-recreate, which would cascade-delete all runs, images, and blocks.
      const existingSections = await tx.projectSection.findMany({
        where: {
          projectId,
          project: buildGenerationProjectWhere({ id: projectId }),
        },
        select: { id: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      });

      // Update each section by position
      for (let idx = 0; idx < Math.min(sections.length, existingSections.length); idx++) {
        const section = existingSections[idx];
        const update = sections[idx];
        await tx.projectSection.updateMany({
          where: {
            id: section.id,
            project: buildGenerationProjectWhere({ id: projectId }),
          },
          data: {
            sortOrder: update.sortOrder,
            enabled: update.enabled,
            aspectRatio: update.aspectRatio ?? null,
            aspectRatios: update.aspectRatios ?? (update.aspectRatio ? [update.aspectRatio] : Prisma.DbNull),
            batchSize: update.batchSize ?? null,
            seedPolicy1: update.seedPolicy1 ?? null,
            seedPolicy2: update.seedPolicy2 ?? null,
            ksampler1: update.ksampler1 ? (update.ksampler1 as Prisma.InputJsonValue) : undefined,
            ksampler2: update.ksampler2 ? (update.ksampler2 as Prisma.InputJsonValue) : undefined,
            ...(Object.prototype.hasOwnProperty.call(update, "useTwoStageKSampler")
              ? { useTwoStageKSampler: update.useTwoStageKSampler ?? true }
              : {}),
          },
        });
      }
    }
  });

  safeRevalidatePath("/projects");
  safeRevalidatePath(`/projects/${projectId}`);
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
// 删除项目（级联删除所有小节、提示词块、运行记录、图片记录）
// ---------------------------------------------------------------------------

export async function deleteProject(projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: buildGenerationProjectWhere({ id: projectId }),
    select: { id: true },
  });
  if (!project) return;

  await deleteProjectCompletely(projectId);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// 归档项目（保留记录，清理生成/导出文件）
// ---------------------------------------------------------------------------

export async function archiveProject(projectId: string): Promise<void> {
  const result = await archiveProjectService(projectId);
  if (!result.success) {
    throw new Error(result.message);
  }
  safeRevalidatePath("/projects");
  safeRevalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// 应用参数到所有小节
// ---------------------------------------------------------------------------

export type ApplyParamName =
  | "aspectRatio"
  | "shortSidePx"
  | "batchSize"
  | "upscaleFactor"
  | "useTwoStageKSampler"
  | "seedPolicy"
  | "ksampler1"
  | "ksampler2"
  | "checkpointName"
  | "presets";

export async function applyParamToAllSections(
  projectId: string,
  param: ApplyParamName,
  value: unknown,
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
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
          },
        },
      },
    });
    if (!project) return { ok: false, count: 0, error: "项目不存在" };

    if (param === "presets") {
      const currentBindings = project.presetBindingRows;
      await assertOrdinaryProjectPresetBindingRefs(currentBindings);
      const sections = await prisma.projectSection.findMany({
        where: {
          projectId,
          project: buildGenerationProjectWhere({ id: projectId }),
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const section of sections) {
          const projectAppliedBindings = await tx.sectionPresetBinding.findMany({
            where: {
              projectSectionId: section.id,
              bindingKey: { startsWith: "project:" },
            },
            select: { id: true },
          });
          const projectAppliedBindingIds = projectAppliedBindings.map((binding) => binding.id);
          if (projectAppliedBindingIds.length > 0) {
            await tx.sectionPromptBlock.deleteMany({
              where: {
                projectSectionId: section.id,
                sectionBindingId: { in: projectAppliedBindingIds },
              },
            });
            await tx.sectionManualLoraEntry.deleteMany({
              where: {
                projectSectionId: section.id,
                sectionBindingId: { in: projectAppliedBindingIds },
              },
            });
            await tx.sectionPresetBinding.deleteMany({
              where: { id: { in: projectAppliedBindingIds } },
            });
          }

          for (const [index, binding] of currentBindings.entries()) {
            const bindingKey = `project:${binding.categoryId}`;
            const sectionBinding = await tx.sectionPresetBinding.create({
              data: {
                id: `sectionPresetBinding:${section.id}:${bindingKey}`,
                projectSectionId: section.id,
                bindingKey,
                categoryId: binding.categoryId,
                presetId: binding.presetId,
                variantId: binding.variantId ?? null,
                sortOrder: binding.sortOrder ?? index,
              },
            });
            await tx.sectionPromptBlock.create({
              data: {
                id: `sectionPromptBlock:${section.id}:${bindingKey}`,
                projectSectionId: section.id,
                sectionBindingId: sectionBinding.id,
                type: "preset",
                sortOrder: binding.sortOrder ?? index,
              },
            });
          }
        }
      });

      const count = sections.length;
      safeRevalidatePath(`/projects/${projectId}`);
      return { ok: true, count };
    }

    // Build the update data based on param name
    let data: Record<string, unknown>;
    switch (param) {
      case "aspectRatio":
        data = typeof value === "string"
          ? { aspectRatio: value, aspectRatios: [value] }
          : { aspectRatio: null, aspectRatios: Prisma.DbNull };
        break;
      case "shortSidePx":
        data = { shortSidePx: typeof value === "number" ? value : null };
        break;
      case "batchSize":
        data = { batchSize: typeof value === "number" ? value : null };
        break;
      case "upscaleFactor":
        data = { upscaleFactor: typeof value === "number" ? value : null };
        break;
      case "useTwoStageKSampler":
        data = { useTwoStageKSampler: typeof value === "boolean" ? value : true };
        break;
      case "seedPolicy":
        if (typeof value === "object" && value !== null) {
          const v = value as { seedPolicy1?: string; seedPolicy2?: string };
          data = {
            seedPolicy1: v.seedPolicy1 ?? null,
            seedPolicy2: v.seedPolicy2 ?? null,
          };
        } else {
          data = { seedPolicy1: typeof value === "string" ? value : null, seedPolicy2: null };
        }
        break;
      case "ksampler1":
        data = { ksampler1: value && typeof value === "object" ? value : Prisma.DbNull };
        break;
      case "ksampler2":
        data = { ksampler2: value && typeof value === "object" ? value : Prisma.DbNull };
        break;
      case "checkpointName":
        data = { checkpointName: typeof value === "string" ? value : null };
        break;
      default:
        return { ok: false, count: 0, error: `未知参数: ${param}` };
    }

    const result = await prisma.projectSection.updateMany({
      where: {
        projectId,
        project: buildGenerationProjectWhere({ id: projectId }),
      },
      data,
    });

    safeRevalidatePath(`/projects/${projectId}`);
    return { ok: true, count: result.count };
  } catch (e) {
    if (!(e instanceof PresetResourceScopeError)) {
      console.error("Failed to apply param to all sections:", e);
    }
    return {
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : "应用失败",
    };
  }
}
