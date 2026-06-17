import { fail, ok } from "@/lib/api-response";
import {
  deleteTrainingSectionBlock,
  mapTrainingSceneBlockError,
  updateTrainingSectionBlock,
} from "@/server/services/training/project-scene-block-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
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
