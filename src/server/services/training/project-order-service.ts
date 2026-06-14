import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TRAINING_PROJECT_ORDER_PATH = join(process.cwd(), "data", "training-project-order.json");
let trainingProjectOrderWriteQueue: Promise<unknown> = Promise.resolve();

export class TrainingProjectOrderServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingProjectOrderServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readProjectOrderIds() {
  try {
    const raw = await readFile(TRAINING_PROJECT_ORDER_PATH, "utf8");
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

async function writeProjectOrderIds(projectIds: string[]) {
  await mkdir(dirname(TRAINING_PROJECT_ORDER_PATH), { recursive: true });
  const tempPath = `${TRAINING_PROJECT_ORDER_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(projectIds, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_PROJECT_ORDER_PATH);
}

async function withProjectOrderWriteLock<T>(fn: () => Promise<T>) {
  const next = trainingProjectOrderWriteQueue.then(fn, fn);
  trainingProjectOrderWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listTrainingProjectOrderIds() {
  return readProjectOrderIds();
}

export async function saveTrainingProjectOrderIds(projectIds: string[]) {
  const normalized = [...new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingProjectOrderServiceError("At least one project id is required", 400);
  }

  return withProjectOrderWriteLock(async () => {
    await writeProjectOrderIds(normalized);
    return { orderedProjectIds: normalized };
  });
}

export function orderTrainingProjectsByStoredIds<T extends { id: string }>(projects: T[], orderedProjectIds: string[]) {
  if (orderedProjectIds.length === 0) {
    return projects;
  }

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const ordered = orderedProjectIds
    .map((projectId) => projectMap.get(projectId))
    .filter((project): project is T => Boolean(project));
  const missing = projects.filter((project) => !orderedProjectIds.includes(project.id));
  return [...ordered, ...missing];
}

export function mapTrainingProjectOrderError(error: unknown) {
  if (error instanceof TrainingProjectOrderServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training project order error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
