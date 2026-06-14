import { fail, ok } from "@/lib/api-response";
import {
  detachTrainingSectionBlock,
  mapTrainingSceneBlockError,
} from "@/server/services/training/project-scene-block-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
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
