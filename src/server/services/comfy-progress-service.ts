import { getComfyProcessManager } from "@/server/services/comfy-process-manager";

export type ComfyLogProgress = {
  percent: number;
  currentStep: number;
  totalSteps: number;
  elapsed: string | null;
  remaining: string | null;
  rate: string | null;
  stage: number;
  updatedAt: string | null;
  raw: string;
};

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const LOG_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+\[(?:stdout|stderr)\]/;
const TQDM_PROGRESS_PATTERN =
  /(\d{1,3})%\|.*?\|\s*(\d+)\/(\d+)\s*\[([^<,\]]+)(?:<([^,\]]+))?(?:,\s*([^\]]+))?\]/;

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function cleanProgressToken(value: string | undefined) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned === "?") return null;
  return cleaned;
}

function parseLogTimestamp(line: string) {
  const match = LOG_TIMESTAMP_PATTERN.exec(line);
  if (!match) return null;

  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseProgressFragment(
  fragment: string,
  timestamp: Date | null,
  stage: number,
): ComfyLogProgress | null {
  const match = TQDM_PROGRESS_PATTERN.exec(fragment);
  if (!match) return null;

  const percent = clampPercent(Number(match[1]));
  const currentStep = Number(match[2]);
  const totalSteps = Number(match[3]);

  if (
    !Number.isFinite(currentStep) ||
    !Number.isFinite(totalSteps) ||
    totalSteps <= 0
  ) {
    return null;
  }

  return {
    percent,
    currentStep,
    totalSteps,
    elapsed: cleanProgressToken(match[4]),
    remaining: cleanProgressToken(match[5]),
    rate: cleanProgressToken(match[6]),
    stage,
    updatedAt: timestamp?.toISOString() ?? null,
    raw: fragment.trim(),
  };
}

export function parseComfyLogProgress(
  logs: string[],
  options: { since?: Date | null } = {},
): ComfyLogProgress | null {
  const sinceMs = options.since?.getTime() ?? null;
  let latest: ComfyLogProgress | null = null;
  let stage = 0;

  for (const line of logs) {
    const timestamp = parseLogTimestamp(line);
    if (
      sinceMs !== null &&
      timestamp !== null &&
      timestamp.getTime() + 1000 < sinceMs
    ) {
      continue;
    }

    const fragments = line
      .replace(ANSI_PATTERN, "")
      .split(/\r|\n/)
      .map((fragment) => fragment.trim())
      .filter(Boolean);

    for (const fragment of fragments) {
      const progress = parseProgressFragment(fragment, timestamp, stage || 1);

      if (!progress) {
        continue;
      }

      const nextStage =
        latest === null
          ? 1
          : progress.currentStep < latest.currentStep ||
              (latest.percent >= 100 && progress.percent < 100)
            ? stage + 1
            : stage;

      stage = nextStage;
      latest = { ...progress, stage };
    }
  }

  return latest;
}

export function getLatestComfyLogProgress(since?: Date | null) {
  const logs = getComfyProcessManager().getStatus().logs;
  return parseComfyLogProgress(logs, { since });
}
