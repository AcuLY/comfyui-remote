import { fail, ok } from "@/lib/api-response";
import {
  enqueueTrainingSectionGenerationRun,
  mapTrainingGenerationRunMutationError,
} from "@/server/services/training/project-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    const data = await listTrainingRuns({ kind: "generation", projectId, sectionId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { sectionId } = await params;
    const data = await enqueueTrainingSectionGenerationRun(sectionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
