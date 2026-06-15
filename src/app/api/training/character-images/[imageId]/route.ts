import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedTrainingReferenceImage,
  mapTrainingProjectError,
  updateManagedTrainingReferenceImage,
} from "@/server/services/training/project-service";
import {
  deleteLegacyTrainingReferenceImage,
  getLegacyTrainingReferenceImageFromRepository,
  mapLegacyTrainingReferenceImageError,
  updateLegacyTrainingReferenceImage,
} from "@/server/services/training/legacy-compat-service";

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
    if (data) {
      return ok(data);
    }

    const sourceImage = await getLegacyTrainingReferenceImageFromRepository(imageId).catch(() => null);
    const productionProjectId = sourceImage?.jobId ?? null;
    if (!productionProjectId) {
      return fail("Training reference image not found", 404, { imageId });
    }
    const updated = await updateLegacyTrainingReferenceImage(productionProjectId, imageId, payload);
    return ok(updated);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapLegacyTrainingReferenceImageError(error);
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
    if (data) {
      return ok(data);
    }
    const sourceImage = await getLegacyTrainingReferenceImageFromRepository(imageId).catch(() => null);
    const productionProjectId = sourceImage?.jobId ?? null;
    if (!productionProjectId) {
      return fail("Training reference image not found", 404, { imageId });
    }
    const deleted = await deleteLegacyTrainingReferenceImage(productionProjectId, imageId);
    return ok(deleted);
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapLegacyTrainingReferenceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
