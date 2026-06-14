import { fail, ok } from "@/lib/api-response";
import { completeManagedTrainingRun, mapTrainingProjectError } from "@/server/services/training/project-service";

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
    const data = await completeManagedTrainingRun(trainingRunId, {
      artifactName: typeof payload.artifactName === "string" ? payload.artifactName : null,
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
