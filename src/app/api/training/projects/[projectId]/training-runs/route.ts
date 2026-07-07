import { fail, failFromError, ok } from "@/lib/api-response";
import {
  enqueueTrainingRun,
  mapTrainingRunCreationError,
} from "@/server/services/training/project-actions-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await listTrainingRuns({ kind: "training", projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: Record<string, unknown> = {};

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId } = await params;
    const data = await enqueueTrainingRun(projectId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingRunCreationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
