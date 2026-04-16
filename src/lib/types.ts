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

export type RunningRun = {
  id: string;
  presetNames: string[];
  projectTitle: string;
  sectionName: string;
  startedAt: string;
  status: "queued" | "running";
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
  presetNames: string[];
  status: "draft" | "queued" | "running" | "partial_done" | "done" | "failed";
  updatedAt: string;
  sectionCount: number;
  enabledSectionCount?: number;
  latestRunAt?: string | null;
  latestRunStatus?: "queued" | "running" | "done" | "failed" | "cancelled" | null;
  latestRunPendingCount?: number;
  latestRunTotalCount?: number;
};

export type TrashItem = {
  id: string;
  src?: string;
  title: string;
  deletedAt: string;
  originalPath: string;
};

export type LoraAsset = {
  id: string;
  name: string;
  category: string;
  relativePath: string;
  uploadedAt: string;
};
