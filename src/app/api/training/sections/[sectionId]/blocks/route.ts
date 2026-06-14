import { fail, ok } from "@/lib/api-response";
import {
  createTrainingSectionBlock,
  mapTrainingSceneBlockError,
} from "@/server/services/training/project-scene-block-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { sectionId } = await params;
    const data = await createTrainingSectionBlock(sectionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
