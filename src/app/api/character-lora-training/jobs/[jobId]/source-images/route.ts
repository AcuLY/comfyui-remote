import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraSourceImages,
  mapCharacterLoraSourceImageError,
  uploadCharacterLoraSourceImage,
} from "@/server/services/character-lora-training/source-image-service";

export const dynamic = "force-dynamic";

type SourceImagesRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: SourceImagesRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraSourceImages(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: SourceImagesRouteContext) {
  const { jobId } = await context.params;
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return fail("Invalid multipart form data", 400);
  }

  try {
    const data = await uploadCharacterLoraSourceImage(jobId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
