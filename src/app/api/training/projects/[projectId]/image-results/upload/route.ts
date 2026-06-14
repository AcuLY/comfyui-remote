import { fail, ok } from "@/lib/api-response";
import { mapTrainingProjectError, uploadManagedTrainingImageResult } from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const formData = await request.formData();
    const data = await uploadManagedTrainingImageResult(projectId, formData);
    if (!data) {
      return fail("Training project not found", 404, { projectId });
    }
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
