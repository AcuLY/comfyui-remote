import { jobs, loraAssets, queueRuns, reviewGroups, trashItems } from "@/lib/mock-data";
import type { JobCard, LoraAsset, QueueRun, ReviewGroup, TrashItem } from "@/lib/types";

type ApiEnvelope<T> = { ok?: boolean; data?: T };
type ApiTrashItem = {
  id: string;
  deletedAt: string;
  originalPath: string;
  previewPath?: string | null;
  src?: string;
  title?: string;
};
type JobRunStatus = QueueRun["status"] | "cancelled";

type ApiPresetInfo = {
  id?: string;
  name?: string;
  slug?: string;
  prompt?: string;
  notes?: string | null;
} | null;

type ApiCharacterInfo = {
  id?: string;
  name?: string;
  slug?: string;
  prompt?: string;
  loraPath?: string | null;
  notes?: string | null;
};

type ApiJobLatestRun = {
  id?: string;
  runIndex?: number;
  status?: string;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  outputDir?: string | null;
  errorMessage?: string | null;
  totalCount?: number;
  pendingCount?: number;
  keptCount?: number;
  trashedCount?: number;
};

type ApiJobDetailPosition = {
  id?: string;
  name?: string;
  aspectRatio?: string;
  batchSize?: number;
  seedPolicy?: string;
  promptOverview?: {
    templatePrompt?: string;
    positivePrompt?: string;
    negativePrompt?: string;
  };
  latestRun?: ApiJobLatestRun | null;
};

type ApiJobDetail = {
  id?: string;
  title?: string;
  status?: string;
  updatedAt?: string;
  characterName?: string;
  sceneName?: string;
  styleName?: string;
  positionCount?: number;
  enabledPositionCount?: number;
  promptOverview?: {
    characterPrompt?: string;
    scenePrompt?: string;
    stylePrompt?: string;
    characterLoraPath?: string | null;
    jobLevelOverrides?: unknown;
  };
  character?: ApiCharacterInfo;
  scenePreset?: ApiPresetInfo;
  stylePreset?: ApiPresetInfo;
  positions?: ApiJobDetailPosition[];
};

export type JobLatestRun = {
  id: string;
  runIndex: number;
  status: JobRunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDir: string | null;
  errorMessage: string | null;
  totalCount: number;
  pendingCount: number;
  keptCount: number;
  trashedCount: number;
};

export type JobPromptOverview = {
  characterPrompt: string;
  scenePrompt: string;
  stylePrompt: string;
  characterLoraPath: string;
  jobLevelOverrides: unknown;
};

export type JobCharacterInfo = {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  loraPath: string;
  notes: string;
};

export type JobPresetInfo = {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  notes: string;
};

export type JobDetailPosition = {
  id: string;
  name: string;
  aspectRatio: string;
  batchSize: number;
  seedPolicy: string;
  promptOverview: {
    templatePrompt: string;
    positivePrompt: string;
    negativePrompt: string;
  };
  latestRun: JobLatestRun | null;
};

export type JobDetail = {
  id: string;
  title: string;
  status: JobCard["status"];
  updatedAt: string;
  characterName: string;
  sceneName: string;
  styleName: string;
  positionCount: number;
  enabledPositionCount: number;
  promptOverview: JobPromptOverview;
  character: JobCharacterInfo;
  scenePreset: JobPresetInfo;
  stylePreset: JobPresetInfo;
  positions: JobDetailPosition[];
};

const JOB_STATUSES: JobCard["status"][] = ["draft", "queued", "running", "partial_done", "done", "failed"];
const RUN_STATUSES: JobRunStatus[] = ["queued", "running", "done", "failed", "cancelled"];

const DEFAULT_JOB_PROMPTS = {
  characterPrompt: "miku, long hair, calm expression...",
  scenePrompt: "park bench, spring afternoon, outdoor...",
  stylePrompt: "soft daylight, anime cinematic, detailed shading...",
  characterLoraPath: "characters/miku-v3.safetensors",
} as const;

const DEFAULT_POSITION_TEMPLATES = [
  {
    id: "standing",
    name: "Standing",
    aspectRatio: "3:4",
    batchSize: 8,
    seedPolicy: "random-per-run",
    templatePrompt: "1girl, standing, outdoor, detailed pose...",
  },
  {
    id: "watching",
    name: "Watching",
    aspectRatio: "3:4",
    batchSize: 8,
    seedPolicy: "random-per-run",
    templatePrompt: "1girl, looking back, outdoor, detailed pose...",
  },
  {
    id: "bench-sit",
    name: "Bench sit",
    aspectRatio: "3:4",
    batchSize: 6,
    seedPolicy: "random-per-run",
    templatePrompt: "1girl, sitting on a bench, outdoor, relaxed pose...",
  },
] as const;

function getFileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function normalizeTrashItems(items: ApiTrashItem[]): TrashItem[] {
  return items.map((item) => ({
    id: item.id,
    src: item.src ?? item.previewPath ?? undefined,
    title: item.title ?? getFileName(item.originalPath),
    deletedAt: item.deletedAt,
    originalPath: item.originalPath,
  }));
}

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload?.data ?? fallback;
  } catch {
    return fallback;
  }
}

function coalesceString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function coalesceNullableString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }

    if (value === null) {
      return null;
    }
  }

  return null;
}

function coalesceNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function normalizeJobStatus(value: unknown, fallback: JobCard["status"]): JobCard["status"] {
  return typeof value === "string" && JOB_STATUSES.includes(value as JobCard["status"])
    ? (value as JobCard["status"])
    : fallback;
}

function normalizeRunStatus(value: unknown, fallback: JobRunStatus): JobRunStatus {
  return typeof value === "string" && RUN_STATUSES.includes(value as JobRunStatus)
    ? (value as JobRunStatus)
    : fallback;
}

function createFallbackLatestRun(jobTitle: string, positionName: string): JobLatestRun | null {
  const run = queueRuns.find((item) => item.jobTitle === jobTitle && item.positionName === positionName);

  if (!run) {
    return null;
  }

  return {
    id: run.id,
    runIndex: 1,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: null,
    finishedAt: null,
    outputDir: null,
    errorMessage: null,
    totalCount: run.totalCount,
    pendingCount: run.pendingCount,
    keptCount: Math.max(run.totalCount - run.pendingCount, 0),
    trashedCount: 0,
  };
}

function createFallbackPosition(jobTitle: string, index: number, id?: string, name?: string): JobDetailPosition {
  const template = DEFAULT_POSITION_TEMPLATES[index] ?? DEFAULT_POSITION_TEMPLATES[0];
  const resolvedName = typeof name === "string" ? name : template.name;
  const templatePrompt = template.templatePrompt;

  return {
    id: typeof id === "string" ? id : template.id,
    name: resolvedName,
    aspectRatio: template.aspectRatio,
    batchSize: template.batchSize,
    seedPolicy: template.seedPolicy,
    promptOverview: {
      templatePrompt,
      positivePrompt: templatePrompt,
      negativePrompt: "lowres, blurry, extra fingers...",
    },
    latestRun: createFallbackLatestRun(jobTitle, resolvedName),
  };
}

function createFallbackPreset(name: string, prompt: string): JobPresetInfo {
  return {
    id: "",
    name,
    slug: "",
    prompt,
    notes: "",
  };
}

function createFallbackJobDetail(job: JobCard): JobDetail {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    updatedAt: job.updatedAt,
    characterName: job.characterName,
    sceneName: job.sceneName,
    styleName: job.styleName,
    positionCount: job.positionCount,
    enabledPositionCount: DEFAULT_POSITION_TEMPLATES.length,
    promptOverview: {
      ...DEFAULT_JOB_PROMPTS,
      jobLevelOverrides: null,
    },
    character: {
      id: "",
      name: job.characterName,
      slug: "",
      prompt: DEFAULT_JOB_PROMPTS.characterPrompt,
      loraPath: DEFAULT_JOB_PROMPTS.characterLoraPath,
      notes: "",
    },
    scenePreset: createFallbackPreset(job.sceneName, DEFAULT_JOB_PROMPTS.scenePrompt),
    stylePreset: createFallbackPreset(job.styleName, DEFAULT_JOB_PROMPTS.stylePrompt),
    positions: DEFAULT_POSITION_TEMPLATES.map((template, index) =>
      createFallbackPosition(job.title, index, template.id, template.name),
    ),
  };
}

function createEmptyJobDetailFallback(jobId: string): JobDetail {
  return {
    id: jobId,
    title: jobId,
    status: "draft",
    updatedAt: "",
    characterName: "Not set",
    sceneName: "Not set",
    styleName: "Not set",
    positionCount: 0,
    enabledPositionCount: 0,
    promptOverview: {
      characterPrompt: "",
      scenePrompt: "",
      stylePrompt: "",
      characterLoraPath: "",
      jobLevelOverrides: null,
    },
    character: {
      id: "",
      name: "Not set",
      slug: "",
      prompt: "",
      loraPath: "",
      notes: "",
    },
    scenePreset: createFallbackPreset("Not set", ""),
    stylePreset: createFallbackPreset("Not set", ""),
    positions: [],
  };
}

