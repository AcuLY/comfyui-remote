import { fail, ok } from "@/lib/api-response";
import { completeManagedGenerationRun, mapTrainingProjectError } from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { taskId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await completeManagedGenerationRun(taskId, {
      resultImageResultId: typeof payload.resultImageResultId === "string" ? payload.resultImageResultId : null,
      captionDraft: typeof payload.captionDraft === "string" ? payload.captionDraft : null,
      reviewStatus: typeof payload.reviewStatus === "string" ? payload.reviewStatus : null,
    });
    if (!data) {
      return fail("Training generation task not found", 404, { taskId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
