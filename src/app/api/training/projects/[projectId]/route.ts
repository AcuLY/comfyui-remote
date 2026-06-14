import { fail, ok } from "@/lib/api-response";
import {
  getTrainingProject,
  mapTrainingReadError,
} from "@/server/services/training/read-service";
import {
  mapTrainingProjectError,
  updateManagedTrainingProject,
} from "@/server/services/training/project-service";
import {
  mapCharacterLoraTrainingJobError,
  updateCharacterLoraTrainingJob,
} from "@/server/services/character-lora-training/job-service";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const managed = await updateManagedTrainingProject(projectId, body);
    if (managed) {
      return ok(managed);
    }
    const data = await updateCharacterLoraTrainingJob(projectId, body);
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
