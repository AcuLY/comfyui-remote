import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import type { QueueRun, RunningRun, FailedRun, ReviewGroup, ReviewImage, ReviewStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Preset binding helpers — resolve display names from presetBindings JSON
// ---------------------------------------------------------------------------

export type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;

export async function batchResolvePresetNames(presetIds: string[]): Promise<Map<string, { name: string }>> {
  if (presetIds.length === 0) return new Map();
  const presets = await prisma.preset.findMany({
    where: { id: { in: presetIds } },
    select: { id: true, name: true },
  });
  return new Map(presets.map((p) => [p.id, { name: p.name }]));
}

export function extractPresetNames(
  bindings: PresetBindingJson | null,
  presetMap: Map<string, { name: string }>,
): string[] {
  if (!bindings) return [];
  return bindings
    .map((b) => presetMap.get(b.presetId)?.name)
    .filter((n): n is string => !!n);
}

/** Collect all unique preset IDs from an array of presetBindings JSON values */
export function collectPresetIds(bindingsArray: (unknown)[]): string[] {
  const ids = new Set<string>();
  for (const raw of bindingsArray) {
    const bindings = raw as PresetBindingJson | null;
    if (bindings) for (const b of bindings) ids.add(b.presetId);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

// ---------------------------------------------------------------------------
// Queue — 待审核队列
// ---------------------------------------------------------------------------

export async function getQueueRuns(): Promise<QueueRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
      images: true,
    },
  });

  // Batch resolve preset names
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs
    .map((run) => {
      const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
      // Extract thumbnails from images (up to 8)
      const thumbnailUrls = run.images.slice(0, 8).map((img) =>
        toImageUrl(img.thumbPath ?? img.filePath) ?? "",
      ).filter(Boolean);
      return {
        id: run.id,
        presetNames,
        projectTitle: run.project.title,
        sectionName:
          run.projectSection.name ??
          run.projectSection.name ??
          `section_${run.projectSection.sortOrder + 1}`,
        createdAt: formatDate(run.createdAt),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        pendingCount: run.images.filter((img) => img.reviewStatus === "pending").length,
        totalCount: run.images.length,
        status: run.status as QueueRun["status"],
        thumbnailUrls,
      };
    })
    .filter((run) => run.pendingCount > 0);
}

// ---------------------------------------------------------------------------
// Running Runs — 当前运行中的任务
// ---------------------------------------------------------------------------

export async function getRunningRuns(): Promise<RunningRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs.map((run) => {
    const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName:
        run.projectSection.name ??
        `section_${run.projectSection.sortOrder + 1}`,
      startedAt: formatDate(run.startedAt ?? run.createdAt),
      status: run.status as RunningRun["status"],
    };
  });
}

// ---------------------------------------------------------------------------
// Failed Runs — 最近失败的任务
// ---------------------------------------------------------------------------

export async function getFailedRuns(): Promise<FailedRun[]> {
  const runs = await prisma.run.findMany({
    where: { status: "failed" },
    orderBy: { finishedAt: "desc" },
    take: 20,
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
    },
  });

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  return runs.map((run) => {
    const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName:
        run.projectSection.name ??
        `section_${run.projectSection.sortOrder + 1}`,
      sectionId: run.projectSection.id,
      errorMessage: run.errorMessage,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Review Group — 单组审核详情（宫格页）
// ---------------------------------------------------------------------------

export async function getReviewGroup(runId: string): Promise<ReviewGroup | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!run) return null;

  // Resolve preset names from presetBindings
  const presetMap = await batchResolvePresetNames(
    collectPresetIds([run.project.presetBindings]),
  );
  const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);

  const images: ReviewImage[] = run.images.map((img, index) => ({
    id: img.id,
    src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
    full: (toImageUrl(img.filePath) ?? "") + "?q=80",
    label: `${index + 1}`.padStart(2, "0"),
    status: img.reviewStatus as ReviewImage["status"],
  }));

  return {
    id: run.id,
    projectId: run.project.id,
    projectSectionId: run.projectSection.id,
    title: run.project.title,
    presetNames,
    sectionName:
      run.projectSection.name ??
      `section_${run.projectSection.sortOrder + 1}`,
    createdAt: formatDate(run.createdAt),
    pendingCount: images.filter((img) => img.status === "pending").length,
    totalCount: images.length,
    images,
    executionMeta: (run.executionMeta as Record<string, unknown>) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Review Group 列表 — 用于上/下一组导航
// ---------------------------------------------------------------------------

export async function getReviewGroupIds(): Promise<string[]> {
  const runs = await prisma.run.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return runs.map((r) => r.id);
}
