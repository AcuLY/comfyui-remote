"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import { copyProject as copyProjectRepo } from "@/server/repositories/project-repository";
import { deleteProjectCompletely } from "@/server/services/project-deletion-service";

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

export async function createProject(input: CreateProjectInput): Promise<string> {
  const checkpointName = input.checkpointName.trim() || DEFAULT_CHECKPOINT_NAME;

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

// ---------------------------------------------------------------------------
// 更新项目
// ---------------------------------------------------------------------------

export async function updateProject(input: UpdateProjectInput) {
  const { projectId, sections, projectLevelOverrides, presetBindings, ...projectData } = input;

  await prisma.$transaction(async (tx) => {
    // 更新 project 基础字段（包括 projectLevelOverrides）
    await tx.project.update({
      where: { id: projectId },
      data: {
        ...projectData,
        ...(projectLevelOverrides !== undefined ? { projectLevelOverrides: projectLevelOverrides as object } : {}),
      },
    });

    if (presetBindings !== undefined) {
      await replaceProjectPresetBindingRows(tx, projectId, presetBindings);
    }

    // 如果传了 sections，更新现有小节的排序和字段
    if (sections) {
      // Update existing sections' sortOrder and enabled status.
      // We fetch existing sections and update them individually rather than
      // delete-recreate, which would cascade-delete all runs, images, and blocks.
      const existingSections = await tx.projectSection.findMany({
        where: { projectId },
        select: { id: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      });

      // Update each section by position
      for (let idx = 0; idx < Math.min(sections.length, existingSections.length); idx++) {
        const section = existingSections[idx];
        const update = sections[idx];
        await tx.projectSection.update({
          where: { id: section.id },
          data: {
            sortOrder: update.sortOrder,
            enabled: update.enabled,
            aspectRatio: update.aspectRatio ?? null,
            batchSize: update.batchSize ?? null,
            seedPolicy1: update.seedPolicy1 ?? null,
            seedPolicy2: update.seedPolicy2 ?? null,
            ksampler1: update.ksampler1 ? (update.ksampler1 as Prisma.InputJsonValue) : undefined,
            ksampler2: update.ksampler2 ? (update.ksampler2 as Prisma.InputJsonValue) : undefined,
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
  await deleteProjectCompletely(projectId);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// 应用参数到所有小节
// ---------------------------------------------------------------------------

export type ApplyParamName =
  | "aspectRatio"
  | "shortSidePx"
  | "batchSize"
  | "upscaleFactor"
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
      const sections = await prisma.projectSection.findMany({
        where: { projectId },
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
        data = { aspectRatio: typeof value === "string" ? value : null };
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
      where: { projectId },
      data,
    });

    safeRevalidatePath(`/projects/${projectId}`);
    return { ok: true, count: result.count };
  } catch (e) {
    console.error("Failed to apply param to all sections:", e);
    return { ok: false, count: 0, error: "应用失败" };
  }
}
