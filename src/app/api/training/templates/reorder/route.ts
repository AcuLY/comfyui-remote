import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingTemplateOrderError,
  saveTrainingTemplateOrderIds,
} from "@/server/services/training/template-order-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const orderedTemplateIds = Array.isArray(payload.orderedTemplateIds)
      ? payload.orderedTemplateIds.filter((templateId): templateId is string => typeof templateId === "string")
      : [];
    const data = await saveTrainingTemplateOrderIds(orderedTemplateIds);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateOrderError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
