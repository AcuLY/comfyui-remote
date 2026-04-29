"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";
import { copyProject as copyProjectRepo } from "@/server/repositories/project-repository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetBinding = { categoryId: string; presetId: string; variantId?: string };

export type CreateProjectInput = {
  title: string;
  checkpointName: string;
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
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const project = await prisma.project.create({
    data: {
      title: input.title,
      slug,
      status: "draft",
      checkpointName,
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
