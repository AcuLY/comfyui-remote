import { fail, ok } from "@/lib/api-response";
import { cancelManagedGenerationRun, mapTrainingProjectError } from "@/server/services/training/project-service";

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
    const managed = await cancelManagedGenerationRun(taskId);
    if (managed) {
      return ok(managed);
    }
    return fail("Generation task cancellation is not supported for this run", 501, {
      taskId,
      requestedBy: typeof body === "object" && body ? (body as Record<string, unknown>).requestedBy : null,
    });
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
