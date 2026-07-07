import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingSectionBlock,
  mapTrainingSceneBlockError,
  updateTrainingSectionBlock,
} from "@/server/services/training/project-scene-block-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { blockId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const data = await updateTrainingSectionBlock(blockId, body, { projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  try {
    const { blockId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const data = await deleteTrainingSectionBlock(blockId, { projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
