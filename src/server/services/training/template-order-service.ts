import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TRAINING_TEMPLATE_ORDER_PATH = join(process.cwd(), "data", "training-template-order.json");
let trainingTemplateOrderWriteQueue: Promise<unknown> = Promise.resolve();

export class TrainingTemplateOrderServiceError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "TrainingTemplateOrderServiceError";
    this.status = status;
    this.details = details;
  }
}

async function readTemplateOrderIds() {
  try {
    const raw = await readFile(TRAINING_TEMPLATE_ORDER_PATH, "utf8");
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

async function writeTemplateOrderIds(templateIds: string[]) {
  await mkdir(dirname(TRAINING_TEMPLATE_ORDER_PATH), { recursive: true });
  const tempPath = `${TRAINING_TEMPLATE_ORDER_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(templateIds, null, 2)}\n`, "utf8");
  await rename(tempPath, TRAINING_TEMPLATE_ORDER_PATH);
}

async function withTemplateOrderWriteLock<T>(fn: () => Promise<T>) {
  const next = trainingTemplateOrderWriteQueue.then(fn, fn);
  trainingTemplateOrderWriteQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listTrainingTemplateOrderIds() {
  return readTemplateOrderIds();
}

export async function saveTrainingTemplateOrderIds(templateIds: string[]) {
  const normalized = [...new Set(templateIds.map((templateId) => templateId.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    throw new TrainingTemplateOrderServiceError("At least one template id is required", 400);
  }

  return withTemplateOrderWriteLock(async () => {
    await writeTemplateOrderIds(normalized);
    return { orderedTemplateIds: normalized };
  });
}

export function orderTrainingTemplatesByStoredIds<T extends { id: string }>(templates: T[], orderedTemplateIds: string[]) {
  if (orderedTemplateIds.length === 0) {
    return templates;
  }

  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const ordered = orderedTemplateIds
    .map((templateId) => templateMap.get(templateId))
    .filter((template): template is T => Boolean(template));
  const missing = templates.filter((template) => !orderedTemplateIds.includes(template.id));
  return [...ordered, ...missing];
}

export function mapTrainingTemplateOrderError(error: unknown) {
  if (error instanceof TrainingTemplateOrderServiceError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: "Unexpected training template order error",
    status: 500,
    details: error instanceof Error ? error.message : String(error),
  };
}
