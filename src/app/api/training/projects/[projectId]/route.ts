import { fail, failFromError, ok } from "@/lib/api-response";
import {
  getTrainingProject,
  mapTrainingReadError,
} from "@/server/services/training/read-service";
import {
  deleteTrainingProject,
  mapTrainingProjectMutationError,
  updateTrainingProject,
} from "@/server/services/training/project-actions-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await getTrainingProject(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId } = await params;
    const data = await updateTrainingProject(projectId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    await getTrainingProject(projectId);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }

  try {
    const deleted = await deleteTrainingProject(projectId);
    return ok({
      deletedRunCount: deleted?.deletedRunCount ?? 0,
      id: projectId,
    });
  } catch (error) {
    const mapped = mapTrainingProjectMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
