import { fail, ok } from "@/lib/api-response";
import { cancelManagedGenerationRun, mapTrainingProjectError } from "@/server/services/training/project-service";
import {
  cancelLegacyTrainingGenerationRun,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { runId } = await params;
    const managed = await cancelManagedGenerationRun(runId);
    if (managed) {
      return ok(managed);
    }
    const data = await cancelLegacyTrainingGenerationRun(runId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    if (mapped.status !== 500 || mapped.message !== "Unexpected training project error") {
      return fail(mapped.message, mapped.status, mapped.details);
    }
    const phase3Mapped = mapLegacyTrainingGenerationError(error);
    return fail(phase3Mapped.message, phase3Mapped.status, phase3Mapped.details);
  }
}
