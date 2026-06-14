import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TRAINING_HIDDEN_PROJECTS_PATH = join(process.cwd(), "data", "training-hidden-projects.json");
let hiddenProjectWriteQueue: Promise<unknown> = Promise.resolve();

export class TrainingProjectVisibilityServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectVisibilityServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readHiddenProjectIds() {
  try {
    const raw = await readFile(TRAINING_HIDDEN_PROJECTS_PATH, "utf8");
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

async function writeHiddenProjectIds(projectIds: string[]) {
  await mkdir(dirname(TRAINING_HIDDEN_PROJECTS_PATH), { recursive: true });
  const tempPath = `${TRAINING_HIDDEN_PROJECTS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(projectIds, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_HIDDEN_PROJECTS_PATH);
}

async function withHiddenProjectWriteLock<T>(fn: () => Promise<T>) {
  const next = hiddenProjectWriteQueue.then(fn, fn);
  hiddenProjectWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listHiddenTrainingProjectIds() {
  return readHiddenProjectIds();
}

export async function hideTrainingProjects(projectIds: string[]) {
  const normalized = [...new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingProjectVisibilityServiceError("At least one project id is required", 400);
  }

  return withHiddenProjectWriteLock(async () => {
    const current = await readHiddenProjectIds();
    const next = [...new Set([...current, ...normalized])];
    await writeHiddenProjectIds(next);
    return { hiddenProjectIds: normalized };
  });
}

export function mapTrainingProjectVisibilityError(error: unknown) {
  if (error instanceof TrainingProjectVisibilityServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project visibility error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
