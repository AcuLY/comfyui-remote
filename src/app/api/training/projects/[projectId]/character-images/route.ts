import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraSourceImages,
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
    const data = await listCharacterLoraSourceImages(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return fail("Invalid multipart form data", 400);
  }

  try {
    const { projectId } = await params;
    const data = await uploadCharacterLoraSourceImage(projectId, formData);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraSourceImageError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}
