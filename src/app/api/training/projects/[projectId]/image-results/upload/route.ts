import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingGenerationOutputError,
  uploadTrainingResultImage,
} from "@/server/services/training/generation-output-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const formData = await request.formData();
    const data = await uploadTrainingResultImage(projectId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationOutputError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
