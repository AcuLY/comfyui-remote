import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedTrainingReferenceImage,
  mapTrainingProjectError,
  updateManagedTrainingReferenceImage,
} from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};

  try {
    const { imageId } = await params;
    const data = await updateManagedTrainingReferenceImage(imageId, {
      kind: typeof payload.kind === "string" ? payload.kind : null,
      label: typeof payload.label === "string" ? payload.label : null,
      note: typeof payload.note === "string" ? payload.note : null,
    });
    if (!data) {
      return fail("Character LoRA source image not found", 404, { imageId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;
    const data = await deleteManagedTrainingReferenceImage(imageId);
    if (!data) {
      return fail("Character LoRA source image not found", 404, { imageId });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
