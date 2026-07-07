import { fail, failFromError, ok } from "@/lib/api-response";
import {
  mapTrainingProjectOrderError,
  saveTrainingProjectOrderIds,
} from "@/server/services/training/project-order-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const orderedProjectIds = Array.isArray(payload.orderedProjectIds)
      ? payload.orderedProjectIds.filter((projectId): projectId is string => typeof projectId === "string")
      : [];
    const data = await saveTrainingProjectOrderIds(orderedProjectIds);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectOrderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
