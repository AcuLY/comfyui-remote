import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingPresetFromRun,
  mapTrainingRunPresetError,
} from "@/server/services/training/run-preset-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
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
