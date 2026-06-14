import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TRAINING_HIDDEN_RUNS_PATH = join(process.cwd(), "data", "training-hidden-runs.json");
let hiddenRunWriteQueue: Promise<unknown> = Promise.resolve();

export class TrainingRunVisibilityServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingRunVisibilityServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readHiddenRunIds() {
  try {
    const raw = await readFile(TRAINING_HIDDEN_RUNS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return [] as string[];
}

async function writeHiddenRunIds(runIds: string[]) {
  await mkdir(dirname(TRAINING_HIDDEN_RUNS_PATH), { recursive: true });
  const tempPath = `${TRAINING_HIDDEN_RUNS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(runIds, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_HIDDEN_RUNS_PATH);
}

async function withHiddenRunWriteLock<T>(fn: () => Promise<T>) {
  const next = hiddenRunWriteQueue.then(fn, fn);
  hiddenRunWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listHiddenTrainingRunIds() {
  return readHiddenRunIds();
}

export async function hideTrainingRuns(runIds: string[]) {
  const normalized = [...new Set(runIds.map((runId) => runId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingRunVisibilityServiceError("At least one run id is required", 400);
  }

  return withHiddenRunWriteLock(async () => {
    const current = await readHiddenRunIds();
    const next = [...new Set([...current, ...normalized])];
    await writeHiddenRunIds(next);
    return { hiddenRunIds: normalized };
  });
}

export function mapTrainingRunVisibilityError(error: unknown) {
  if (error instanceof TrainingRunVisibilityServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training run visibility error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
