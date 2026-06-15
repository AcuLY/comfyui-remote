import { fail, ok } from "@/lib/api-response";
import {
  enqueueTrainingRun,
  mapTrainingRunCreationError,
} from "@/server/services/training/project-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";

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
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    return fail("Invalid JSON body", 400);
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
