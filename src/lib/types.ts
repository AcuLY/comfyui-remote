export type ReviewStatus = "pending" | "kept" | "trashed";

export type QueueRun = {
  id: string;
  characterName: string;
  jobTitle: string;
  positionName: string;
  createdAt: string;
  finishedAt: string | null;
  pendingCount: number;
  totalCount: number;
  status: "queued" | "running" | "done" | "failed";
};

export type RunningRun = {
  id: string;
  characterName: string;
  jobTitle: string;
  positionName: string;
  startedAt: string;
  status: "queued" | "running";
};

export type FailedRun = {
  id: string;
  characterName: string;
  jobTitle: string;
  positionName: string;
  errorMessage: string | null;
  finishedAt: string | null;
};

export type ReviewImage = {
  id: string;
  src: string;
  label: string;
  status: ReviewStatus;
};

export type ReviewGroup = {
  id: string;
  jobId?: string;
  jobPositionId?: string;
  title: string;
  characterName: string;
  positionName: string;
  createdAt: string;
  pendingCount: number;
  totalCount: number;
  images: ReviewImage[];
};

export type JobCard = {
  id: string;
  title: string;
  characterName: string;
  sceneName: string;
  styleName: string;
  status: "draft" | "queued" | "running" | "partial_done" | "done" | "failed";
  updatedAt: string;
  positionCount: number;
  enabledPositionCount?: number;
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
