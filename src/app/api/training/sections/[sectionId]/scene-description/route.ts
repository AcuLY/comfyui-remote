import { fail, ok } from "@/lib/api-response";
import {
  getTrainingSectionSceneDescription,
  mapTrainingReadError,
} from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const data = await getTrainingSectionSceneDescription(sectionId, projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
