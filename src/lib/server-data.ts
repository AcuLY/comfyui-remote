import { prisma } from "@/lib/prisma";
import type { QueueRun, ReviewGroup, ReviewImage, JobCard, TrashItem, LoraAsset } from "@/lib/types";

// Re-export types used by frontend components (originally from backend branch)
export type { JobCreateOptions } from "@/server/repositories/job-repository";

// ---------------------------------------------------------------------------
// Queue — 待审核队列
// ---------------------------------------------------------------------------

export async function getQueueRuns(): Promise<QueueRun[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    include: {
      completeJob: {
        include: { character: true },
      },
      completeJobPosition: {
        include: { positionTemplate: true },
      },
      images: true,
    },
  });

  return runs.map((run) => ({
    id: run.id,
    characterName: run.completeJob.character.name,
    jobTitle: run.completeJob.title,
    positionName: run.completeJobPosition.positionTemplate.name,
    createdAt: formatDate(run.createdAt),
    pendingCount: run.images.filter((img) => img.reviewStatus === "pending").length,
    totalCount: run.images.length,
    status: run.status as QueueRun["status"],
  }));
}

// ---------------------------------------------------------------------------
// Review Group — 单组审核详情（宫格页）
// ---------------------------------------------------------------------------

export async function getReviewGroup(runId: string): Promise<ReviewGroup | null> {
  const run = await prisma.positionRun.findUnique({
    where: { id: runId },
    include: {
      completeJob: {
        include: { character: true },
      },
      completeJobPosition: {
        include: { positionTemplate: true },
      },
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!run) return null;

  const images: ReviewImage[] = run.images.map((img, index) => ({
    id: img.id,
    src: img.thumbPath ?? img.filePath,
    label: `${index + 1}`.padStart(2, "0"),
    status: img.reviewStatus as ReviewImage["status"],
  }));

  return {
    id: run.id,
    title: run.completeJob.title,
    characterName: run.completeJob.character.name,
    positionName: run.completeJobPosition.positionTemplate.name,
    createdAt: formatDate(run.createdAt),
    pendingCount: images.filter((img) => img.status === "pending").length,
    totalCount: images.length,
    images,
  };
}

// ---------------------------------------------------------------------------
// Review Group 列表 — 用于上/下一组导航
// ---------------------------------------------------------------------------

export async function getReviewGroupIds(): Promise<string[]> {
  const runs = await prisma.positionRun.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return runs.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Jobs — 大任务列表
// ---------------------------------------------------------------------------

export async function getJobs(): Promise<JobCard[]> {
  const jobs = await prisma.completeJob.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      _count: { select: { positions: true } },
    },
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    characterName: job.character.name,
    sceneName: job.scenePreset?.name ?? "—",
    styleName: job.stylePreset?.name ?? "—",
    status: job.status as JobCard["status"],
    updatedAt: formatDate(job.updatedAt),
    positionCount: job._count.positions,
  }));
}

// ---------------------------------------------------------------------------
// Job Detail — 大任务详情 + positions
// ---------------------------------------------------------------------------

/** Used by the frontend position-edit form */
export type JobDetailPosition = {
  id: string;
  name: string;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy: string | null;
  promptOverview: {
    positivePrompt: string | null;
    negativePrompt: string | null;
  };
};

export type JobDetail = {
  id: string;
  title: string;
  characterName: string;
  sceneName: string;
  styleName: string;
  status: string;
  characterPrompt: string;
  scenePrompt: string | null;
  stylePrompt: string | null;
  positions: {
    id: string;
    name: string;
    batchSize: number | null;
    aspectRatio: string | null;
    latestRunStatus: string | null;
  }[];
};

