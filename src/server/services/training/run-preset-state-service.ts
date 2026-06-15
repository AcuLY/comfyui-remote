import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TRAINING_RUN_PRESET_STATE_PATH = join(process.cwd(), "data", "training-run-preset-state.json");
let runPresetStateWriteQueue: Promise<unknown> = Promise.resolve();

type TrainingRunPresetState = {
  createdAt: string;
  presetId: string;
};

export class TrainingRunPresetStateServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunPresetStateServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readRunPresetStateMap(): Promise<Record<string, TrainingRunPresetState>> {
  try {
    const raw = await readFile(TRAINING_RUN_PRESET_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const state: Record<string, TrainingRunPresetState> = {};
      for (const [runId, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const record = value as Record<string, unknown>;
        const presetId = typeof record.presetId === "string" ? record.presetId : "";
        if (!presetId) continue;
        state[runId] = {
          createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
          presetId,
        };
      }
      return state;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return {} as Record<string, TrainingRunPresetState>;
}

async function writeRunPresetStateMap(state: Record<string, TrainingRunPresetState>) {
  await mkdir(dirname(TRAINING_RUN_PRESET_STATE_PATH), { recursive: true });
  const tempPath = `${TRAINING_RUN_PRESET_STATE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_RUN_PRESET_STATE_PATH);
}

async function withRunPresetStateWriteLock<T>(fn: () => Promise<T>) {
  const next = runPresetStateWriteQueue.then(fn, fn);
  runPresetStateWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listTrainingRunPresetStates() {
  return readRunPresetStateMap();
}

export async function recordTrainingRunPresetCreation(runId: string, presetId: string) {
  const normalizedRunId = runId.trim();
  const normalizedPresetId = presetId.trim();
  if (!normalizedRunId || !normalizedPresetId) {
    throw new TrainingRunPresetStateServiceError("runId and presetId are required", 400);
  }

  return withRunPresetStateWriteLock(async () => {
    const current = await readRunPresetStateMap();
    const existing = current[normalizedRunId];
    if (existing) {
      throw new TrainingRunPresetStateServiceError("Training run preset already exists", 409, {
        presetCreatedAt: existing.createdAt,
        presetId: existing.presetId,
        runId: normalizedRunId,
      });
    }

    const createdAt = new Date().toISOString();
    const next: Record<string, TrainingRunPresetState> = {
      ...current,
      [normalizedRunId]: {
        createdAt,
        presetId: normalizedPresetId,
      },
    };
    await writeRunPresetStateMap(next);
    return next[normalizedRunId];
  });
}

export function mapTrainingRunPresetStateError(error: unknown) {
  if (error instanceof TrainingRunPresetStateServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training run preset state error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
