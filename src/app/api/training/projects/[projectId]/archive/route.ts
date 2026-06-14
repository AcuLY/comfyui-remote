import { fail, ok } from "@/lib/api-response";
import { archiveManagedTrainingProject, mapTrainingProjectError } from "@/server/services/training/project-service";
import {
  archiveCharacterLoraTrainingJob,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const managed = await archiveManagedTrainingProject(projectId);
    if (managed) {
      return ok(managed);
    }
    const data = await archiveCharacterLoraTrainingJob(projectId);
    return ok(data);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
