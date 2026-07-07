import { fail, failFromError, ok } from "@/lib/api-response";
import {
  detachTrainingSectionBlock,
  mapTrainingSceneBlockError,
} from "@/server/services/training/project-scene-block-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { blockId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const data = await detachTrainingSectionBlock(blockId, body, { projectId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
