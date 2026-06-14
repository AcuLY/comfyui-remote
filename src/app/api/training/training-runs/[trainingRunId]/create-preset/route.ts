import { fail, ok } from "@/lib/api-response";
import {
  createTrainingPresetFromRun,
  mapTrainingRunPresetError,
} from "@/server/services/training/run-preset-service";

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
    const data = await createTrainingPresetFromRun(trainingRunId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingRunPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
