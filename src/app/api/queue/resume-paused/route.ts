import { fail, failFromError, ok } from "@/lib/api-response";
import { resumeAllRuns } from "@/lib/actions/run";
import { readOptionalJsonObject } from "@/server/http/request-json";
import {
  createQueueControlProgressStream,
  wantsQueueControlStream,
} from "@/server/services/queue-control-stream";

const QUEUE_API_PAUSE_SOURCE = "api-pause-active";

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
    const body = await readOptionalJsonObject(request);
    const runIds = normalizeRunIds(body.runIds);
    const batchId = normalizeBatchId(body.batchId);
    if (wantsQueueControlStream(request)) {
      return createQueueControlProgressStream((onProgress) =>
        resumeAllRuns({
          runIds,
          batchId,
          source: QUEUE_API_PAUSE_SOURCE,
          markedOnly: true,
          onProgress,
        }),
      );
    }

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
    return failFromError(error, "Failed to resume paused runs");
  }
}
