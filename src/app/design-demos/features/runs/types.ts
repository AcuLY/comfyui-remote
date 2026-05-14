import type { DemoRun } from "../../data";

export type QueueReviewRow = {
  run: DemoRun;
  pendingCount: number;
};

export type QueueProjectGroup<T> = {
  id: string;
  title: string;
  latestCreatedAt: string;
  rows: T[];
};

export type DemoRunProgress = {
  percent: number;
  currentStep: number;
  totalSteps: number;
  elapsed: string | null;
  remaining: string | null;
  rate: string | null;
  stage: number;
};

export type DemoCurrentRun = {
  run: DemoRun;
  progress: DemoRunProgress;
};

export type QueueRunMode = "running" | "failed";
