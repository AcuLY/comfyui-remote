import { fail, ok } from "@/lib/api-response";
import {
  listManagedTrainingProjectReferenceImages,
  mapTrainingProjectError,
  uploadManagedTrainingProjectReferenceImage,
} from "@/server/services/training/project-service";
import {
  listCharacterLoraSourceImages,
  registerCharacterLoraSourceImageFromArtifact,
  mapCharacterLoraSourceImageError,
  uploadCharacterLoraSourceImage,
} from "@/server/services/character-lora-training/source-image-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const managedImages = await listManagedTrainingProjectReferenceImages(projectId);
    if (managedImages) {
      return ok(managedImages);
    }
    const data = await listCharacterLoraSourceImages(projectId);
    return ok(data);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    const { projectId } = await params;
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return fail("Invalid JSON body", 400);
      }
      const data = await registerCharacterLoraSourceImageFromArtifact(projectId, body);
      return ok(data, { status: 201 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return fail("Invalid multipart form data", 400);
    }

    const managedUpload = await uploadManagedTrainingProjectReferenceImage(projectId, formData);
    if (managedUpload) {
      return ok(managedUpload, { status: 201 });
    }
    const data = await uploadCharacterLoraSourceImage(projectId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
