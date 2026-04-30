import { prisma } from "@/lib/prisma";
import { toImageUrl } from "@/lib/image-url";
import fs from "node:fs";
import path from "node:path";
import type { QueuePagination, QueueRun, RunningRun, FailedRun, ReviewGroup, ReviewImage, ReviewStatus } from "@/lib/types";

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

const DEFAULT_QUEUE_PAGE_SIZE = 12;
const LEGACY_QUEUE_PAGE_SIZE = 50;
const MAX_QUEUE_PAGE_SIZE = 48;
const DATA_IMAGES_PREFIX = "data/images/";

type QueuePageOptions = {
  page?: number;
  pageSize?: number;
};

type ImageRecord = {
  id: string;
  filePath: string;
  thumbPath: string | null;
  reviewStatus: string;
  featured: boolean;
  featured2: boolean;
  createdAt: Date;
};

type AvailableImage = ImageRecord & {
  displayPath: string;
};

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function normalizeQueuePageOptions(options: QueuePageOptions = {}) {
  return {
    page: normalizePositiveInteger(options.page, 1),
    pageSize: Math.min(
      normalizePositiveInteger(options.pageSize, DEFAULT_QUEUE_PAGE_SIZE),
      MAX_QUEUE_PAGE_SIZE,
    ),
  };
}

function resolveManagedImagePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const stripped = normalized.startsWith(DATA_IMAGES_PREFIX)
    ? normalized.slice(DATA_IMAGES_PREFIX.length)
    : normalized;
  const segments = stripped.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === ".." || segment.includes(":"))
  ) {
    return null;
  }

  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "data",
    "images",
    ...segments,
  );
}

function imageFileExists(relativePath: string | null | undefined) {
  if (!relativePath) return false;
  const resolved = resolveManagedImagePath(relativePath);
  return Boolean(resolved && fs.existsSync(/* turbopackIgnore: true */ resolved));
}

