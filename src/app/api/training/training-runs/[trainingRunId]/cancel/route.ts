import { fail, ok } from "@/lib/api-response";
import {
  cancelTrainingRun,
  mapTrainingRunMutationError,
} from "@/server/services/training/project-actions-service";

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
    const data = await cancelTrainingRun(trainingRunId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
