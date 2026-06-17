import { fail, ok } from "@/lib/api-response";
import {
  archiveTrainingProject,
  mapTrainingProjectMutationError,
} from "@/server/services/training/project-actions-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await archiveTrainingProject(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
