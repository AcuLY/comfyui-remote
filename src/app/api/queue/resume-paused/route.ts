import { fail, ok } from "@/lib/api-response";
import { resumeAllRuns } from "@/lib/actions/run";

const QUEUE_API_PAUSE_SOURCE = "api-pause-active";

async function readOptionalJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

function normalizeRunIds(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("runIds must be an array of strings");
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeBatchId(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("batchId must be a string");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await readOptionalJsonBody(request);
    const runIds = normalizeRunIds(body.runIds);
    const batchId = normalizeBatchId(body.batchId);
    const result = await resumeAllRuns({
      runIds,
      batchId,
      source: QUEUE_API_PAUSE_SOURCE,
      markedOnly: true,
    });

    if (!result.ok) {
      return fail(result.error ?? "Failed to resume paused runs", 500, {
        count: result.count,
        runIds: result.runIds,
        batchId,
      });
    }

    return ok({
      resumedCount: result.count,
      runIds: result.runIds,
      batchId,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to resume paused runs", 500);
  }
}
