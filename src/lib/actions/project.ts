"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import { copyProject as copyProjectRepo } from "@/server/repositories/project-repository";
import {
  importPresetToSection,
  removeImportedPresetFromSection,
  switchBindingVariant,
} from "./prompt-block";

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
      const project = await prisma.project.create({
        data: {
          title: input.title,
          slug,
          status: "draft",
          folderId: input.folderId ?? null,
          checkpointName,
          presetBindings: input.presetBindings.length > 0 ? input.presetBindings : undefined,
          notes: input.notes,
        },
      });

      revalidatePath("/projects");
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

function parsePresetBindings(value: unknown): PresetBinding[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PresetBinding => {
    if (!item || typeof item !== "object") return false;
    const binding = item as Record<string, unknown>;
    return typeof binding.categoryId === "string" && typeof binding.presetId === "string";
  });
}

function samePresetBinding(a: PresetBinding | undefined, b: PresetBinding | undefined) {
  return a?.presetId === b?.presetId && (a?.variantId ?? null) === (b?.variantId ?? null);
}

async function resolveBindingVariantId(binding: PresetBinding) {
  if (binding.variantId) return binding.variantId;
  const variant = await prisma.presetVariant.findFirst({
    where: { presetId: binding.presetId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return variant?.id ?? null;
}

async function recomposeSectionPrompts(sectionId: string) {
  const blocks = await prisma.promptBlock.findMany({
    where: { projectSectionId: sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { positive: true, negative: true },
  });
  const positiveParts = blocks
    .map((block) => block.positive)
    .filter((value): value is string => Boolean(value && value.trim()));
  const negativeParts = blocks
    .map((block) => block.negative)
    .filter((value): value is string => Boolean(value && value.trim()));

  await prisma.projectSection.update({
    where: { id: sectionId },
    data: {
      positivePrompt: positiveParts.join(" BREAK "),
      negativePrompt: negativeParts.length > 0 ? negativeParts.join(" BREAK ") : null,
    },
  });
}

async function syncProjectPresetBindingsToSections(
  projectId: string,
  previousBindings: PresetBinding[],
  nextBindings: PresetBinding[],
) {
  const previousByCategory = new Map(previousBindings.map((binding) => [binding.categoryId, binding]));
  const nextByCategory = new Map(nextBindings.map((binding) => [binding.categoryId, binding]));
  const categoryIds = new Set([...previousByCategory.keys(), ...nextByCategory.keys()]);
  const changedCategoryIds = [...categoryIds].filter(
    (categoryId) => !samePresetBinding(previousByCategory.get(categoryId), nextByCategory.get(categoryId)),
  );
  if (changedCategoryIds.length === 0) return;

  const sections = await prisma.projectSection.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          type: true,
          sourceId: true,
          categoryId: true,
          bindingId: true,
          groupBindingId: true,
        },
      },
    },
  });

  const variantIdByBinding = new Map<string, string | null>();
  const getVariantId = async (binding: PresetBinding) => {
    const key = `${binding.presetId}:${binding.variantId ?? ""}`;
    if (!variantIdByBinding.has(key)) {
      variantIdByBinding.set(key, await resolveBindingVariantId(binding));
    }
    return variantIdByBinding.get(key) ?? null;
  };

  const touchedSectionIds = new Set<string>();

  for (const categoryId of changedCategoryIds) {
    const previous = previousByCategory.get(categoryId);
    const next = nextByCategory.get(categoryId);

    for (const section of sections) {
      const existingBlock = previous
        ? section.promptBlocks.find((block) =>
            block.type === "preset" &&
            block.sourceId === previous.presetId &&
            block.categoryId === categoryId &&
            !block.groupBindingId &&
            Boolean(block.bindingId),
          )
        : null;

      if (previous && !existingBlock) {
        continue;
      }

      if (!next) {
        if (existingBlock?.bindingId) {
          await removeImportedPresetFromSection(section.id, existingBlock.bindingId);
          touchedSectionIds.add(section.id);
        }
        continue;
      }

      const nextVariantId = await getVariantId(next);
      if (!nextVariantId) continue;

      if (!previous) {
        const alreadyPresent = section.promptBlocks.some((block) =>
          block.type === "preset" &&
          block.sourceId === next.presetId &&
          block.categoryId === categoryId &&
          !block.groupBindingId,
        );
        if (!alreadyPresent) {
          await importPresetToSection(section.id, next.presetId, nextVariantId);
          touchedSectionIds.add(section.id);
        }
        continue;
      }

      if (!existingBlock?.bindingId) continue;

      if (previous.presetId === next.presetId) {
        await switchBindingVariant(section.id, existingBlock.bindingId, nextVariantId);
      } else {
        await removeImportedPresetFromSection(section.id, existingBlock.bindingId);
        await importPresetToSection(section.id, next.presetId, nextVariantId);
      }
      touchedSectionIds.add(section.id);
    }
  }

  for (const sectionId of touchedSectionIds) {
    await recomposeSectionPrompts(sectionId);
    revalidatePath(`/projects/${projectId}/sections/${sectionId}`);
  }
}

export async function updateProject(input: UpdateProjectInput) {
  const { projectId, sections, projectLevelOverrides, presetBindings, ...projectData } = input;
  const previousProject = presetBindings !== undefined
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { presetBindings: true },
      })
    : null;
  const previousBindings = parsePresetBindings(previousProject?.presetBindings);

  // 更新 project 基础字段（包括 projectLevelOverrides）
  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...projectData,
      ...(presetBindings !== undefined ? { presetBindings } : {}),
      ...(projectLevelOverrides !== undefined ? { projectLevelOverrides: projectLevelOverrides as object } : {}),
    },
  });

  // 如果传了 sections，更新现有小节的排序和字段
  if (sections) {
    // Update existing sections' sortOrder and enabled status.
    // We fetch existing sections and update them individually rather than
    // delete-recreate, which would cascade-delete all runs, images, and blocks.
    const existingSections = await prisma.projectSection.findMany({
      where: { projectId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    // Update each section by position
    for (let idx = 0; idx < Math.min(sections.length, existingSections.length); idx++) {
      const section = existingSections[idx];
      const update = sections[idx];
      await prisma.projectSection.update({
        where: { id: section.id },
        data: {
          sortOrder: update.sortOrder,
          enabled: update.enabled,
          positivePrompt: update.positivePrompt ?? null,
          negativePrompt: update.negativePrompt ?? null,
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

  if (presetBindings !== undefined) {
    await syncProjectPresetBindingsToSections(projectId, previousBindings, presetBindings);
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
      select: { id: true, presetBindings: true },
    });
    if (!project) return { ok: false, count: 0, error: "项目不存在" };

    if (param === "presets") {
      // For presets: force-apply current project bindings to all sections
      // by treating previous as empty (all are "new additions")
      const currentBindings = parsePresetBindings(project.presetBindings);
      await syncProjectPresetBindingsToSections(projectId, [], currentBindings);
      const count = await prisma.projectSection.count({ where: { projectId } });
      revalidatePath(`/projects/${projectId}`);
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

    revalidatePath(`/projects/${projectId}`);
    return { ok: true, count: result.count };
  } catch (e) {
    console.error("Failed to apply param to all sections:", e);
    return { ok: false, count: 0, error: "应用失败" };
  }
}
