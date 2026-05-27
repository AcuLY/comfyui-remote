export type ReviewStatus = "pending" | "kept" | "trashed";

export type QueueRun = {
  id: string;
  presetNames: string[];
  projectTitle: string;
  sectionName: string;
  createdAt: string;
  finishedAt: string | null;
  pendingCount: number;
  totalCount: number;
  status: "queued" | "running" | "done" | "failed";
  thumbnailUrls: string[];
};

export type QueuePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  totalPendingImages: number;
  staleImageCount: number;
};

export type RunningRun = {
  id: string;
  presetNames: string[];
  projectTitle: string;
  sectionName: string;
  startedAt: string;
  status: "queued" | "running" | "paused";
  progress: {
    percent: number;
    currentStep: number;
    totalSteps: number;
    elapsed: string | null;
    remaining: string | null;
    rate: string | null;
    stage: number;
    updatedAt: string | null;
  } | null;
};

export type FailedRun = {
  id: string;
  presetNames: string[];
  projectTitle: string;
  sectionName: string;
  sectionId: string;
  errorMessage: string | null;
  finishedAt: string | null;
};

export type ReviewImage = {
  id: string;
  src: string;
  full: string;
  label: string;
  status: ReviewStatus;
  featured: boolean;
  featured2: boolean;
  cover: boolean;
};

export type ReviewGroup = {
  id: string;
  projectId?: string;
  projectSectionId?: string;
  title: string;
  presetNames: string[];
  sectionName: string;
  createdAt: string;
  pendingCount: number;
  totalCount: number;
  images: ReviewImage[];
  executionMeta: Record<string, unknown> | null;
};

export type ProjectCard = {
  id: string;
  title: string;
  folderId: string | null;
  presetNames: string[];
  status: "draft" | "queued" | "running" | "partial_done" | "done" | "failed";
  updatedAt: string;
  sectionCount: number;
  enabledSectionCount?: number;
  latestRunAt?: string | null;
  latestRunStatus?: "queued" | "running" | "done" | "failed" | "cancelled" | null;
  latestRunPendingCount?: number;
  latestRunTotalCount?: number;
  latestRunId?: string | null;
  latestImages?: { id: string; src: string; status: ReviewStatus }[];
  latestImageCount?: number;
};

export type ProjectFolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  projectCount: number;
  childCount: number;
};

export type TrashItem = {
  id: string;
  imageResultId: string;
  src?: string;
  title: string;
  deletedAt: string;
  originalPath: string;
  projectId: string;
  projectTitle: string;
  sectionId: string;
  sectionName: string;
  sectionSortOrder: number;
};

export type LoraAsset = {
  id: string;
  name: string;
  category: string;
  relativePath: string;
  uploadedAt: string;
};

export type CensoringProgressItem = {
  projectId: string;
  projectTitle: string;
  total: number;
  done: number;
  running: number;
  queued: number;
  failed: number;
};
