import { fail, ok } from "@/lib/api-response";
import { mapTrainingProjectError, restoreManagedTrainingProject } from "@/server/services/training/project-service";
import {
  mapLegacyTrainingProjectError,
  restoreLegacyTrainingProject,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const managed = await restoreManagedTrainingProject(projectId);
    if (managed) {
      return ok(managed);
    }
    const data = await restoreLegacyTrainingProject(projectId);
    return ok(data);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapLegacyTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
