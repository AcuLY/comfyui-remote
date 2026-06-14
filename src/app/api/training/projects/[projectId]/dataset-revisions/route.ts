import { fail, ok } from "@/lib/api-response";
import { freezeManagedTrainingDataset, mapTrainingProjectError } from "@/server/services/training/project-service";
import { getTrainingProject, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  freezeCharacterLoraDataset,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await getTrainingProject(projectId);
    return ok(project.datasetRevisions);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const managed = await freezeManagedTrainingDataset(projectId);
    if (managed) {
      return ok(managed, { status: 201 });
    }
    const data = await freezeCharacterLoraDataset(projectId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
