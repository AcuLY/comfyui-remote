import { fail, ok } from "@/lib/api-response";
import { mapTrainingProjectError, progressManagedTrainingRun } from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { trainingRunId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await progressManagedTrainingRun(trainingRunId, {
      currentStep: typeof payload.currentStep === "number" ? payload.currentStep : null,
      targetSteps: typeof payload.targetSteps === "number" ? payload.targetSteps : null,
      schedulerMessage: typeof payload.schedulerMessage === "string" ? payload.schedulerMessage : null,
    });
    if (!data) {
      return fail("Training run not found", 404, { trainingRunId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
