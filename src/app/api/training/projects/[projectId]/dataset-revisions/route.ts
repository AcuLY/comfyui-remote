import { fail, failFromError, ok } from "@/lib/api-response";
import {
  freezeTrainingDataset,
  mapTrainingGenerationRunMutationError,
} from "@/server/services/training/project-actions-service";
import { getTrainingProject, mapTrainingReadError } from "@/server/services/training/read-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await getTrainingProject(projectId);
    return ok(project.datasetRevisions);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId } = await params;
    const data = await freezeTrainingDataset(projectId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