export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      positions: {
        orderBy: { sortOrder: "asc" },
        include: {
          positionTemplate: true,
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    title: job.title,
    characterName: job.character.name,
    sceneName: job.scenePreset?.name ?? "—",
    styleName: job.stylePreset?.name ?? "—",
    status: job.status,
    characterPrompt: job.characterPrompt,
    scenePrompt: job.scenePrompt,
    stylePrompt: job.stylePrompt,
    positions: job.positions.map((pos) => ({
      id: pos.id,
      name: pos.positionTemplate.name,
      batchSize: pos.batchSize ?? pos.positionTemplate.defaultBatchSize,
      aspectRatio: pos.aspectRatio ?? pos.positionTemplate.defaultAspectRatio,
      latestRunStatus: pos.runs[0]?.status ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Trash — 回收站
// ---------------------------------------------------------------------------

export async function getTrashItems(): Promise<TrashItem[]> {
  const records = await prisma.trashRecord.findMany({
    where: { restoredAt: null },
    orderBy: { deletedAt: "desc" },
    include: {
      imageResult: {
        include: {
          positionRun: {
            include: {
              completeJob: true,
              completeJobPosition: {
                include: { positionTemplate: true },
              },
            },
          },
        },
      },
    },
  });

  return records.map((rec) => {
    const run = rec.imageResult.positionRun;
    return {
      id: rec.id,
      src: rec.imageResult.thumbPath ?? rec.imageResult.filePath,
      title: `${run.completeJob.title} / ${run.completeJobPosition.positionTemplate.name}`,
      deletedAt: formatDate(rec.deletedAt),
      originalPath: rec.originalPath,
    };
  });
}

// ---------------------------------------------------------------------------
// LoRA Assets
// ---------------------------------------------------------------------------

export async function getLoraAssets(): Promise<LoraAsset[]> {
  const assets = await prisma.loraAsset.findMany({
    orderBy: { uploadedAt: "desc" },
  });

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    relativePath: asset.relativePath,
    uploadedAt: formatDate(asset.uploadedAt),
  }));
}

// ---------------------------------------------------------------------------
// Job Form Options — 创建/编辑 Job 所需的下拉选项
// ---------------------------------------------------------------------------

export type FormOption = { id: string; name: string; slug: string };
export type PositionOption = FormOption & {
  defaultAspectRatio: string | null;
  defaultBatchSize: number | null;
  defaultSeedPolicy: string | null;
};

export async function getJobFormOptions() {
  const [characters, scenes, styles, positions] = await Promise.all([
    prisma.character.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, prompt: true, loraPath: true },
    }),
    prisma.scenePreset.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, prompt: true },
    }),
    prisma.stylePreset.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, prompt: true },
    }),
    prisma.positionTemplate.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, defaultAspectRatio: true, defaultBatchSize: true, defaultSeedPolicy: true },
    }),
  ]);

  return { characters, scenes, styles, positions };
}

// ---------------------------------------------------------------------------
// Job Edit Data — 编辑 Job 时加载完整数据
// ---------------------------------------------------------------------------

export type JobEditData = {
  id: string;
  title: string;
  slug: string;
  characterId: string;
  scenePresetId: string | null;
  stylePresetId: string | null;
  characterPrompt: string;
  characterLoraPath: string;
  scenePrompt: string | null;
  stylePrompt: string | null;
  notes: string | null;
  positions: {
    id: string;
    positionTemplateId: string;
    sortOrder: number;
    enabled: boolean;
    positivePrompt: string | null;
    negativePrompt: string | null;
    aspectRatio: string | null;
    batchSize: number | null;
    seedPolicy: string | null;
  }[];
};

export async function getJobEditData(jobId: string): Promise<JobEditData | null> {
  const job = await prisma.completeJob.findUnique({
    where: { id: jobId },
    include: {
      positions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          positionTemplateId: true,
          sortOrder: true,
          enabled: true,
          positivePrompt: true,
          negativePrompt: true,
          aspectRatio: true,
          batchSize: true,
          seedPolicy: true,
        },
      },
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    characterId: job.characterId,
    scenePresetId: job.scenePresetId,
    stylePresetId: job.stylePresetId,
    characterPrompt: job.characterPrompt,
    characterLoraPath: job.characterLoraPath,
    scenePrompt: job.scenePrompt,
    stylePrompt: job.stylePrompt,
    notes: job.notes,
    positions: job.positions,
  };
}

// ---------------------------------------------------------------------------
// Settings — Character / Scene / Style / PositionTemplate 管理
// ---------------------------------------------------------------------------

export async function getCharacters() {
  return prisma.character.findMany({ orderBy: { name: "asc" } });
}

export async function getScenePresets() {
  return prisma.scenePreset.findMany({ orderBy: { name: "asc" } });
}

export async function getStylePresets() {
  return prisma.stylePreset.findMany({ orderBy: { name: "asc" } });
}

export async function getPositionTemplates() {
  return prisma.positionTemplate.findMany({ orderBy: { name: "asc" } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}