function normalizeCharacter(
  apiCharacter: ApiCharacterInfo | undefined,
  fallback: JobCharacterInfo,
  fallbackName: string,
): JobCharacterInfo {
  return {
    id: coalesceString(apiCharacter?.id, fallback.id) ?? "",
    name: coalesceString(apiCharacter?.name, fallbackName, fallback.name) ?? fallback.name,
    slug: coalesceString(apiCharacter?.slug, fallback.slug) ?? "",
    prompt: coalesceString(apiCharacter?.prompt, fallback.prompt) ?? "",
    loraPath: coalesceString(apiCharacter?.loraPath, fallback.loraPath) ?? "",
    notes: coalesceString(apiCharacter?.notes, fallback.notes) ?? "",
  };
}

function normalizePreset(apiPreset: ApiPresetInfo | undefined, fallback: JobPresetInfo): JobPresetInfo {
  return {
    id: coalesceString(apiPreset?.id, fallback.id) ?? "",
    name: coalesceString(apiPreset?.name, fallback.name) ?? fallback.name,
    slug: coalesceString(apiPreset?.slug, fallback.slug) ?? "",
    prompt: coalesceString(apiPreset?.prompt, fallback.prompt) ?? "",
    notes: coalesceString(apiPreset?.notes, fallback.notes) ?? "",
  };
}

function normalizeLatestRun(apiRun: ApiJobLatestRun | null | undefined, fallback: JobLatestRun | null): JobLatestRun | null {
  if (!apiRun && !fallback) {
    return null;
  }

  return {
    id: coalesceString(apiRun?.id, fallback?.id) ?? "",
    runIndex: coalesceNumber(apiRun?.runIndex, fallback?.runIndex, 1) ?? 1,
    status: normalizeRunStatus(apiRun?.status, fallback?.status ?? "done"),
    createdAt: coalesceString(apiRun?.createdAt, fallback?.createdAt) ?? "",
    startedAt: coalesceNullableString(apiRun?.startedAt, fallback?.startedAt),
    finishedAt: coalesceNullableString(apiRun?.finishedAt, fallback?.finishedAt),
    outputDir: coalesceNullableString(apiRun?.outputDir, fallback?.outputDir),
    errorMessage: coalesceNullableString(apiRun?.errorMessage, fallback?.errorMessage),
    totalCount: coalesceNumber(apiRun?.totalCount, fallback?.totalCount, 0) ?? 0,
    pendingCount: coalesceNumber(apiRun?.pendingCount, fallback?.pendingCount, 0) ?? 0,
    keptCount: coalesceNumber(apiRun?.keptCount, fallback?.keptCount, 0) ?? 0,
    trashedCount: coalesceNumber(apiRun?.trashedCount, fallback?.trashedCount, 0) ?? 0,
  };
}

function normalizePosition(
  apiPosition: ApiJobDetailPosition | undefined,
  fallback: JobDetailPosition,
): JobDetailPosition {
  const promptOverview = apiPosition?.promptOverview;
  const templatePrompt = coalesceString(promptOverview?.templatePrompt, fallback.promptOverview.templatePrompt) ?? "";

  return {
    id: coalesceString(apiPosition?.id, fallback.id) ?? fallback.id,
    name: coalesceString(apiPosition?.name, fallback.name) ?? fallback.name,
    aspectRatio: coalesceString(apiPosition?.aspectRatio, fallback.aspectRatio) ?? fallback.aspectRatio,
    batchSize: coalesceNumber(apiPosition?.batchSize, fallback.batchSize) ?? fallback.batchSize,
    seedPolicy: coalesceString(apiPosition?.seedPolicy, fallback.seedPolicy) ?? fallback.seedPolicy,
    promptOverview: {
      templatePrompt,
      positivePrompt: coalesceString(promptOverview?.positivePrompt, templatePrompt, fallback.promptOverview.positivePrompt) ?? "",
      negativePrompt: coalesceString(promptOverview?.negativePrompt, fallback.promptOverview.negativePrompt) ?? "",
    },
    latestRun: normalizeLatestRun(apiPosition?.latestRun, fallback.latestRun),
  };
}

function normalizePositions(apiPositions: ApiJobDetailPosition[] | undefined, fallback: JobDetail): JobDetailPosition[] {
  if (!Array.isArray(apiPositions)) {
    return fallback.positions;
  }

  return apiPositions.map((position, index) =>
    normalizePosition(
      position,
      fallback.positions[index] ??
        createFallbackPosition(
          fallback.title,
          index,
          typeof position?.id === "string" ? position.id : undefined,
          typeof position?.name === "string" ? position.name : undefined,
        ),
    ),
  );
}

