import { fail, ok } from "@/lib/api-response";
import { getTrainingProject, mapTrainingReadError } from "@/server/services/training/read-service";

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
