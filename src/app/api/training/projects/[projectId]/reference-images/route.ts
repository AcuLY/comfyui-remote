import { fail, ok } from "@/lib/api-response";
import {
  listTrainingProjectReferenceImages,
  mapTrainingReferenceImageMutationError,
  registerTrainingReferenceImageFromArtifact,
  uploadTrainingProjectReferenceImage,
} from "@/server/services/training/project-actions-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await listTrainingProjectReferenceImages(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
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
      const data = await registerTrainingReferenceImageFromArtifact(projectId, body);
      return ok(data, { status: 201 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return fail("Invalid multipart form data", 400);
    }

    const data = await uploadTrainingProjectReferenceImage(projectId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingReferenceImageMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