function hasJobDetailFallbackGaps(detail: ApiJobDetail | null) {
  if (!detail) {
    return true;
  }

  return (
    typeof detail.title !== "string" ||
    !Array.isArray(detail.positions) ||
    coalesceString(detail.characterName, detail.character?.name) === undefined ||
    coalesceString(detail.sceneName, detail.scenePreset?.name) === undefined ||
    coalesceString(detail.styleName, detail.stylePreset?.name) === undefined
  );
}

async function getListedJobFallback(jobId: string): Promise<JobDetail | null> {
  const job = (await getJobs()).find((item) => item.id === jobId);
  return job ? createFallbackJobDetail(job) : null;
}

function normalizeJobDetail(jobId: string, detail: ApiJobDetail | null, fallback: JobDetail | null): JobDetail | null {
  if (!detail && !fallback) {
    return null;
  }

  const base = fallback ?? createEmptyJobDetailFallback(jobId);
  const characterName = coalesceString(detail?.characterName, detail?.character?.name, base.characterName) ?? base.characterName;
  const sceneName = coalesceString(detail?.sceneName, detail?.scenePreset?.name, base.sceneName) ?? base.sceneName;
  const styleName = coalesceString(detail?.styleName, detail?.stylePreset?.name, base.styleName) ?? base.styleName;
  const promptOverview = detail?.promptOverview;

  return {
    id: coalesceString(detail?.id, base.id) ?? base.id,
    title: coalesceString(detail?.title, base.title) ?? base.title,
    status: normalizeJobStatus(detail?.status, base.status),
    updatedAt: coalesceString(detail?.updatedAt, base.updatedAt) ?? base.updatedAt,
    characterName,
    sceneName,
    styleName,
    positionCount: coalesceNumber(
      detail?.positionCount,
      Array.isArray(detail?.positions) ? detail.positions.length : undefined,
      base.positionCount,
    ) ?? base.positionCount,
    enabledPositionCount: coalesceNumber(
      detail?.enabledPositionCount,
      Array.isArray(detail?.positions) ? detail.positions.length : undefined,
      base.enabledPositionCount,
    ) ?? base.enabledPositionCount,
    promptOverview: {
      characterPrompt: coalesceString(
        promptOverview?.characterPrompt,
        detail?.character?.prompt,
        base.promptOverview.characterPrompt,
      ) ?? "",
      scenePrompt: coalesceString(promptOverview?.scenePrompt, detail?.scenePreset?.prompt, base.promptOverview.scenePrompt) ?? "",
      stylePrompt: coalesceString(promptOverview?.stylePrompt, detail?.stylePreset?.prompt, base.promptOverview.stylePrompt) ?? "",
      characterLoraPath: coalesceString(
        promptOverview?.characterLoraPath,
        detail?.character?.loraPath,
        base.promptOverview.characterLoraPath,
      ) ?? "",
      jobLevelOverrides: promptOverview?.jobLevelOverrides ?? base.promptOverview.jobLevelOverrides,
    },
    character: normalizeCharacter(detail?.character, base.character, characterName),
    scenePreset: normalizePreset(detail?.scenePreset, { ...base.scenePreset, name: sceneName }),
    stylePreset: normalizePreset(detail?.stylePreset, { ...base.stylePreset, name: styleName }),
    positions: normalizePositions(detail?.positions, base),
  };
}

export function formatJobSubtitle(job: Pick<JobDetail, "characterName" | "sceneName" | "styleName">) {
  return `${job.characterName} · ${job.sceneName} · ${job.styleName}`;
}

export function getQueueRuns(): Promise<QueueRun[]> {
  return fetchJson("/api/queue", queueRuns);
}

export function getJobs(): Promise<JobCard[]> {
  return fetchJson("/api/jobs", jobs);
}

export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const normalizedJobId = jobId.trim();

  if (!normalizedJobId) {
    return null;
  }

  const detail = await fetchJson<ApiJobDetail | null>(`/api/jobs/${encodeURIComponent(normalizedJobId)}`, null);
  const mockFallback = jobs.find((item) => item.id === normalizedJobId);
  const fallback = mockFallback
    ? createFallbackJobDetail(mockFallback)
    : hasJobDetailFallbackGaps(detail)
      ? await getListedJobFallback(normalizedJobId)
      : null;

  return normalizeJobDetail(normalizedJobId, detail, fallback);
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const items = await fetchJson<ApiTrashItem[]>("/api/trash", trashItems);
  return normalizeTrashItems(items);
}

export function getLoraAssets(): Promise<LoraAsset[]> {
  return fetchJson("/api/loras", loraAssets);
}

export function getReviewGroup(runId: string): Promise<ReviewGroup | null> {
  const fallback = reviewGroups.find((group) => group.id === runId) ?? null;
  return fetchJson(`/api/runs/${encodeURIComponent(runId)}`, fallback);
}
