import type { DemoRun } from "../../data";
import type { QueueDemoTab } from "../../routing";
import type { DemoCurrentRun, DemoRunProgress, QueueProjectGroup, QueueReviewRow, QueueRunMode } from "./types";

export function buildQueueReviewRows(runs: DemoRun[]): QueueReviewRow[] {
  const sourceRuns = runs.filter((run) => run.images.length > 0);
  const needsPendingMock = sourceRuns.length > 0 && sourceRuns.every((run) => run.pendingCount === 0);

  return sourceRuns.map((run, index) => {
    const imageTotal = Math.max(run.imageCount, run.images.length, 1);
    const actualPending = run.pendingCount;
    const pendingCount = actualPending > 0 ? actualPending : needsPendingMock ? Math.min(imageTotal, 1 + (index % 3)) : 0;

    return {
      run,
      pendingCount,
    };
  });
}

function numericMeta(meta: Record<string, unknown> | null, key: string, fallback: number) {
  const value = meta?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function buildDemoRunProgress(run: DemoRun, index: number): DemoRunProgress {
  const stageOneSteps = Math.max(1, Math.round(numericMeta(run.executionMeta, "ks1Steps", 28)));
  const stageTwoSteps = Math.max(0, Math.round(numericMeta(run.executionMeta, "ks2Steps", 0)));
  const hasStageTwo = stageTwoSteps > 0;
  const totalSteps = hasStageTwo ? stageOneSteps + stageTwoSteps : stageOneSteps;
  const percent = Math.min(94, 48 + ((run.runIndex * 13 + index * 17) % 40));
  const currentStep = Math.max(1, Math.min(totalSteps, Math.round((totalSteps * percent) / 100)));

  return {
    percent,
    currentStep,
    totalSteps,
    elapsed: "02:14",
    remaining: "00:56",
    rate: "1.8s/it",
    stage: hasStageTwo && currentStep > stageOneSteps ? 2 : 1,
  };
}

export function buildCurrentRunningRuns(runs: DemoRun[]): DemoCurrentRun[] {
  return runs
    .filter((run) => run.status === "running")
    .slice(0, 1)
    .map((run, index) => ({
      run,
      progress: buildDemoRunProgress(run, index),
    }));
}

export function buildQueueStatusRuns(runs: DemoRun[], mode: QueueRunMode) {
  const filtered = runs.filter((run) => (mode === "running" ? ["queued", "running"].includes(run.status) : run.status === "failed"));
  if (filtered.length > 0) return filtered;
  const mockSource = runs.filter((run) => run.images.length > 0);
  const fallback = mode === "running" ? mockSource.slice(0, 4) : mockSource.slice(0, 3);
  return fallback.map((run, index) => ({
    ...run,
    status: mode === "running" ? (index % 2 === 0 ? "running" : "queued") : "failed",
    errorMessage: mode === "failed" ? run.errorMessage ?? "ComfyUI 返回空结果或连接超时" : run.errorMessage,
  }));
}

function queueDateValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function groupRowsByProject<T extends { run: DemoRun }>(rows: T[]): QueueProjectGroup<T>[] {
  const groups = new Map<string, QueueProjectGroup<T>>();

  rows.forEach((row) => {
    const key = row.run.projectId || row.run.projectTitle;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      if (queueDateValue(row.run.createdAt) > queueDateValue(existing.latestCreatedAt)) {
        existing.latestCreatedAt = row.run.createdAt;
      }
      return;
    }

    groups.set(key, {
      id: key,
      title: row.run.projectTitle,
      latestCreatedAt: row.run.createdAt,
      rows: [row],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => queueDateValue(b.run.createdAt) - queueDateValue(a.run.createdAt)),
    }))
    .sort((a, b) => queueDateValue(b.latestCreatedAt) - queueDateValue(a.latestCreatedAt));
}

export function groupRunsByProject(runs: DemoRun[]) {
  return groupRowsByProject(runs.map((run) => ({ run })));
}

export function groupCollapsedKey(tab: QueueDemoTab, groupId: string) {
  return `${tab}:${groupId}`;
}