function toAvailableImage(image: ImageRecord): AvailableImage | null {
  if (imageFileExists(image.thumbPath)) {
    return { ...image, displayPath: image.thumbPath! };
  }
  if (imageFileExists(image.filePath)) {
    return { ...image, displayPath: image.filePath };
  }
  return null;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

const VISIBLE_QUEUE_RUN_WHERE = {
  status: "done",
  images: { some: { reviewStatus: "pending" } },
} as const;

function serializeQueueRun(
  run: Awaited<ReturnType<typeof loadVisibleQueueRunPage>>["runs"][number],
  presetMap: Map<string, { name: string }>,
) {
  const availableImages = run.images
    .map((image) => toAvailableImage(image))
    .filter((image): image is AvailableImage => Boolean(image));

  const pendingImages = availableImages.filter((img) => img.reviewStatus === "pending");
  if (pendingImages.length === 0) return null;

  const presetNames = extractPresetNames(run.project.presetBindings as PresetBindingJson | null, presetMap);

  return {
    id: run.id,
    presetNames,
    projectTitle: run.project.title,
    sectionName:
      run.projectSection.name ??
      `section_${run.projectSection.sortOrder + 1}`,
    createdAt: formatDate(run.createdAt),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    pendingCount: pendingImages.length,
    totalCount: availableImages.length,
    status: run.status as QueueRun["status"],
    staleImageCount: run.images.length - availableImages.length,
    thumbnailUrls: availableImages
      .slice(0, 8)
      .map((img) => toImageUrl(img.displayPath) ?? "")
      .filter(Boolean),
  };
}

async function loadVisibleQueueRunPage(page: number, pageSize: number) {
  const totalItemsPromise = prisma.run.count({
    where: VISIBLE_QUEUE_RUN_WHERE,
  });

  const totalPendingImagesPromise = prisma.imageResult.count({
    where: {
      reviewStatus: "pending",
      run: { status: "done" },
    },
  });

  const totalItems = await totalItemsPromise;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  const runs = await prisma.run.findMany({
    where: VISIBLE_QUEUE_RUN_WHERE,
    orderBy: { createdAt: "desc" },
    skip: startIndex,
    take: pageSize,
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

  const totalPendingImages = await totalPendingImagesPromise;

  return { runs, totalItems, totalPages, safePage, startIndex, totalPendingImages };
}

async function loadVisibleQueueRuns(): Promise<{
  runs: QueueRun[];
  staleImageCount: number;
  totalPendingImages: number;
}> {
  const runs = await prisma.run.findMany({
    where: VISIBLE_QUEUE_RUN_WHERE,
    orderBy: { createdAt: "desc" },
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

  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );

  let staleImageCount = 0;
  let totalPendingImages = 0;
  const visibleRuns: QueueRun[] = [];

  for (const run of runs) {
    const serialized = serializeQueueRun(run, presetMap);
    if (!serialized) continue;
    staleImageCount += serialized.staleImageCount;
    totalPendingImages += serialized.pendingCount;
    visibleRuns.push({
      id: serialized.id,
      presetNames: serialized.presetNames,
      projectTitle: serialized.projectTitle,
      sectionName: serialized.sectionName,
      createdAt: serialized.createdAt,
      finishedAt: serialized.finishedAt,
      pendingCount: serialized.pendingCount,
      totalCount: serialized.totalCount,
      status: serialized.status,
      thumbnailUrls: serialized.thumbnailUrls,
    });
  }

  return { runs: visibleRuns, staleImageCount, totalPendingImages };
}

// ---------------------------------------------------------------------------
// Queue — 待审核队列
// ---------------------------------------------------------------------------

export async function getQueueRuns(): Promise<QueueRun[]> {
  const { runs } = await getQueueRunsPage({ page: 1, pageSize: LEGACY_QUEUE_PAGE_SIZE });
  return runs;
}

export async function getQueueRunsPage(options: QueuePageOptions = {}): Promise<{
  runs: QueueRun[];
  pagination: QueuePagination;
}> {
  const { page, pageSize } = normalizeQueuePageOptions(options);
  const { runs, totalItems, totalPages, safePage, startIndex, totalPendingImages } =
    await loadVisibleQueueRunPage(page, pageSize);
  const presetMap = await batchResolvePresetNames(
    collectPresetIds(runs.map((r) => r.project.presetBindings)),
  );
  let staleImageCount = 0;
  const pagedRuns: QueueRun[] = [];

  for (const run of runs) {
    const serialized = serializeQueueRun(run, presetMap);
    if (!serialized) {
      staleImageCount += run.images.length;
      continue;
    }
    staleImageCount += serialized.staleImageCount;
    pagedRuns.push({
      id: serialized.id,
      presetNames: serialized.presetNames,
      projectTitle: serialized.projectTitle,
      sectionName: serialized.sectionName,
      createdAt: serialized.createdAt,
      finishedAt: serialized.finishedAt,
      pendingCount: serialized.pendingCount,
      totalCount: serialized.totalCount,
      status: serialized.status,
      thumbnailUrls: serialized.thumbnailUrls,
    });
  }

  return {
    runs: pagedRuns,
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      startItem: totalItems === 0 ? 0 : startIndex + 1,
      endItem: Math.min(startIndex + pageSize, totalItems),
      totalPendingImages,
      staleImageCount,
    },
  };
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

  const availableImages = run.images
    .map((image) => toAvailableImage(image))
    .filter((image): image is AvailableImage => Boolean(image));

  const images: ReviewImage[] = availableImages.map((img, index) => ({
    id: img.id,
    src: toImageUrl(img.displayPath) ?? "",
    full: (toImageUrl(img.filePath) ?? "") + "?q=80",
    label: `${index + 1}`.padStart(2, "0"),
    status: img.reviewStatus as ReviewStatus,
    featured: img.featured,
    featured2: img.featured2,
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
    where: VISIBLE_QUEUE_RUN_WHERE,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return runs.map((run) => run.id);
}
